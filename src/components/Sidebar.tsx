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
  ClipboardList,Mail,
  Bot,
  Menu,
  X,
  Users,
} from 'lucide-react'

import { getSidebarPalette, isHexColor } from '@/lib/sidebar-color'

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
  sidebar_color?: string | null
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
  const [mobileOpen, setMobileOpen] = useState(false)
  const [visiblePaths, setVisiblePaths] = useState<string[] | null>(null)
  const [position, setPosition] = useState<SidebarPosition>('left')
  const [itemsConfig, setItemsConfig] = useState<SidebarItemsConfig>({})
  const [sidebarColor, setSidebarColor] = useState<string | null>(null)

  const pathname = usePathname()
  const router = useRouter()

  // Su mobile il menu è un pannello sovrapposto: si chiude cambiando pagina.
  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  // Blocca lo scorrimento della pagina mentre il pannello è aperto.
  useEffect(() => {
    if (typeof document === 'undefined') return

    document.body.style.overflow = mobileOpen ? 'hidden' : ''

    return () => {
      document.body.style.overflow = ''
    }
  }, [mobileOpen])

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
      ClipboardList, Mail,
    Bot,
    Users,
    }),
    []
  )

  const menuItems: MenuItem[] = useMemo(
    () => [
      {
        name: 'Home',
        path: '/home',
        defaultIcon: 'Home',
        defaultEmoji: '🏠',
        defaultColor: '#0150a0',
      },
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
        name: 'Email',
        path: '/topic_email',
        defaultIcon: 'Mail',
        defaultEmoji: '➕',
        defaultColor: '#0150a0',
      },
      {
        name: 'Documenti & Progetti',
        path: '/progetti',
        defaultIcon: 'BookMarked',
        defaultEmoji: '📁',
        defaultColor: '#4b5563',
      },
      {
        name: 'Flussi Operativi',
        path: '/flussi_operativi',
        defaultIcon: 'ClipboardList',
        defaultEmoji: '🔀',
        defaultColor: '#0e7490',
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
//      {name: 'Assistente AI',         path: '/ai',         defaultIcon: 'Bot', defaultEmoji: '🤖',         defaultColor: '#00529F',      },
      {
        name: 'Risorse',
        path: '/risorse',
        defaultIcon: 'Users',
        defaultEmoji: '🧑‍💻',
        defaultColor: '#7c3aed',
      },
      {
        name: 'Clienti',
        path: '/clienti',
        defaultIcon: 'Users',
        defaultEmoji: '👥',
        defaultColor: '#00529F',
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

  // Colori derivati dallo sfondo scelto: testo e superfici si adattano da soli.
  const palette = getSidebarPalette(sidebarColor)

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

        setSidebarColor(isHexColor(j?.sidebar_color) ? j.sidebar_color : null)
        setItemsConfig(normalizeItemsConfig(j?.sidebar_items_config, defaultConfig))
      } catch {
        setVisiblePaths(null)
        setPosition('left')
        setItemsConfig(defaultConfig)
      }
    }

    loadSidebar()

    // Anteprima dal vivo: le impostazioni inviano il colore mentre lo scegli,
    // senza aspettare il salvataggio.
    const onPreview = (event: Event) => {
      const detail = (event as CustomEvent<string | null>).detail
      setSidebarColor(isHexColor(detail) ? detail : null)
    }

    window.addEventListener('sidebar-updated', loadSidebar)
    window.addEventListener('sidebar-color-preview', onPreview)

    return () => {
      window.removeEventListener('sidebar-updated', loadSidebar)
      window.removeEventListener('sidebar-color-preview', onPreview)
    }
  }, [menuItems])

  const filteredMenu = useMemo(() => {
    // Le voci nuove (aggiunte dopo il salvataggio delle preferenze utente)
    // sono visibili di default finché l'utente non risalva le impostazioni
    const NEW_DEFAULT_VISIBLE_PATHS = ['/flussi_operativi', '/home', '/risorse']

    return visiblePaths
      ? menuItems.filter(
          (m) =>
            visiblePaths.includes(m.path) ||
            NEW_DEFAULT_VISIBLE_PATHS.includes(m.path)
        )
      : menuItems
  }, [menuItems, visiblePaths])

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
    router.replace('/login')
    router.refresh()
  }

  useEffect(() => {
  if (position !== 'bottom') {
    document.body.style.paddingBottom = ''
    return
  }

  document.body.style.paddingBottom = '112px'

  return () => {
    document.body.style.paddingBottom = ''
  }
}, [position])

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
      <>
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

                  <div className="pointer-events-none absolute bottom-full mb-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-xl bg-black px-2.5 py-1.5 text-[11px] font-bold text-[#ffffff] opacity-0 shadow-lg transition-opacity duration-200 group-hover:opacity-100">
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
              <div className="pointer-events-none absolute bottom-full mb-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-xl bg-black px-2.5 py-1.5 text-[11px] font-bold text-[#ffffff] opacity-0 shadow-lg transition-opacity duration-200 group-hover:opacity-100">
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
              <div className="pointer-events-none absolute bottom-full mb-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-xl bg-black px-2.5 py-1.5 text-[11px] font-bold text-[#ffffff] opacity-0 shadow-lg transition-opacity duration-200 group-hover:opacity-100">
                Apri Opex
              </div>
            </a>

            <Link
              href="/settings"
              className="group relative h-12 w-12 rounded-2xl flex items-center justify-center transition text-gray-500 hover:bg-gray-100 hover:text-gray-900"
            >
              <Settings size={20} strokeWidth={2.1} />
              <div className="pointer-events-none absolute bottom-full mb-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-xl bg-black px-2.5 py-1.5 text-[11px] font-bold text-[#ffffff] opacity-0 shadow-lg transition-opacity duration-200 group-hover:opacity-100">
                Impostazioni
              </div>
            </Link>

            <button
              onClick={handleLogout}
              className="group relative h-12 w-12 rounded-2xl flex items-center justify-center transition text-red-500 hover:bg-red-50"
            >
              <LogOut size={20} strokeWidth={2.1} />
              <div className="pointer-events-none absolute bottom-full mb-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-xl bg-black px-2.5 py-1.5 text-[11px] font-bold text-[#ffffff] opacity-0 shadow-lg transition-opacity duration-200 group-hover:opacity-100">
                Logout
              </div>
            </button>
          </div>
        </div>
      </div> <div aria-hidden="true" className="h-28 shrink-0" />
    </>
    )
  }

  const isRight = position === 'right'

  return (
    <>
      {/* Barra superiore: solo su mobile, apre il pannello di navigazione */}
      <div className="fixed inset-x-0 top-0 z-40 flex h-14 items-center gap-3 border-b border-gray-100 bg-white px-4 md:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-100 bg-white text-gray-600 shadow-sm"
          aria-label="Apri il menu"
        >
          <Menu size={18} />
        </button>

        <Link href="/home" className="flex items-center gap-2">
          <Image
            src="/brand/hrmgroup_logo.jpg"
            alt="HRM"
            width={26}
            height={26}
            className="object-contain"
          />
          <span className="font-black tracking-tighter text-base text-gray-900">
            my<span className="text-[var(--brand)]">HRM</span>
          </span>
        </Link>
      </div>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

    <aside
      style={{
        backgroundColor: palette.background,
        borderColor: palette.bordo,
        color: palette.testo,
      }}
      className={`fixed inset-y-0 z-50 flex h-screen flex-col bg-white border-gray-100 shadow-sm transition-transform duration-300 md:relative md:translate-x-0 md:transition-all ${
        isCollapsed ? 'md:w-[70px]' : 'md:w-[260px]'
      } w-[260px] ${isRight ? 'right-0 border-l md:order-last' : 'left-0 border-r'} ${
        mobileOpen
          ? 'translate-x-0'
          : isRight
            ? 'translate-x-full'
            : '-translate-x-full'
      }`}
    >
      <button
        type="button"
        onClick={() => setMobileOpen(false)}
        className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-xl bg-gray-50 text-gray-500 md:hidden"
        aria-label="Chiudi il menu"
      >
        <X size={16} />
      </button>

      <Link
        href="/home"
        className={`flex items-center gap-3 overflow-hidden group cursor-pointer ${
          isCollapsed ? 'justify-center px-3 py-6' : 'p-6'
        }`}
      >
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
          <span
            className="font-black tracking-tighter text-lg text-gray-900 whitespace-nowrap"
            style={{ color: palette.testoForte }}
          >
            my
            <span
              className="text-[var(--brand)]"
              style={{ color: palette.scuro ? '#93c5fd' : undefined }}
            >
              HRM
            </span>
          </span>
        )}
      </Link>

      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className={`absolute top-16 hidden bg-white border border-gray-100 rounded-full p-1 shadow-md hover:text-[var(--brand)] transition-colors z-50 md:block ${
          isRight ? '-left-3' : '-right-3'
        }`}
        aria-label="Toggle sidebar"
      >
        {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>

      <nav
        className={`flex-1 space-y-2 mt-4 overflow-y-auto overflow-x-hidden ${
          isCollapsed ? 'px-3' : 'px-4'
        }`}
      >
        {filteredMenu.map((item, index) => {
          const isExternal = item.path.startsWith('http')
          const isActive = !isExternal && pathname === item.path
          const config = getItemConfig(item)

          const content = (
            <>
              <div
                className={`shrink-0 h-8 w-8 rounded-lg flex items-center justify-center transition-colors ${
                  isActive || palette.background ? 'bg-white' : 'group-hover:bg-white'
                }`}
                style={{
                  color: config.iconType === 'emoji' ? undefined : config.color,
                  // Con sfondo personalizzato il riquadro icona resta sempre bianco.
                  backgroundColor: palette.background ? '#ffffff' : undefined,
                }}
              >
                {renderMenuIcon(config, 18, 2.1, 'text-lg leading-none')}
              </div>

              {!isCollapsed && (
                <div className="flex items-center justify-between w-full min-w-0">
                  <span
                    className="text-[13px] font-bold tracking-tight whitespace-nowrap"
                    style={{
                      color: palette.background
                        ? isActive
                          ? palette.testoForte
                          : palette.testo
                        : isActive
                          ? config.color
                          : undefined,
                    }}
                  >
                    {item.name}
                  </span>
                </div>
              )}
            </>
          )

          // Con sfondo personalizzato i colori arrivano dalla palette,
          // altrimenti restano quelli predefiniti.
          const allineamento = isCollapsed
            ? 'justify-center gap-0'
            : 'gap-3'

          const className = palette.background
            ? `flex items-center ${allineamento} p-2 rounded-xl transition-all group`
            : `flex items-center ${allineamento} p-2 rounded-xl transition-all group ${
                isActive
                  ? 'bg-blue-50 shadow-sm shadow-blue-100/50'
                  : 'text-gray-400 hover:bg-gray-50 hover:text-gray-900'
              }`

          const style = palette.background
            ? {
                backgroundColor: isActive ? palette.attivoBg : 'transparent',
                color: isActive ? palette.testoForte : palette.testo,
              }
            : undefined

          const onEnter = (event: React.MouseEvent<HTMLElement>) => {
            if (!palette.background || isActive) return
            event.currentTarget.style.backgroundColor = palette.hoverBg ?? ''
          }

          const onLeave = (event: React.MouseEvent<HTMLElement>) => {
            if (!palette.background || isActive) return
            event.currentTarget.style.backgroundColor = 'transparent'
          }

          return isExternal ? (
            <a
              key={`${item.path}-${index}`}
              href={item.path}
              target="_blank"
              rel="noopener noreferrer"
              className={className}
              style={style}
              onMouseEnter={onEnter}
              onMouseLeave={onLeave}
            >
              {content}
            </a>
          ) : (
            <Link
              key={item.path}
              href={item.path}
              className={className}
              style={style}
              onMouseEnter={onEnter}
              onMouseLeave={onLeave}
            >
              {content}
            </Link>
          )
        })}
      </nav>

      <div className={isCollapsed ? 'pt-3 px-3' : 'pt-3 px-3'}>
          <div className={`grid gap-2 ${isCollapsed ? 'grid-cols-1' : 'grid-cols-2'}`}>
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

      <div
        className={`border-t border-gray-50 space-y-2 py-4 ${
          isCollapsed ? 'px-3' : 'px-4'
        }`}
      >
        <Link
          href="/settings"
          className={`w-full flex items-center p-2 text-gray-400 hover:text-gray-900 transition-all overflow-hidden rounded-xl hover:bg-gray-50 group ${
            isCollapsed ? 'justify-center' : 'gap-3'
          }`}
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
          className={`w-full flex items-center p-2 text-red-400 hover:bg-red-50 rounded-xl transition-all overflow-hidden group ${
            isCollapsed ? 'justify-center' : 'gap-3'
          }`}
        >
          <div className="shrink-0 h-8 w-8 rounded-lg flex items-center justify-center group-hover:bg-white">
            <LogOut size={18} strokeWidth={2.1} />
          </div>

          {!isCollapsed && <span className="text-[13px] font-bold whitespace-nowrap">Logout</span>}
        </button>
      </div>
    </aside>
    </>
    
  )
}