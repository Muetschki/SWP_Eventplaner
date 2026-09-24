<script setup>
import { ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { currentUser } from '../auth.js'
import { formatDate, loadEvents, loadUsers, nameFor } from '../data.js'

const route = useRoute()
const event = ref(null)
const error = ref('')
const joining = ref(false)
let requestId = 0

async function loadEvent() {
  const myRequest = ++requestId
  error.value = ''

  try {
    const response = await fetch(`/api/events/${route.params.id}`)
    if (myRequest !== requestId) return

    if (!response.ok) {
      event.value = null
      error.value = 'This event was not found.'
      return
    }

    await loadUsers()
    if (myRequest !== requestId) return
    event.value = await response.json()
  } catch {
    if (myRequest !== requestId) return
    event.value = null
    error.value = 'Could not load this event.'
  }
}

watch(() => route.params.id, loadEvent, { immediate: true })

function hasJoined() {
  return event.value.participants.includes(currentUser.value.id)
}

async function joinEvent() {
  if (hasJoined() || joining.value) return

  joining.value = true
  error.value = ''

  try {
    const response = await fetch(`/api/events/${event.value.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        participants: [...event.value.participants, currentUser.value.id],
      }),
    })

    if (!response.ok) throw new Error('Could not join')

    event.value = await response.json()
    await loadEvents()
  } catch {
    error.value = 'Could not join this event.'
  } finally {
    joining.value = false
  }
}
</script>

<template>
  <article v-if="event" class="detail-card">
    <h2>{{ event.title }}</h2>
    <p class="event-meta">{{ formatDate(event.date) }} · {{ event.place }}</p>
    <p v-if="event.description">{{ event.description }}</p>
    <p class="muted">Added by {{ nameFor(event.createdBy) }}</p>

    <h3>Who joined</h3>
    <ul class="people">
      <li v-for="id in event.participants" :key="id">{{ nameFor(id) }}</li>
    </ul>

    <p v-if="error" class="error">{{ error }}</p>

    <p v-if="hasJoined()" class="joined-note">You joined this event.</p>
    <button v-else type="button" :disabled="joining" @click="joinEvent">
      {{ joining ? 'Joining...' : 'Join event' }}
    </button>
  </article>

  <p v-else-if="error" class="error">{{ error }}</p>
  <p v-else class="muted">Loading...</p>
</template>
