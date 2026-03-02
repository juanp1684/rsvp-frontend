import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { useThemeStore } from '@/store/themeStore'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { Menu, Moon, Sun, ArrowLeftRight } from 'lucide-react'

const navItems = [
  { to: '/', label: 'Dashboard' },
  { to: '/invitees', label: 'Invitees' },
  { to: '/event', label: 'Event' },
]

function NavLinks({ onNavigate, itemClassName = '' }) {
  return navItems.map(({ to, label }) => (
    <NavLink
      key={to}
      to={to}
      end={to === '/'}
      onClick={onNavigate}
      className={({ isActive }) =>
        `text-sm transition-colors ${itemClassName} ${isActive ? 'text-foreground font-medium' : 'text-muted-foreground hover:text-foreground'}`
      }
    >
      {label}
    </NavLink>
  ))
}

export default function AdminLayout() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const logout = useAuthStore((s) => s.logout)
  const user = useAuthStore((s) => s.user)
  const activeEvent = useAuthStore((s) => s.activeEvent)
  const navigate = useNavigate()
  const dark = useThemeStore((s) => s.dark)
  const toggleTheme = useThemeStore((s) => s.toggle)
  const isSuperAdmin = user?.role === 'super_admin'

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <div className={`${dark ? 'dark' : ''} min-h-screen flex flex-col bg-background text-foreground`}>
      <header className="sticky top-0 z-10 border-b px-4 py-3 flex items-center justify-between gap-4 bg-background">
        <div className="flex items-center gap-4">
          {/* Mobile menu */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className={`${dark ? 'dark' : ''} w-64 pt-10 px-4 pb-6 flex flex-col bg-background text-foreground`}>
              <nav className="flex flex-col gap-5 text-base">
                <NavLinks onNavigate={() => setMobileOpen(false)} />
              </nav>
              <div className="mt-auto flex flex-col gap-3">
                {user && <p className="text-sm text-muted-foreground">{user.name}</p>}
                {isSuperAdmin && (
                  <Button variant="outline" className="w-full" onClick={() => { setMobileOpen(false); navigate('/events') }}>
                    <ArrowLeftRight className="h-4 w-4 mr-2" />
                    Switch event
                  </Button>
                )}
                <Button variant="outline" className="w-full" onClick={toggleTheme}>
                  {dark ? <Sun className="h-4 w-4 mr-2" /> : <Moon className="h-4 w-4 mr-2" />}
                  {dark ? 'Light mode' : 'Dark mode'}
                </Button>
                <Button variant="outline" className="w-full" onClick={handleLogout}>
                  Log out
                </Button>
              </div>
            </SheetContent>
          </Sheet>

          <div className="flex flex-col">
            <span className="font-semibold text-sm">RSVP Admin</span>
            {activeEvent && (
              <span className="text-xs text-muted-foreground leading-none">{activeEvent.name}</span>
            )}
          </div>

          {/* Desktop nav */}
          <nav className="hidden md:flex gap-5 ml-4">
            <NavLinks />
          </nav>
        </div>

        {/* Desktop user + logout */}
        <div className="hidden md:flex items-center gap-3">
          {user && <span className="text-sm text-muted-foreground">{user.name}</span>}
          {isSuperAdmin && (
            <Button variant="ghost" size="sm" onClick={() => navigate('/events')}>
              <ArrowLeftRight className="h-4 w-4 mr-1" />
              Switch
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={toggleTheme}>
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <Button variant="outline" size="sm" onClick={handleLogout}>
            Log out
          </Button>
        </div>
      </header>

      <main className="flex-1 p-4 md:p-6 max-w-5xl mx-auto w-full">
        <Outlet />
      </main>
    </div>
  )
}
