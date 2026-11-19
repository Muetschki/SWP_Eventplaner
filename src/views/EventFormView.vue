
<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { createEvent } from '../api.js'
import { currentUser } from '../auth.js'
import { categories, loadCategories, loadEvents } from '../data.js'

const router = useRouter()
const title = ref('')
const date = ref('')
const place = ref('')
const description = ref('')
const categoryId = ref('')
const visibility = ref('public')
const password = ref('')
const error = ref('')
const saving = ref(false)

onMounted(async () => {
  try {
    await loadCategories()
  } catch {
    error.value = 'Could not load categories.'
  }
})

async function saveEvent() {
  error.value = ''

  if (!title.value.trim() || !date.value || !place.value.trim()) {
    error.value = 'Please fill in title, date and place.'
    return
  }

  if (!categoryId.value) {
    error.value = 'Please choose a category.'
    return
  }

  if (visibility.value === 'private' && !password.value) {
    error.value = 'Please choose a password for a private event.'
    return
  }

  saving.value = true

  try {
    const created = await createEvent({
      title: title.value.trim(),
      date: date.value,
      place: place.value.trim(),
      description: description.value.trim(),
      categoryId: categoryId.value,
      createdBy: currentUser.value.id,
      participants: [currentUser.value.id],
      visibility: visibility.value,
      password: visibility.value === 'private' ? password.value : '',
    })
    await loadEvents()
    router.push(`/events/${created.id}`)
  } catch {
    error.value = 'Could not save the event.'
    saving.value = false
  }
}
</script>

<template>
  <form class="detail-card" @submit.prevent="saveEvent">
    <h2>New event</h2>
    <p class="muted">
      {{
        visibility === 'private'
          ? 'Only people with the password can open and join this event.'
          : 'Other accounts can join this event after you save it.'
      }}
    </p>

    <div class="field">
      <label for="title">Title</label>
      <input id="title" v-model="title" />
    </div>

    <div class="field">
      <label for="date">Date</label>
      <input id="date" v-model="date" type="date" />
    </div>

    <div class="field">
      <label for="place">Place</label>
      <input id="place" v-model="place" />
    </div>

    <div class="field">
      <label for="category">Category</label>
      <select id="category" v-model="categoryId">
        <option value="" disabled>Choose a category</option>
        <option v-for="category in categories" :key="category.id" :value="category.id">
          {{ category.name }}
        </option>
      </select>
    </div>

    <div class="field">
      <label for="description">Description</label>
      <textarea id="description" v-model="description" rows="4"></textarea>
    </div>

    <fieldset class="field choices">
      <legend>Who can open it</legend>
      <div class="choice-row">
        <label class="choice">
          <input v-model="visibility" type="radio" value="public" />
          Public
        </label>
        <label class="choice">
          <input v-model="visibility" type="radio" value="private" />
          Private
        </label>
      </div>
    </fieldset>

    <div v-if="visibility === 'private'" class="field">
      <label for="event-password">Password</label>
      <input id="event-password" v-model="password" type="password" autocomplete="new-password" />
    </div>

    <p v-if="error" class="error">{{ error }}</p>

    <button type="submit" :disabled="saving">
      {{ saving ? 'Saving...' : 'Save event' }}
    </button>
  </form>
</template>
