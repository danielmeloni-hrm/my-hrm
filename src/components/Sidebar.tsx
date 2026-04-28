'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import type { LucideIcon } from 'lucide-react'
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
  Home,
  FileText,
  Database,
  FolderKanban,
  ClipboardList,
} from 'lucide-react'

type IconType = 'lucide' | 'emoji'

type MenuItem = {
  name: string
  path: string
  defaultIcon: string
  defaultEmoji: string
  defaultColor: string
}

type SidebarPosition = 'left' | 'right' | 'bottom'

type SidebarItemConfig = {
  iconType: IconType
  icon: string
  emoji: string
  color: string
}

type SidebarItemsConfig = Record<string, SidebarItemConfig>

type SidebarSettingsResponse = {
  sidebar_visible_paths?: string[]
  sidebar_position?: SidebarPosition
  sidebar_items_config?: Partial<Record<string, Partial<SidebarItemConfig>>>
}

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
  const [itemsConfig, setItemsConfig] = useState<SidebarItemsConfig>({})

  const pathname = usePathname()
  const router = useRouter()

  const iconMap: Record<string, LucideIcon> = useMemo(
    () => ({
      PlusCircle,
      LayoutGrid,
      StickyNote,
      Ticket,
      Kanban,
      CalendarDays,
      BarChart3,
      KeyRound,
      BookMarked,
      Home,
      FileText,
      Database,
      FolderKanban,
      ClipboardList,
    }),
    []
  )

  const menuItems: MenuItem[] = useMemo(
    () => [
      {
        name: 'Nuova Attività',
        path: '/new_ticket',
        defaultIcon: 'PlusCircle',
        defaultEmoji: '➕',
        defaultColor: '#0150a0',
      },
      {
        name: 'Attività in Lavorazione',
        path: '/dashboard_in_lavorazione',
        defaultIcon: 'LayoutGrid',
        defaultEmoji: '📊',
        defaultColor: '#2563eb',
      },
      {
        name: 'Note Board',
        path: '/note_board',
        defaultIcon: 'StickyNote',
        defaultEmoji: '📝',
        defaultColor: '#9333ea',
      },
      {
        name: 'Sprint Board',
        path: '/dashboard',
        defaultIcon: 'Kanban',
        defaultEmoji: '🚀',
        defaultColor: '#16a34a',
      },
      {
        name: 'Opex Board',
        path: '/dashboard_opex',
        defaultIcon: 'Kanban',
        defaultEmoji: '🛠️',
        defaultColor: '#ea580c',
      },
      {
        name: 'Tutte Attività',
        path: '/tutti-i-ticket',
        defaultIcon: 'Ticket',
        defaultEmoji: '🎫',
        defaultColor: '#0150a0',
      },
      {
        name: 'Tutti Incident',
        path: '/tutti-gli-incident',
        defaultIcon: 'Ticket',
        defaultEmoji: '🚨',
        defaultColor: '#dc2626',
      },
      {
        name: 'Tutte le Change',
        path: '/changes',
        defaultIcon: 'Ticket',
        defaultEmoji: '🔄',
        defaultColor: '#0891b2',
      },
      {
        name: 'Documenti & Progetti',
        path: '/progetti',
        defaultIcon: 'BookMarked',
        defaultEmoji: '📁',
        defaultColor: '#4b5563',
      },
      {
        name: 'Calendario Rilasci',
        path: '/calendario',
        defaultIcon: 'CalendarDays',
        defaultEmoji: '📅',
        defaultColor: '#16a34a',
      },
      {
        name: 'Calendario Rilasci CHG',
        path: '/calendario_chg',
        defaultIcon: 'CalendarDays',
        defaultEmoji: '🗓️',
        defaultColor: '#0891b2',
      },
      {
        name: 'Report',
        path: '/report_progetti',
        defaultIcon: 'BarChart3',
        defaultEmoji: '📈',
        defaultColor: '#9333ea',
      },
      {
        name: 'Password',
        path: '/password',
        defaultIcon: 'KeyRound',
        defaultEmoji: '🔐',
        defaultColor: '#111827',
      },
    ],
    []
  )

  const buildDefaultItemsConfig = (): SidebarItemsConfig => {
    return menuItems.reduce<SidebarItemsConfig>((acc, item) => {
      acc[item.path] = {
        iconType: 'lucide',
        icon: item.defaultIcon,
        emoji: item.defaultEmoji,
        color: item.defaultColor,
      }

      return acc
    }, {})
  }

  const normalizeItemsConfig = (
    storedConfig: SidebarSettingsResponse['sidebar_items_config'],
    defaultConfig: SidebarItemsConfig
  ): SidebarItemsConfig => {
    const merged: SidebarItemsConfig = { ...defaultConfig }

    Object.entries(storedConfig ?? {}).forEach(([path, config]) => {
      const fallback = defaultConfig[path]

      if (!fallback) return

      merged[path] = {
        iconType:
          config?.iconType === 'emoji' || config?.iconType === 'lucide'
            ? config.iconType
            : fallback.iconType,
        icon: typeof config?.icon === 'string' ? config.icon : fallback.icon,
        emoji: typeof config?.emoji === 'string' ? config.emoji : fallback.emoji,
        color: typeof config?.color === 'string' ? config.color : fallback.color,
      }
    })

    return merged
  }

  const getItemConfig = (item: MenuItem): SidebarItemConfig => {
    return (
      itemsConfig[item.path] ?? {
        iconType: 'lucide',
        icon: item.defaultIcon,
        emoji: item.defaultEmoji,
        color: item.defaultColor,
      }
    )
  }

  const getIconComponent = (iconKey: string): LucideIcon => {
    return iconMap[iconKey] ?? LayoutGrid
  }

  useEffect(() => {
    const loadSidebar = async () => {
      const defaultConfig = buildDefaultItemsConfig()

      try {
        const res = await fetch('/api/settings/sidebar', {
          cache: 'no-store',
        })

        const j: SidebarSettingsResponse | null = await res.json().catch(() => null)

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

        setItemsConfig(normalizeItemsConfig(j?.sidebar_items_config, defaultConfig))
      } catch {
        setVisiblePaths(null)
        setPosition('left')
        setItemsConfig(defaultConfig)
      }
    }

    loadSidebar()

    window.addEventListener('sidebar-updated', loadSidebar)

    return () => {
      window.removeEventListener('sidebar-updated', loadSidebar)
    }
  }, [menuItems])

  const filteredMenu = useMemo(() => {
    return visiblePaths ? menuItems.filter((m) => visiblePaths.includes(m.path)) : menuItems
  }, [menuItems, visiblePaths])

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
    router.replace('/login')
    router.refresh()
  }

  const renderMenuIcon = (
    config: SidebarItemConfig,
    size: number,
    strokeWidth = 2.1,
    emojiClassName = 'text-lg leading-none'
  ) => {
    if (config.iconType === 'emoji') {
      return <span className={emojiClassName}>{config.emoji}</span>
    }

    const Icon = getIconComponent(config.icon)

    return <Icon size={size} strokeWidth={strokeWidth} />
  }

  if (position === 'bottom') {
    return (
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[70]">
        <div className="rounded-[28px] border border-gray-200 bg-white/95 backdrop-blur-md shadow-2xl px-3 py-3">
          <div className="flex items-center gap-2">
            {filteredMenu.map((item, index) => {
              const isExternal = item.path.startsWith('http')
              const isActive = !isExternal && pathname === item.path
              const config = getItemConfig(item)

              const commonClass = `group relative h-12 w-12 rounded-2xl flex items-center justify-center transition ${
                isActive ? 'bg-blue-50 shadow-sm' : 'hover:bg-gray-100'
              }`

              const content = (
                <>
                  <div
                    className="h-9 w-9 rounded-xl flex items-center justify-center transition"
                    style={{
                      color: config.iconType === 'emoji' ? undefined : config.color,
                    }}
                  >
                    {renderMenuIcon(config, 19, 2.1, 'text-xl leading-none')}
                  </div>

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
              <Settings size={20} strokeWidth={2.1} />
              <div className="pointer-events-none absolute bottom-full mb-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-xl bg-black px-2.5 py-1.5 text-[11px] font-bold text-white opacity-0 shadow-lg transition-opacity duration-200 group-hover:opacity-100">
                Impostazioni
              </div>
            </Link>

            <button
              onClick={handleLogout}
              className="group relative h-12 w-12 rounded-2xl flex items-center justify-center transition text-red-500 hover:bg-red-50"
            >
              <LogOut size={20} strokeWidth={2.1} />
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
          const config = getItemConfig(item)

          const content = (
            <>
              <div
                className={`shrink-0 h-8 w-8 rounded-lg flex items-center justify-center transition-colors ${
                  isActive ? 'bg-white' : 'group-hover:bg-white'
                }`}
                style={{
                  color: config.iconType === 'emoji' ? undefined : config.color,
                }}
              >
                {renderMenuIcon(config, 18, 2.1, 'text-lg leading-none')}
              </div>

              {!isCollapsed && (
                <div className="flex items-center justify-between w-full min-w-0">
                  <span
                    className="text-[13px] font-bold tracking-tight whitespace-nowrap"
                    style={{ color: isActive ? config.color : undefined }}
                  >
                    {item.name}
                  </span>
                </div>
              )}
            </>
          )

          const className = `flex items-center gap-3 p-2 rounded-xl transition-all group ${
            isActive
              ? 'bg-blue-50 shadow-sm shadow-blue-100/50'
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
          className="w-full flex items-center gap-3 p-2 text-gray-400 hover:text-gray-900 transition-all overflow-hidden rounded-xl hover:bg-gray-50 group"
        >
          <div className="shrink-0 h-8 w-8 rounded-lg flex items-center justify-center group-hover:bg-white">
            <Settings size={18} strokeWidth={2.1} />
          </div>

          {!isCollapsed && (
            <span className="text-[13px] font-bold whitespace-nowrap">Impostazioni</span>
          )}
        </Link>

        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 p-2 text-red-400 hover:bg-red-50 rounded-xl transition-all overflow-hidden group"
        >
          <div className="shrink-0 h-8 w-8 rounded-lg flex items-center justify-center group-hover:bg-white">
            <LogOut size={18} strokeWidth={2.1} />
          </div>

          {!isCollapsed && <span className="text-[13px] font-bold whitespace-nowrap">Logout</span>}
        </button>
      </div>
    </aside>
  )
}