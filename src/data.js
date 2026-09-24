import { ref } from 'vue'

export const events = ref([])
export const users = ref([])

export async function loadEvents() {
  const response = await fetch('/api/events')
  if (!response.ok) throw new Error('Could not load events')
  events.value = await response.json()
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
