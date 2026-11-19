import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  updateDoc,
  where,
} from 'firebase/firestore'
import { db } from './firebase.js'

export class ApiError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

function withId(snapshot) {
  return { id: snapshot.id, ...snapshot.data() }
}

async function readEvent(id) {
  const snapshot = await getDoc(doc(db, 'events', String(id)))
  if (!snapshot.exists()) throw new ApiError(404, 'Not found')
  return withId(snapshot)
}

async function categoryExists(id) {
  if (!id) return false
  return (await getDoc(doc(db, 'categories', String(id)))).exists()
}

function isPrivate(event) {
  return event.visibility === 'private'
}

function canSeeEvent(event, userId) {
  if (!isPrivate(event)) return true
  if (!userId) return false
  return userId === event.createdBy || event.participants.includes(userId)
}

function toClient(event, categoryList, userId, unlocked = false) {
  const visibility = isPrivate(event) ? 'private' : 'public'
  const category = categoryList.find((item) => item.id === event.categoryId)?.name ?? null

  if (!unlocked && !canSeeEvent(event, userId)) {
    return {
      id: event.id,
      title: event.title,
      date: event.date,
      place: event.place,
      categoryId: event.categoryId,
      category,
      createdBy: event.createdBy,
      visibility,
      locked: true,
    }
  }

  const { password, ...rest } = event
  return { ...rest, participants: event.participants || [], category, visibility, locked: false }
}

export async function getCategories() {
  const snapshot = await getDocs(collection(db, 'categories'))
  return snapshot.docs.map(withId).sort((a, b) => a.name.localeCompare(b.name))
}

export async function getUsers() {
  const snapshot = await getDocs(collection(db, 'users'))
  return snapshot.docs.map(withId)
}

export async function createUser({ name, username, password }) {
  name = String(name || '').trim()
  username = String(username || '').trim()
  password = String(password || '')

  if (!name || !username || !password) {
    throw new ApiError(400, 'Name, username and password are required.')
  }

  const existing = await getDocs(query(collection(db, 'users'), where('username', '==', username)))
  if (!existing.empty) throw new ApiError(409, 'This username is already taken.')

  const ref = await addDoc(collection(db, 'users'), { username, password, name })
  return { id: ref.id, username, name }
}

export async function listEvents({ userId, q = '', categoryId = '' }) {
  const [snapshot, categoryList] = await Promise.all([
    getDocs(collection(db, 'events')),
    getCategories(),
  ])
  const search = q.trim().toLowerCase()

  return snapshot.docs
    .map(withId)
    .map((event) => ({
      event,
      category: categoryList.find((item) => item.id === event.categoryId)?.name ?? '',
    }))
    .filter(({ event }) => !categoryId || event.categoryId === categoryId)
    .filter(
      ({ event, category }) =>
        !search ||
        [event.title, event.place, category].some((text) =>
          String(text || '').toLowerCase().includes(search),
        ),
    )
    .map(({ event }) => event)
    .sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title))
    .map((event) => toClient(event, categoryList, userId))
}

export async function getEvent(id, userId) {
  const [event, categoryList] = await Promise.all([readEvent(id), getCategories()])
  return toClient(event, categoryList, userId)
}

export async function unlockEvent(id, { userId, password }) {
  const [event, categoryList] = await Promise.all([readEvent(id), getCategories()])

  if (isPrivate(event) && String(password || '') !== String(event.password || '')) {
    throw new ApiError(403, 'Wrong password.')
  }

  return toClient(event, categoryList, userId, true)
}

export async function createEvent(body) {
  const visibility = body.visibility === 'private' ? 'private' : 'public'
  const password = String(body.password || '')

  if (visibility === 'private' && !password) {
    throw new ApiError(400, 'A private event needs a password.')
  }

  if (!(await categoryExists(body.categoryId))) {
    throw new ApiError(400, 'Please choose a valid category.')
  }

  const ref = await addDoc(collection(db, 'events'), {
    title: body.title,
    date: body.date,
    place: body.place,
    description: body.description || '',
    categoryId: String(body.categoryId),
    createdBy: body.createdBy,
    participants: [...new Set(body.participants || [])],
    visibility,
    password: visibility === 'private' ? password : '',
  })

  return getEvent(ref.id, body.createdBy)
}

export async function updateEvent(id, body) {
  const event = await readEvent(id)
  const changes = {}

  const editingDetails = ['title', 'date', 'place', 'description', 'categoryId'].some(
    (key) => key in body,
  )

  if (editingDetails) {
    if (body.userId !== event.createdBy) {
      throw new ApiError(403, 'Only the owner can edit this event.')
    }

    const title = String(body.title || '').trim()
    const date = String(body.date || '').trim()
    const place = String(body.place || '').trim()

    if (!title || !date || !place) {
      throw new ApiError(400, 'Title, date and place are required.')
    }

    if (!(await categoryExists(body.categoryId))) {
      throw new ApiError(400, 'Please choose a valid category.')
    }

    Object.assign(changes, {
      title,
      date,
      place,
      description: String(body.description || '').trim(),
      categoryId: String(body.categoryId),
    })
  }

  if (Array.isArray(body.participants)) {
    if (isPrivate(event)) {
      const knowsPassword = String(body.password || '') === String(event.password || '')
      const allowed =
        body.userId === event.createdBy ||
        (event.participants || []).includes(body.userId) ||
        knowsPassword

      if (!allowed) throw new ApiError(403, 'Wrong password.')
    }

    changes.participants = [...new Set(body.participants)]
  }

  if (Object.keys(changes).length) {
    await updateDoc(doc(db, 'events', event.id), changes)
  }

  const [updated, categoryList] = await Promise.all([readEvent(event.id), getCategories()])
  return toClient(updated, categoryList, body.userId, true)
}

export async function deleteEvent(id, userId) {
  const event = await readEvent(id)

  if (userId !== event.createdBy) {
    throw new ApiError(403, 'Only the owner can delete this event.')
  }

  await deleteDoc(doc(db, 'events', event.id))
}
