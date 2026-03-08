'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutGrid,
  Ticket,
  ChevronLeft,
  ChevronRight,
  Settings,
  BarChart3,
  LogOut,
  Layers,
} from 'lucide-react'

type MenuItem = {
  name: string
  path: string
  icon: React.ReactNode
}

export default function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [visiblePaths, setVisiblePaths] = useState<string[] | null>(null) // null => mostra tutto
  const pathname = usePathname()
  const router = useRouter()

  const menuItems: MenuItem[] = useMemo(
    () => [
      { name: 'Nuova Attività', icon: <LayoutGrid size={20} />, path: '/new_ticket' },
      { name: 'Attività in Lavorazione', icon: <LayoutGrid size={20} />, path: '/dashboard_in_lavorazione' },
      { name: 'Note Board', icon: <LayoutGrid size={20} />, path: '/note_board' },
      { name: 'Sprint Board', icon: <LayoutGrid size={20} />, path: '/dashboard' },
      { name: 'Opex Board', icon: <Layers size={20} />, path: '/dashboard_opex' },
     
      { name: 'Tutti Ticket', icon: <Ticket size={20} />, path: '/tutti-i-ticket' },
      { name: 'Tutte le Change', icon: <Ticket size={20} />, path: '/changes' },
      { name: 'Calendario Rilasci', icon: <BarChart3 size={20} />, path: '/calendario' },
      { name: 'Calendario Rilasci CHG', icon: <BarChart3 size={20} />, path: '/calendario_chg' },
      { name: 'Report', icon: <BarChart3 size={20} />, path: '/report_progetti' },
    ],
    []
  )

  

  // Carica preferenze sidebar (se esistono)
  useEffect(() => {
    const loadSidebar = async () => {
      try {
        const res = await fetch('/api/settings/sidebar')
        const j = await res.json().catch(() => null)

        if (Array.isArray(j?.sidebar_visible_paths) && j.sidebar_visible_paths.length > 0) {
          setVisiblePaths(j.sidebar_visible_paths)
        } else {
          setVisiblePaths(null)
        }
      } catch {
        setVisiblePaths(null)
      }
    }

    loadSidebar()

    // 👇 ascolta aggiornamenti dalla pagina impostazioni
    const handleUpdate = () => {
      loadSidebar()
    }

    window.addEventListener('sidebar-updated', handleUpdate)

    return () => {
      window.removeEventListener('sidebar-updated', handleUpdate)
    }
  }, [])

  const filteredMenu = useMemo(() => {
    return visiblePaths ? menuItems.filter(m => visiblePaths.includes(m.path)) : menuItems
  }, [menuItems, visiblePaths])

  const handleLogout = async () => {
  await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
  router.replace('/login')
  router.refresh()
}

  return (
    <aside
      className={`relative flex flex-col h-screen bg-white border-r border-gray-100 transition-all duration-300 shadow-sm z-50 ${
        isCollapsed ? 'w-[70px]' : 'w-[260px]'
      }`}
    >
      {/* HEADER LOGO */}
      <Link href="/" className="p-6 flex items-center gap-3 overflow-hidden group cursor-pointer">
        <div className="min-w-[32px] h-8 flex items-center justify-center shrink-0">
          <Image
            src="/brand/hrmgroup_logo.jpg"
            alt="HRM"
            width={32}
            height={32}
            className="object-contain"
            priority
          />
        </div>

        {!isCollapsed && (
          <span className="font-black tracking-tighter text-lg text-gray-900 whitespace-nowrap">
            my<span className="text-[#0150a0]">HRM</span>
          </span>
        )}
      </Link>

      {/* TOGGLE */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -right-3 top-16 bg-white border border-gray-100 rounded-full p-1 shadow-md hover:text-[#0150a0] transition-colors z-50"
        aria-label="Toggle sidebar"
      >
        {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>

      {/* MENU */}
      <nav className="flex-1 px-4 space-y-2 mt-4 overflow-y-auto overflow-x-hidden">
        {filteredMenu.map((item) => {
          const isActive = pathname === item.path

          return (
            <Link
              key={item.name}
              href={item.path}
              className={`flex items-center gap-4 p-3 rounded-xl transition-all group ${
                isActive
                  ? 'bg-blue-50 text-[#0150a0] shadow-sm shadow-blue-100/50'
                  : 'text-gray-400 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <div className={`shrink-0 transition-colors ${isActive ? 'text-[#0150a0]' : 'group-hover:text-gray-900'}`}>
                {item.icon}
              </div>

              {!isCollapsed && (
                <span className="text-[13px] font-bold tracking-tight whitespace-nowrap">
                  {item.name}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* FOOTER */}
      <div className="p-4 border-t border-gray-50 space-y-2">
        <Link
          href="/settings"
          className="w-full flex items-center gap-4 p-3 text-gray-400 hover:text-gray-900 transition-all overflow-hidden rounded-xl hover:bg-gray-50"
        >
          <Settings size={20} className="shrink-0" />
          {!isCollapsed && <span className="text-[13px] font-bold whitespace-nowrap">Impostazioni</span>}
        </Link>

        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-4 p-3 text-red-400 hover:bg-red-50 rounded-xl transition-all overflow-hidden"
        >
          <LogOut size={20} className="shrink-0" />
          {!isCollapsed && <span className="text-[13px] font-bold whitespace-nowrap">Logout</span>}
        </button>
      </div>
    </aside>
  )
}