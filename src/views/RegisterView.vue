<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { setUser } from '../auth.js'

const router = useRouter()
const name = ref('')
const username = ref('')
const password = ref('')
const confirmPassword = ref('')
const error = ref('')
const saving = ref(false)

async function register() {
  error.value = ''

  const trimmedName = name.value.trim()
  const trimmedUsername = username.value.trim()

  if (!trimmedName || !trimmedUsername || !password.value) {
    error.value = 'Please fill in name, username and password.'
    return
  }

  if (password.value !== confirmPassword.value) {
    error.value = 'Passwords do not match.'
    return
  }

  saving.value = true

  try {
    const response = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: trimmedName,
        username: trimmedUsername,
        password: password.value,
      }),
    })

    if (response.status === 409) {
      error.value = 'This username is already taken.'
      saving.value = false
      return
    }

    if (!response.ok) throw new Error('Could not create account')

    const user = await response.json()
    setUser(user)
    router.push('/events')
  } catch {
    error.value = 'Could not reach the server. Start the app with npm start.'
    saving.value = false
  }
}
</script>

<template>
  <main class="login-page">
    <form class="card login-card" @submit.prevent="register">
      <p class="eyebrow">Event Planner</p>
      <h1>Create account</h1>
      <p class="muted">Then you can add an event or join one.</p>

      <div class="field">
        <label for="name">Name</label>
        <input id="name" v-model="name" autocomplete="name" />
      </div>

      <div class="field">
        <label for="username">Username</label>
        <input id="username" v-model="username" autocomplete="username" />
      </div>

      <div class="field">
        <label for="password">Password</label>
        <input id="password" v-model="password" type="password" autocomplete="new-password" />
      </div>

      <div class="field">
        <label for="confirm-password">Confirm password</label>
        <input
          id="confirm-password"
          v-model="confirmPassword"
          type="password"
          autocomplete="new-password"
        />
      </div>

      <p v-if="error" class="error">{{ error }}</p>

      <button type="submit" :disabled="saving">
        {{ saving ? 'Creating...' : 'Create account' }}
      </button>

      <p class="auth-switch">
        Already have an account?
        <router-link to="/login">Log in</router-link>
      </p>
    </form>
  </main>
</template>
