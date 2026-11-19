import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'
import { initializeApp } from 'firebase/app'
import { doc, getFirestore, terminate, writeBatch } from 'firebase/firestore'

const dir = path.dirname(fileURLToPath(import.meta.url))
const dbPath = path.join(dir, 'events.db')
const jsonPath = path.join(dir, 'db.json')
const defaultCategories = ['Party', 'Sports', 'School', 'Culture', 'Gaming', 'Other']

process.loadEnvFile(path.join(dir, '.env.local'))

const firestore = getFirestore(
  initializeApp({
    apiKey: process.env.VITE_FIREBASE_API_KEY,
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.VITE_FIREBASE_APP_ID,
  }),
)

function readSqlite() {
  const db = new DatabaseSync(dbPath, { readOnly: true })
  const categories = db.prepare('SELECT id, name FROM categories').all()
  const users = db.prepare('SELECT id, username, password, name FROM users').all()
  const events = db.prepare('SELECT * FROM events').all().map((row) => ({
    id: row.id,
    title: row.title,
    date: row.date,
    place: row.place,
    description: row.description,
    categoryId: row.category_id,
    createdBy: row.created_by,
    visibility: row.visibility,
    password: row.password,
    participants: db
      .prepare('SELECT user_id FROM event_participants WHERE event_id = ? ORDER BY rowid')
      .all(row.id)
      .map((p) => p.user_id),
  }))
  db.close()
  return { categories, users, events }
}

function readJson() {
  const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'))
  const categories = defaultCategories.map((name, index) => ({ id: index + 1, name }))
  const otherId = categories.find((c) => c.name === 'Other').id
  const events = (data.events || []).map((event) => ({
    ...event,
    categoryId: otherId,
    visibility: event.visibility === 'private' ? 'private' : 'public',
    password: event.password || '',
  }))
  return { categories, users: data.users || [], events }
}

const source = fs.existsSync(dbPath) ? 'events.db' : 'db.json'
const { categories, users, events } = source === 'events.db' ? readSqlite() : readJson()

const batch = writeBatch(firestore)

for (const { id, name } of categories) {
  batch.set(doc(firestore, 'categories', String(id)), { name })
}

for (const { id, username, password, name } of users) {
  batch.set(doc(firestore, 'users', String(id)), { username, password, name })
}

for (const event of events) {
  batch.set(doc(firestore, 'events', String(event.id)), {
    title: event.title,
    date: event.date,
    place: event.place,
    description: event.description || '',
    categoryId: event.categoryId == null ? null : String(event.categoryId),
    createdBy: String(event.createdBy),
    visibility: event.visibility,
    password: event.password || '',
    participants: (event.participants || []).map(String),
  })
}

await batch.commit()
await terminate(firestore)

console.log(
  `Copied ${categories.length} categories, ${users.length} users and ${events.length} events from ${source} to Firestore.`,
)
