import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'

const port = 3000
const dir = path.dirname(fileURLToPath(import.meta.url))
const jsonPath = path.join(dir, 'db.json')
const db = new DatabaseSync(path.join(dir, 'events.db'))

const defaultCategories = ['Party', 'Sports', 'School', 'Culture', 'Gaming', 'Other']

db.exec(`
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    name TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
  );

  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    date TEXT NOT NULL,
    place TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    category_id INTEGER REFERENCES categories(id),
    created_by INTEGER NOT NULL REFERENCES users(id),
    visibility TEXT NOT NULL DEFAULT 'public',
    password TEXT NOT NULL DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS event_participants (
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id),
    PRIMARY KEY (event_id, user_id)
  );
`)

const insertCategory = db.prepare('INSERT OR IGNORE INTO categories (name) VALUES (?)')
for (const name of defaultCategories) insertCategory.run(name)

function categoryIdByName(name) {
  return db.prepare('SELECT id FROM categories WHERE name = ?').get(name)?.id ?? null
}

function importJson() {
  const hasUsers = db.prepare('SELECT COUNT(*) AS count FROM users').get().count > 0
  if (hasUsers || !fs.existsSync(jsonPath)) return

  const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'))
  const otherId = categoryIdByName('Other')
  const insertUser = db.prepare(
    'INSERT INTO users (id, username, password, name) VALUES (?, ?, ?, ?)',
  )
  const insertEvent = db.prepare(`
    INSERT INTO events (id, title, date, place, description, category_id, created_by, visibility, password)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const insertParticipant = db.prepare(
    'INSERT OR IGNORE INTO event_participants (event_id, user_id) VALUES (?, ?)',
  )

  db.exec('BEGIN')
  try {
    for (const user of data.users || []) {
      insertUser.run(user.id, user.username, user.password, user.name)
    }
    for (const event of data.events || []) {
      insertEvent.run(
        event.id,
        event.title,
        event.date,
        event.place,
        event.description || '',
        otherId,
        event.createdBy,
        event.visibility === 'private' ? 'private' : 'public',
        event.password || '',
      )
      for (const userId of event.participants || []) insertParticipant.run(event.id, userId)
    }
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}

importJson()

const eventSelect = `
  SELECT e.*, c.name AS category_name
  FROM events e
  LEFT JOIN categories c ON c.id = e.category_id
`

function participantsFor(eventId) {
  return db
    .prepare('SELECT user_id FROM event_participants WHERE event_id = ? ORDER BY rowid')
    .all(eventId)
    .map((row) => row.user_id)
}

function rowToEvent(row) {
  return {
    id: row.id,
    title: row.title,
    date: row.date,
    place: row.place,
    description: row.description,
    categoryId: row.category_id,
    category: row.category_name,
    createdBy: row.created_by,
    participants: participantsFor(row.id),
    visibility: row.visibility,
    password: row.password,
  }
}

function getEvent(id) {
  const row = db.prepare(`${eventSelect} WHERE e.id = ?`).get(Number(id))
  return row ? rowToEvent(row) : null
}

function findEvents({ categoryId, q }) {
  const where = []
  const params = []

  if (categoryId) {
    where.push('e.category_id = ?')
    params.push(Number(categoryId))
  }

  if (q) {
    const like = `%${q.replace(/[\\%_]/g, '\\$&')}%`
    where.push(
      "(e.title LIKE ? ESCAPE '\\' OR e.place LIKE ? ESCAPE '\\' OR c.name LIKE ? ESCAPE '\\')",
    )
    params.push(like, like, like)
  }

  const sql = `${eventSelect} ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY e.date, e.title`
  return db.prepare(sql).all(...params).map(rowToEvent)
}

function categoryExists(id) {
  return Boolean(db.prepare('SELECT id FROM categories WHERE id = ?').get(Number(id)))
}

function setParticipants(eventId, participants) {
  const insert = db.prepare(
    'INSERT OR IGNORE INTO event_participants (event_id, user_id) VALUES (?, ?)',
  )
  db.prepare('DELETE FROM event_participants WHERE event_id = ?').run(eventId)
  for (const userId of participants) insert.run(eventId, Number(userId))
}

function send(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(data))
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', (chunk) => {
      data += chunk
    })
    req.on('end', () => resolve(data || '{}'))
    req.on('error', reject)
  })
}

function isPrivate(event) {
  return event.visibility === 'private'
}

function canSeeEvent(event, userId) {
  if (!isPrivate(event)) return true
  const id = Number(userId)
  if (!id) return false
  return id === Number(event.createdBy) || event.participants.includes(id)
}

function toClient(event, userId, unlocked = false) {
  const visibility = isPrivate(event) ? 'private' : 'public'

  if (!unlocked && !canSeeEvent(event, userId)) {
    return {
      id: event.id,
      title: event.title,
      date: event.date,
      place: event.place,
      categoryId: event.categoryId,
      category: event.category,
      createdBy: event.createdBy,
      visibility,
      locked: true,
    }
  }

  const { password, ...rest } = event
  return { ...rest, visibility, locked: false }
}

const server = http.createServer(async (req, res) => {
  try {
  const url = new URL(req.url, `http://localhost:${port}`)
  const parts = url.pathname.split('/').filter(Boolean)
  const collection = parts[0]
  const id = parts[1]

  if (!['users', 'events', 'categories'].includes(collection) || parts.length > 2) {
    return send(res, 404, { error: 'Not found' })
  }

  if (req.method === 'GET' && collection === 'categories' && !id) {
    return send(res, 200, db.prepare('SELECT id, name FROM categories ORDER BY name').all())
  }

  if (req.method === 'GET' && collection === 'users' && !id) {
    return send(res, 200, db.prepare('SELECT id, username, password, name FROM users').all())
  }

  if (req.method === 'GET' && collection === 'users' && id) {
    const user = db.prepare('SELECT id, username, password, name FROM users WHERE id = ?').get(Number(id))
    if (!user) return send(res, 404, { error: 'Not found' })
    return send(res, 200, user)
  }

  if (req.method === 'GET' && collection === 'events' && !id) {
    const userId = url.searchParams.get('userId')
    const items = findEvents({
      categoryId: url.searchParams.get('categoryId'),
      q: String(url.searchParams.get('q') || '').trim(),
    })
    return send(res, 200, items.map((event) => toClient(event, userId)))
  }

  if (req.method === 'GET' && collection === 'events' && id) {
    const event = getEvent(id)
    if (!event) return send(res, 404, { error: 'Not found' })
    return send(res, 200, toClient(event, url.searchParams.get('userId')))
  }

  if (req.method === 'POST' && collection === 'users' && !id) {
    const body = JSON.parse(await readBody(req))
    const name = String(body.name || '').trim()
    const username = String(body.username || '').trim()
    const password = String(body.password || '')

    if (!name || !username || !password) {
      return send(res, 400, { error: 'Name, username and password are required.' })
    }

    if (db.prepare('SELECT id FROM users WHERE username = ?').get(username)) {
      return send(res, 409, { error: 'This username is already taken.' })
    }

    const result = db
      .prepare('INSERT INTO users (username, password, name) VALUES (?, ?, ?)')
      .run(username, password, name)
    return send(res, 201, { id: Number(result.lastInsertRowid), username, password, name })
  }

  if (req.method === 'POST' && collection === 'events' && !id) {
    const body = JSON.parse(await readBody(req))
    const visibility = body.visibility === 'private' ? 'private' : 'public'
    const password = String(body.password || '')

    if (visibility === 'private' && !password) {
      return send(res, 400, { error: 'A private event needs a password.' })
    }

    if (!categoryExists(body.categoryId)) {
      return send(res, 400, { error: 'Please choose a valid category.' })
    }

    const result = db
      .prepare(`
        INSERT INTO events (title, date, place, description, category_id, created_by, visibility, password)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        body.title,
        body.date,
        body.place,
        body.description || '',
        Number(body.categoryId),
        Number(body.createdBy),
        visibility,
        visibility === 'private' ? password : '',
      )
    const eventId = Number(result.lastInsertRowid)
    setParticipants(eventId, body.participants || [])
    return send(res, 201, toClient(getEvent(eventId), body.createdBy))
  }

  if (req.method === 'POST' && collection === 'events' && id) {
    const body = JSON.parse(await readBody(req))
    const event = getEvent(id)
    if (!event) return send(res, 404, { error: 'Not found' })

    if (isPrivate(event) && String(body.password || '') !== String(event.password || '')) {
      return send(res, 403, { error: 'Wrong password.' })
    }

    return send(res, 200, toClient(event, body.userId, true))
  }

  if (req.method === 'PATCH' && collection === 'events' && id) {
    const body = JSON.parse(await readBody(req))
    const event = getEvent(id)
    if (!event) return send(res, 404, { error: 'Not found' })

    const editingDetails = ['title', 'date', 'place', 'description', 'categoryId'].some(
      (key) => key in body,
    )

    if (editingDetails) {
      if (Number(body.userId) !== event.createdBy) {
        return send(res, 403, { error: 'Only the owner can edit this event.' })
      }

      const title = String(body.title || '').trim()
      const date = String(body.date || '').trim()
      const place = String(body.place || '').trim()

      if (!title || !date || !place) {
        return send(res, 400, { error: 'Title, date and place are required.' })
      }

      if (!categoryExists(body.categoryId)) {
        return send(res, 400, { error: 'Please choose a valid category.' })
      }

      db.prepare(`
        UPDATE events SET title = ?, date = ?, place = ?, description = ?, category_id = ?
        WHERE id = ?
      `).run(
        title,
        date,
        place,
        String(body.description || '').trim(),
        Number(body.categoryId),
        event.id,
      )
    }

    if (Array.isArray(body.participants)) {
      if (isPrivate(event)) {
        const userId = Number(body.userId)
        const knowsPassword = String(body.password || '') === String(event.password || '')
        const allowed =
          userId === Number(event.createdBy) ||
          event.participants.includes(userId) ||
          knowsPassword

        if (!allowed) {
          return send(res, 403, { error: 'Wrong password.' })
        }
      }

      setParticipants(event.id, body.participants)
    }

    return send(res, 200, toClient(getEvent(event.id), body.userId, true))
  }

  if (req.method === 'DELETE' && collection === 'events' && id) {
    const body = JSON.parse(await readBody(req))
    const event = getEvent(id)
    if (!event) return send(res, 404, { error: 'Not found' })

    if (Number(body.userId) !== event.createdBy) {
      return send(res, 403, { error: 'Only the owner can delete this event.' })
    }

    db.prepare('DELETE FROM events WHERE id = ?').run(event.id)
    return send(res, 200, { ok: true })
  }

  send(res, 404, { error: 'Not found' })
  } catch {
    send(res, 400, { error: 'Invalid request.' })
  }
})

server.listen(port, () => {
  console.log(`API running at http://localhost:${port}`)
})
