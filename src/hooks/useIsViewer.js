import { useAuthStore } from '@/store/authStore'

export function useIsViewer() {
  return useAuthStore((s) => s.user?.role === 'viewer')
}
