<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { currentUser, logout } from '../auth.js'
import { events, formatDate, loadEvents } from '../data.js'

const router = useRouter()
const loadError = ref('')
const query = ref('')

const visibleEvents = computed(() => {
  const term = query.value.trim().toLowerCase()

  return [...events.value]
    .filter((event) => {
      if (!term) return true
      return (
        event.title.toLowerCase().includes(term) ||
        event.place.toLowerCase().includes(term)
      )
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title))
})

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

        <div class="field">
          <label for="event-search">Search</label>
          <input
            id="event-search"
            v-model="query"
            type="search"
            placeholder="Title or place"
          />
        </div>

        <p v-if="loadError" class="error">{{ loadError }}</p>
        <p v-else-if="events.length === 0" class="muted">No events yet. Add the first one.</p>
        <p v-else-if="visibleEvents.length === 0" class="muted">No events match your search.</p>

        <ul class="event-list">
          <li v-for="event in visibleEvents" :key="event.id">
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
