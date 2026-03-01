import { create } from 'zustand'
import api from '@/lib/api'

export const useAuthStore = create((set) => ({
  token: localStorage.getItem('token'),
  user: null,

  login: async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password })
    localStorage.setItem('token', data.token)
    set({ token: data.token, user: data.user })
  },

  logout: async () => {
    await api.post('/auth/logout').catch(() => {})
    localStorage.removeItem('token')
    set({ token: null, user: null })
  },
}))
