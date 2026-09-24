import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const port = 3000
const dbPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'db.json')

function readDb() {
  return JSON.parse(fs.readFileSync(dbPath, 'utf8'))
}

function writeDb(db) {
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2))
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

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${port}`)
  const parts = url.pathname.split('/').filter(Boolean)
  const collection = parts[0]
  const id = parts[1]

  if (!['users', 'events'].includes(collection) || parts.length > 2) {
    return send(res, 404, { error: 'Not found' })
  }

  if (req.method === 'GET' && !id) {
    return send(res, 200, readDb()[collection])
  }

  if (req.method === 'GET' && id) {
    const item = readDb()[collection].find((entry) => String(entry.id) === id)
    if (!item) return send(res, 404, { error: 'Not found' })
    return send(res, 200, item)
  }

  if (req.method === 'POST' && collection === 'events' && !id) {
    const body = JSON.parse(await readBody(req))
    const db = readDb()
    const nextId = db.events.reduce((max, event) => Math.max(max, event.id), 0) + 1
    const event = {
      id: nextId,
      title: body.title,
      date: body.date,
      place: body.place,
      description: body.description || '',
      createdBy: body.createdBy,
      participants: body.participants || [],
    }
    db.events.push(event)
    writeDb(db)
    return send(res, 201, event)
  }

  if (req.method === 'PATCH' && collection === 'events' && id) {
    const body = JSON.parse(await readBody(req))
    const db = readDb()
    const index = db.events.findIndex((event) => String(event.id) === id)
    if (index === -1) return send(res, 404, { error: 'Not found' })
    db.events[index] = {
      ...db.events[index],
      participants: body.participants,
    }
    writeDb(db)
    return send(res, 200, db.events[index])
  }

  send(res, 404, { error: 'Not found' })
})

server.listen(port, () => {
  console.log(`API running at http://localhost:${port}`)
})
