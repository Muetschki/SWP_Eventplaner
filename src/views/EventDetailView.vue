<script setup>
import { ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { currentUser } from '../auth.js'
import { formatDate, loadEvents, loadUsers, nameFor } from '../data.js'

const route = useRoute()
const router = useRouter()
const event = ref(null)
const error = ref('')
const joining = ref(false)
const editing = ref(false)
const saving = ref(false)
const confirmingDelete = ref(false)
const deleting = ref(false)
const title = ref('')
const date = ref('')
const place = ref('')
const description = ref('')
let requestId = 0

function isOwner() {
  return Number(event.value?.createdBy) === Number(currentUser.value?.id)
}

async function loadEvent() {
  const myRequest = ++requestId
  error.value = ''
  editing.value = false
  confirmingDelete.value = false

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

async function updateParticipation(participating) {
  if (joining.value) return

  joining.value = true
  error.value = ''

  const participants = participating
    ? [...event.value.participants, currentUser.value.id]
    : event.value.participants.filter((id) => id !== currentUser.value.id)

  try {
    const response = await fetch(`/api/events/${event.value.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        participants,
      }),
    })

    if (!response.ok) throw new Error('Could not update participation')

    event.value = await response.json()
    await loadEvents()
  } catch {
    error.value = participating
      ? 'Could not join this event.'
      : 'Could not leave this event.'
  } finally {
    joining.value = false
  }
}

function joinEvent() {
  return updateParticipation(true)
}

function leaveEvent() {
  return updateParticipation(false)
}

function startEdit() {
  confirmingDelete.value = false
  error.value = ''
  title.value = event.value.title
  date.value = event.value.date
  place.value = event.value.place
  description.value = event.value.description || ''
  editing.value = true
}

function cancelEdit() {
  editing.value = false
  error.value = ''
}

async function saveEdit() {
  error.value = ''

  if (!title.value.trim() || !date.value || !place.value.trim()) {
    error.value = 'Please fill in title, date and place.'
    return
  }

  saving.value = true

  try {
    const response = await fetch(`/api/events/${event.value.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: currentUser.value.id,
        title: title.value.trim(),
        date: date.value,
        place: place.value.trim(),
        description: description.value.trim(),
      }),
    })

    if (response.status === 403) {
      error.value = 'Only the owner can edit this event.'
      return
    }

    if (!response.ok) throw new Error('Could not save event')

    event.value = await response.json()
    editing.value = false
    await loadEvents()
  } catch {
    error.value = 'Could not save the event.'
  } finally {
    saving.value = false
  }
}

async function deleteEvent() {
  if (deleting.value) return

  deleting.value = true
  error.value = ''

  try {
    const response = await fetch(`/api/events/${event.value.id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: currentUser.value.id }),
    })

    if (response.status === 403) {
      error.value = 'Only the owner can delete this event.'
      confirmingDelete.value = false
      return
    }

    if (!response.ok) throw new Error('Could not delete event')

    await loadEvents()
    router.push('/events')
  } catch {
    error.value = 'Could not delete this event.'
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <form v-if="event && editing" class="detail-card" @submit.prevent="saveEdit">
    <h2>Edit event</h2>
    <p class="muted">Only you can change this event, because you created it.</p>

    <div class="field">
      <label for="edit-title">Title</label>
      <input id="edit-title" v-model="title" />
    </div>

    <div class="field">
      <label for="edit-date">Date</label>
      <input id="edit-date" v-model="date" type="date" />
    </div>

    <div class="field">
      <label for="edit-place">Place</label>
      <input id="edit-place" v-model="place" />
    </div>

    <div class="field">
      <label for="edit-description">Description</label>
      <textarea id="edit-description" v-model="description" rows="4"></textarea>
    </div>

    <p v-if="error" class="error">{{ error }}</p>

    <div class="actions">
      <button type="submit" :disabled="saving">
        {{ saving ? 'Saving...' : 'Save changes' }}
      </button>
      <button type="button" class="secondary" :disabled="saving" @click="cancelEdit">
        Cancel
      </button>
    </div>
  </form>

  <article v-else-if="event" class="detail-card">
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
    <div class="actions">
      <button
        v-if="hasJoined()"
        type="button"
        :disabled="joining || deleting"
        @click="leaveEvent"
      >
        {{ joining ? 'Leaving...' : 'Leave event' }}
      </button>
      <button v-else type="button" :disabled="joining || deleting" @click="joinEvent">
        {{ joining ? 'Joining...' : 'Join event' }}
      </button>
      <button
        v-if="isOwner() && !confirmingDelete"
        type="button"
        class="secondary"
        @click="startEdit"
      >
        Edit event
      </button>
      <button
        v-if="isOwner() && !confirmingDelete"
        type="button"
        class="danger"
        @click="confirmingDelete = true"
      >
        Delete event
      </button>
    </div>

    <div v-if="confirmingDelete" class="confirm-box">
      <p>Are you sure? This removes the event for everyone.</p>
      <div class="actions">
        <button type="button" class="danger" :disabled="deleting" @click="deleteEvent">
          {{ deleting ? 'Deleting...' : 'Delete event' }}
        </button>
        <button
          type="button"
          class="secondary"
          :disabled="deleting"
          @click="confirmingDelete = false"
        >
          Cancel
        </button>
      </div>
    </div>
  </article>

  <p v-else-if="error" class="error">{{ error }}</p>
  <p v-else class="muted">Loading...</p>
</template>
