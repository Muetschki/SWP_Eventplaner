import { ref } from 'vue'
import { getCategories, getUsers, listEvents } from './api.js'
import { currentUser } from './auth.js'

export const events = ref([])
export const users = ref([])
export const categories = ref([])
export const filters = ref({ q: '', categoryId: '' })

export async function loadEvents() {
  events.value = await listEvents({
    userId: currentUser.value?.id ?? '',
    q: filters.value.q,
    categoryId: filters.value.categoryId,
  })
}

export async function loadCategories() {
  categories.value = await getCategories()
}

export async function loadUsers() {
  users.value = await getUsers()
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
