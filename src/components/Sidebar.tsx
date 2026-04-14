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
  PlusCircle,
  StickyNote,
  Kanban,
  CalendarDays,
  KeyRound,
  BookMarked,
} from 'lucide-react'

type MenuItem = {
  name: string
  path: string
  icon: React.ReactNode
}

type SidebarPosition = 'left' | 'right' | 'bottom'

function ServiceTag() {
  return (
    <div className="relative w-8 h-8 shrink-0">
      <Image
        src="/brand/servicenow-sprint.png"
        alt="ServiceNow Sprint"
        fill
        className="object-contain"
      />
    </div>
  )
}

function ServiceINC() {
  return (
    <div className="relative w-8 h-8 shrink-0">
      <Image
        src="/brand/servicenow-opex.png"
        alt="ServiceNow Opex"
        fill
        className="object-contain"
      />
    </div>
  )
}

export default function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [visiblePaths, setVisiblePaths] = useState<string[] | null>(null)
  const [position, setPosition] = useState<SidebarPosition>('left')

  const pathname = usePathname()
  const router = useRouter()

  const menuItems: MenuItem[] = useMemo(
    () => [
      { name: 'Nuova Attività', icon: <PlusCircle size={20} />, path: '/new_ticket' },
      { name: 'Attività in Lavorazione', icon: <LayoutGrid size={20} />, path: '/dashboard_in_lavorazione' },
      { name: 'Note Board', icon: <StickyNote size={20} />, path: '/note_board' },
      { name: 'Sprint Board', icon: <Kanban size={20} />, path: '/dashboard' },
      { name: 'Opex Board', icon: <Kanban size={20} />, path: '/dashboard_opex' },
      { name: 'Tutte Attività', icon: <Ticket size={20} />, path: '/tutti-i-ticket' },
      { name: 'Tutti Incident', icon: <Ticket size={20} />, path: '/tutti-gli-incident' },
      { name: 'Tutte le Change', icon: <Ticket size={20} />, path: '/changes' },
      { name: 'Documenti & Progetti', icon: <BookMarked size={20} />, path: '/progetti' },
      { name: 'Calendario Rilasci', icon: <CalendarDays size={20} />, path: '/calendario' },
      { name: 'Calendario Rilasci CHG', icon: <CalendarDays size={20} />, path: '/calendario_chg' },
      { name: 'Report', icon: <BarChart3 size={20} />, path: '/report_progetti' },
      { name: 'Password', icon: <KeyRound size={20} />, path: '/password' },
    ],
    []
  )

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

        if (
          j?.sidebar_position === 'left' ||
          j?.sidebar_position === 'right' ||
          j?.sidebar_position === 'bottom'
        ) {
          setPosition(j.sidebar_position)
        } else {
          setPosition('left')
        }
      } catch {
        setVisiblePaths(null)
        setPosition('left')
      }
    }

    loadSidebar()

    const handleUpdate = () => {
      loadSidebar()
    }

    window.addEventListener('sidebar-updated', handleUpdate)

    return () => {
      window.removeEventListener('sidebar-updated', handleUpdate)
    }
  }, [])

  const filteredMenu = useMemo(() => {
    return visiblePaths ? menuItems.filter((m) => visiblePaths.includes(m.path)) : menuItems
  }, [menuItems, visiblePaths])

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
    router.replace('/login')
    router.refresh()
  }

  if (position === 'bottom') {
    return (
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[70]">
        <div className="rounded-[28px] border border-gray-200 bg-white/95 backdrop-blur-md shadow-2xl px-3 py-3">
          <div className="flex items-center gap-2">
            {filteredMenu.map((item, index) => {
              const isExternal = item.path.startsWith('http')
              const isActive = !isExternal && pathname === item.path

              const commonClass = `group relative h-12 w-12 rounded-2xl flex items-center justify-center transition ${
                isActive
                  ? 'bg-blue-50 text-[#0150a0] shadow-sm'
                  : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
              }`

              const content = (
                <>
                  <div>{item.icon}</div>
                  <div className="pointer-events-none absolute bottom-full mb-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-xl bg-black px-2.5 py-1.5 text-[11px] font-bold text-white opacity-0 shadow-lg transition-opacity duration-200 group-hover:opacity-100">
                    {item.name}
                  </div>
                </>
              )

              return isExternal ? (
                <a
                  key={`${item.path}-${index}`}
                  href={item.path}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={commonClass}
                >
                  {content}
                </a>
              ) : (
                <Link key={item.path} href={item.path} className={commonClass}>
                  {content}
                </Link>
              )
            })}

            <a
              href="https://esselunga.service-now.com/rm_story_list.do?sysparm_view=unified_agile_board&sysparm_query=^ORDERBYglobal_rank^sprint=acddf36f2beef2d0bad7f0b16e91bfd1^assignment_group=4ea500b11bee0914efde5421604bcb5d"
              target="_blank"
              rel="noopener noreferrer"
              className="group relative h-12 w-12 rounded-2xl flex items-center justify-center transition text-gray-500 hover:bg-gray-100 hover:text-gray-900"
            >
              <ServiceTag />
              <div className="pointer-events-none absolute bottom-full mb-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-xl bg-black px-2.5 py-1.5 text-[11px] font-bold text-white opacity-0 shadow-lg transition-opacity duration-200 group-hover:opacity-100">
                Apri Sprint
              </div>
            </a>

            <a
              href="https://esselunga.service-now.com/rm_story_list.do?sysparm_view=unified_agile_board&sysparm_query=^ORDERBYglobal_rank^sprint=c424047b2be236d0bad7f0b16e91bffe^assignment_group=6b47e7723385fa18cf0f7e282e5c7b6d"
              target="_blank"
              rel="noopener noreferrer"
              className="group relative h-12 w-12 rounded-2xl flex items-center justify-center transition text-gray-500 hover:bg-gray-100 hover:text-gray-900"
            >
              <ServiceINC />
              <div className="pointer-events-none absolute bottom-full mb-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-xl bg-black px-2.5 py-1.5 text-[11px] font-bold text-white opacity-0 shadow-lg transition-opacity duration-200 group-hover:opacity-100">
                Apri Opex
              </div>
            </a>

            <Link
              href="/settings"
              className="group relative h-12 w-12 rounded-2xl flex items-center justify-center transition text-gray-500 hover:bg-gray-100 hover:text-gray-900"
            >
              <Settings size={20} />
              <div className="pointer-events-none absolute bottom-full mb-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-xl bg-black px-2.5 py-1.5 text-[11px] font-bold text-white opacity-0 shadow-lg transition-opacity duration-200 group-hover:opacity-100">
                Impostazioni
              </div>
            </Link>

            <button
              onClick={handleLogout}
              className="group relative h-12 w-12 rounded-2xl flex items-center justify-center transition text-red-500 hover:bg-red-50"
            >
              <LogOut size={20} />
              <div className="pointer-events-none absolute bottom-full mb-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-xl bg-black px-2.5 py-1.5 text-[11px] font-bold text-white opacity-0 shadow-lg transition-opacity duration-200 group-hover:opacity-100">
                Logout
              </div>
            </button>
          </div>
        </div>
      </div>
    )
  }

  const isRight = position === 'right'

  return (
    <aside
      className={`relative flex flex-col h-screen bg-white border-gray-100 transition-all duration-300 shadow-sm z-50 ${
        isCollapsed ? 'w-[70px]' : 'w-[260px]'
      } ${isRight ? 'border-l order-last' : 'border-r'}`}
    >
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

      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className={`absolute top-16 bg-white border border-gray-100 rounded-full p-1 shadow-md hover:text-[#0150a0] transition-colors z-50 ${
          isRight ? '-left-3' : '-right-3'
        }`}
        aria-label="Toggle sidebar"
      >
        {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>

      <nav className="flex-1 px-4 space-y-2 mt-4 overflow-y-auto overflow-x-hidden">
        {filteredMenu.map((item, index) => {
          const isExternal = item.path.startsWith('http')
          const isActive = !isExternal && pathname === item.path

          const content = (
            <>
              <div
                className={`shrink-0 transition-colors ${
                  isActive ? 'text-[#0150a0]' : 'group-hover:text-gray-900'
                }`}
              >
                {item.icon}
              </div>

              {!isCollapsed && (
                <div className="flex items-center justify-between w-full min-w-0">
                  <span className="text-[13px] font-bold tracking-tight whitespace-nowrap">
                    {item.name}
                  </span>
                </div>
              )}
            </>
          )

          const className = `flex items-center gap-4 p-3 rounded-xl transition-all group ${
            isActive
              ? 'bg-blue-50 text-[#0150a0] shadow-sm shadow-blue-100/50'
              : 'text-gray-400 hover:bg-gray-50 hover:text-gray-900'
          }`

          return isExternal ? (
            <a
              key={`${item.path}-${index}`}
              href={item.path}
              target="_blank"
              rel="noopener noreferrer"
              className={className}
            >
              {content}
            </a>
          ) : (
            <Link key={item.path} href={item.path} className={className}>
              {content}
            </Link>
          )
        })}
      </nav>

      {!isCollapsed && (
        <div className="pt-3 px-3">
          <div className="grid grid-cols-2 gap-2">
            <a
              href="https://esselunga.service-now.com/rm_story_list.do?sysparm_view=unified_agile_board&sysparm_query=^ORDERBYglobal_rank^sprint=acddf36f2beef2d0bad7f0b16e91bfd1^assignment_group=4ea500b11bee0914efde5421604bcb5d"
              target="_blank"
              rel="noopener noreferrer"
              className="relative group h-16 rounded-2xl overflow-hidden border border-gray-100 bg-white hover:bg-gray-50 transition-all"
            >
              <div className="absolute inset-0 flex items-center justify-center transition-all duration-300 group-hover:scale-75 group-hover:opacity-20">
                <ServiceTag />
              </div>

              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300">
                <span className="text-[11px] font-black text-gray-800 tracking-wide">
                  Apri Sprint
                </span>
              </div>
            </a>

            <a
              href="https://esselunga.service-now.com/rm_story_list.do?sysparm_view=unified_agile_board&sysparm_query=^ORDERBYglobal_rank^sprint=c424047b2be236d0bad7f0b16e91bffe^assignment_group=6b47e7723385fa18cf0f7e282e5c7b6d"
              target="_blank"
              rel="noopener noreferrer"
              className="relative group h-16 rounded-2xl overflow-hidden border border-gray-100 bg-white hover:bg-gray-50 transition-all"
            >
              <div className="absolute inset-0 flex items-center justify-center transition-all duration-300 group-hover:scale-75 group-hover:opacity-20">
                <ServiceINC />
              </div>

              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300">
                <span className="text-[11px] font-black text-gray-800 tracking-wide">
                  Apri Opex
                </span>
              </div>
            </a>
          </div>
        </div>
      )}

      <div className="p-4 border-t border-gray-50 space-y-2">
        <Link
          href="/settings"
          className="w-full flex items-center gap-4 p-3 text-gray-400 hover:text-gray-900 transition-all overflow-hidden rounded-xl hover:bg-gray-50"
        >
          <Settings size={20} className="shrink-0" />
          {!isCollapsed && (
            <span className="text-[13px] font-bold whitespace-nowrap">Impostazioni</span>
          )}
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