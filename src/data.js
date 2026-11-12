import { ref } from 'vue'
import { currentUser } from './auth.js'

export const events = ref([])
export const users = ref([])
export const categories = ref([])
export const filters = ref({ q: '', categoryId: '' })

export async function loadEvents() {
  const params = new URLSearchParams({
    userId: currentUser.value?.id ?? '',
    q: filters.value.q.trim(),
    categoryId: filters.value.categoryId,
  })
  const response = await fetch(`/api/events?${params}`)
  if (!response.ok) throw new Error('Could not load events')
  events.value = await response.json()
}

export async function loadCategories() {
  const response = await fetch('/api/categories')
  if (!response.ok) throw new Error('Could not load categories')
  categories.value = await response.json()
}

export async function loadUsers() {
  const response = await fetch('/api/users')
  if (!response.ok) throw new Error('Could not load users')
  users.value = await response.json()
}

export function nameFor(userId) {
  const user = users.value.find((item) => item.id === userId)
  return user ? user.name : 'Unknown'
}

export function formatDate(value) {
  const date = new Date(`${value}T00:00:00`)
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}
