<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { currentUser, logout } from '../auth.js'
import { categories, events, filters, formatDate, loadCategories, loadEvents } from '../data.js'

const router = useRouter()
const loadError = ref('')
let searchTimer = null

const isFiltering = computed(() => Boolean(filters.value.q.trim() || filters.value.categoryId))

async function refresh() {
  try {
    await loadEvents()
    loadError.value = ''
  } catch {
    loadError.value = 'Could not load events. Start the app with npm start.'
  }
}

watch(
  () => filters.value.q,
  () => {
    clearTimeout(searchTimer)
    searchTimer = setTimeout(refresh, 250)
  },
)

watch(() => filters.value.categoryId, refresh)

onMounted(async () => {
  await refresh()
  try {
    await loadCategories()
  } catch {
    loadError.value = 'Could not load categories.'
  }
})

function logOut() {
  logout()
  router.push('/login')
}

function hasJoined(event) {
  return Array.isArray(event.participants) && event.participants.includes(currentUser.value.id)
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
            v-model="filters.q"
            type="search"
            placeholder="Title, place or category"
          />
        </div>

        <div class="field">
          <label for="category-filter">Category</label>
          <select id="category-filter" v-model="filters.categoryId">
            <option value="">All categories</option>
            <option v-for="category in categories" :key="category.id" :value="String(category.id)">
              {{ category.name }}
            </option>
          </select>
        </div>

        <p v-if="loadError" class="error">{{ loadError }}</p>
        <p v-else-if="events.length === 0 && isFiltering" class="muted">
          No events match your search.
        </p>
        <p v-else-if="events.length === 0" class="muted">No events yet. Add the first one.</p>

        <ul class="event-list">
          <li v-for="event in events" :key="event.id">
            <router-link :to="'/events/' + event.id" class="event-link">
              <span class="event-title">{{ event.title }}</span>
              <span class="event-meta">
                {{ formatDate(event.date) }} · {{ event.place }}
              </span>
              <span v-if="event.category" class="badge">{{ event.category }}</span>
              <span v-if="event.locked" class="badge">Private</span>
              <template v-else>
                <span class="event-meta">{{ event.participants.length }} joined</span>
                <span v-if="event.visibility === 'private'" class="badge">Private</span>
                <span v-if="hasJoined(event)" class="badge">Joined</span>
              </template>
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
