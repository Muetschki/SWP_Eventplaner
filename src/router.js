import { createRouter, createWebHistory } from 'vue-router'
import LoginView from './views/LoginView.vue'
import RegisterView from './views/RegisterView.vue'
import EventsView from './views/EventsView.vue'
import EventEmptyView from './views/EventEmptyView.vue'
import EventFormView from './views/EventFormView.vue'
import EventDetailView from './views/EventDetailView.vue'
import { currentUser } from './auth.js'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/events' },
    { path: '/login', component: LoginView },
    { path: '/register', component: RegisterView },
    {
      path: '/events',
      component: EventsView,
      children: [
        { path: '', component: EventEmptyView },
        { path: 'new', component: EventFormView },
        { path: ':id', component: EventDetailView },
      ],
    },
  ],
})

const publicPaths = ['/login', '/register']

router.beforeEach((to) => {
  const isPublic = publicPaths.includes(to.path)

  if (!isPublic && !currentUser.value) {
    return '/login'
  }
  if (isPublic && currentUser.value) {
    return '/events'
  }
})

export default router
