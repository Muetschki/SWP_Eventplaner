<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { getUsers } from '../api.js'
import { setUser } from '../auth.js'

const router = useRouter()
const username = ref('')
const password = ref('')
const error = ref('')

async function login() {
  error.value = ''

  try {
    const users = await getUsers()

    const user = users.find(
      (item) => item.username === username.value.trim() && item.password === password.value,
    )

    if (!user) {
      error.value = 'Wrong username or password.'
      return
    }

    setUser(user)
    router.push('/events')
  } catch {
    error.value = 'Could not reach the database. Check your Firebase config in .env.local.'
  }
}
</script>

<template>
  <main class="login-page">
    <form class="card login-card" @submit.prevent="login">
      <p class="eyebrow">Event Planner</p>
      <h1>Log in</h1>
      <p class="muted">Then you can add an event or join one.</p>

      <div class="field">
        <label for="username">Username</label>
        <input id="username" v-model="username" autocomplete="username" />
      </div>

      <div class="field">
        <label for="password">Password</label>
        <input id="password" v-model="password" type="password" autocomplete="current-password" />
      </div>

      <p v-if="error" class="error">{{ error }}</p>

      <button type="submit">Log in</button>

      <p class="auth-switch">
        No account yet?
        <router-link to="/register">Create one</router-link>
      </p>

      <div class="demo">
        <p>Two accounts, same events:</p>
        <p><strong>anna</strong> / anna</p>
        <p><strong>max</strong> / max</p>
      </div>
    </form>
  </main>
</template>
