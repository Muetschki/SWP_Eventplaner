<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { currentUser, logout } from '../auth.js'
import { events, formatDate, loadEvents } from '../data.js'

const router = useRouter()
const loadError = ref('')

onMounted(async () => {
  try {
    await loadEvents()
  } catch {
    loadError.value = 'Could not load events. Start the app with npm start.'
  }
})

function logOut() {
  logout()
  router.push('/login')
}

function hasJoined(event) {
  return event.participants.includes(currentUser.value.id)
}
</script>

<template>
  <div class="page">
    <header class="topbar">
      <strong>Event Planner</strong>
      <div class="topbar-right">
        <span>Hello, {{ currentUser.name }}</span>
        <button type="button" class="secondary" @click="logOut">Log out</button>
      </div>
    </header>

    <div class="master-detail">
      <aside class="master">
        <div class="master-head">
          <h1>Events</h1>
          <router-link class="button" to="/events/new">Add event</router-link>
        </div>

        <p v-if="loadError" class="error">{{ loadError }}</p>
        <p v-else-if="events.length === 0" class="muted">No events yet. Add the first one.</p>

        <ul class="event-list">
          <li v-for="event in events" :key="event.id">
            <router-link :to="'/events/' + event.id" class="event-link">
              <span class="event-title">{{ event.title }}</span>
              <span class="event-meta">
                {{ formatDate(event.date) }} · {{ event.place }}
              </span>
              <span class="event-meta">{{ event.participants.length }} joined</span>
              <span v-if="hasJoined(event)" class="badge">Joined</span>
            </router-link>
          </li>
        </ul>
      </aside>

      <section class="detail">
        <router-view />
      </section>
    </div>
  </div>
</template>
