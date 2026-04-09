import { create } from 'zustand'
import api from '@/lib/api'

const getToken = () => localStorage.getItem('token') ?? sessionStorage.getItem('token')
const getActiveEvent = () => JSON.parse(localStorage.getItem('activeEvent') ?? sessionStorage.getItem('activeEvent') ?? 'null')

export const useAuthStore = create((set) => ({
  token: getToken(),
  user: null,
  activeEvent: getActiveEvent(),

  login: async (email, password, remember = false) => {
    const { data } = await api.post('/auth/login', { email, password })
    const storage = remember ? localStorage : sessionStorage
    storage.setItem('token', data.token)
    const activeEvent = data.user.event ?? null
    if (activeEvent) {
      storage.setItem('activeEvent', JSON.stringify(activeEvent))
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
    sessionStorage.removeItem('token')
    sessionStorage.removeItem('activeEvent')
    set({ token: null, user: null, activeEvent: null })
  },
}))
