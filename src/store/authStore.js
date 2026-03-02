import { create } from 'zustand'
import api from '@/lib/api'

export const useAuthStore = create((set) => ({
  token: localStorage.getItem('token'),
  user: null,
  activeEvent: JSON.parse(localStorage.getItem('activeEvent') ?? 'null'),

  login: async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password })
    localStorage.setItem('token', data.token)
    const activeEvent = data.user.event ?? null
    if (activeEvent) {
      localStorage.setItem('activeEvent', JSON.stringify(activeEvent))
    }
    set({ token: data.token, user: data.user, activeEvent })
  },

  setActiveEvent: (event) => {
    localStorage.setItem('activeEvent', JSON.stringify(event))
    set({ activeEvent: event })
  },

  logout: async () => {
    await api.post('/auth/logout').catch(() => {})
    localStorage.removeItem('token')
    localStorage.removeItem('activeEvent')
    set({ token: null, user: null, activeEvent: null })
  },
}))
