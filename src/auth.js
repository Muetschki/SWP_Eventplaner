import { ref } from 'vue'

function readSavedUser() {
  try {
    return JSON.parse(localStorage.getItem('user') || 'null')
  } catch {
    return null
  }
}

export const currentUser = ref(readSavedUser())

export function setUser(user) {
  const safeUser = { id: user.id, username: user.username, name: user.name }
  currentUser.value = safeUser
  localStorage.setItem('user', JSON.stringify(safeUser))
}

export function logout() {
  currentUser.value = null
  localStorage.removeItem('user')
}
