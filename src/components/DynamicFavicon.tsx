'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

type IconType = 'lucide' | 'emoji'

type SidebarItemConfig = {
  iconType: IconType
  icon: string
  emoji: string
  color: string
}

type SidebarItemsConfig = Record<string, SidebarItemConfig>

type SidebarSettingsResponse = {
  sidebar_items_config?: Partial<Record<string, Partial<SidebarItemConfig>>>
}

const defaultConfig: SidebarItemsConfig = {
  '/new_ticket': { iconType: 'lucide', icon: 'PlusCircle', emoji: '➕', color: '#0150a0' },
  '/dashboard_in_lavorazione': { iconType: 'lucide', icon: 'LayoutGrid', emoji: '📊', color: '#2563eb' },
  '/note_board': { iconType: 'lucide', icon: 'StickyNote', emoji: '📝', color: '#9333ea' },
  '/dashboard': { iconType: 'lucide', icon: 'Kanban', emoji: '🚀', color: '#16a34a' },
  '/dashboard_opex': { iconType: 'lucide', icon: 'Kanban', emoji: '🛠️', color: '#ea580c' },
  '/tutti-i-ticket': { iconType: 'lucide', icon: 'Ticket', emoji: '🎫', color: '#0150a0' },
  '/tutti-gli-incident': { iconType: 'lucide', icon: 'Ticket', emoji: '🚨', color: '#dc2626' },
  '/changes': { iconType: 'lucide', icon: 'Ticket', emoji: '🔄', color: '#0891b2' },
  '/progetti': { iconType: 'lucide', icon: 'BookMarked', emoji: '📁', color: '#4b5563' },
  '/calendario': { iconType: 'lucide', icon: 'CalendarDays', emoji: '📅', color: '#16a34a' },
  '/calendario_chg': { iconType: 'lucide', icon: 'CalendarDays', emoji: '🗓️', color: '#0891b2' },
  '/report_progetti': { iconType: 'lucide', icon: 'BarChart3', emoji: '📈', color: '#9333ea' },
  '/password': { iconType: 'lucide', icon: 'KeyRound', emoji: '🔐', color: '#111827' },
  '/settings': { iconType: 'lucide', icon: 'Settings', emoji: '⚙️', color: '#4b5563' },
}

const iconPaths: Record<string, string> = {
  PlusCircle: `<circle cx="12" cy="12" r="10"/><path d="M8 12h8"/><path d="M12 8v8"/>`,
  LayoutGrid: `<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>`,
  StickyNote: `<path d="M16 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8Z"/><path d="M15 3v5h5"/>`,
  Ticket: `<path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M13 5v2"/><path d="M13 17v2"/><path d="M13 11v2"/>`,
  Kanban: `<path d="M6 5v11"/><path d="M12 5v6"/><path d="M18 5v14"/><rect width="18" height="18" x="3" y="3" rx="2"/>`,
  CalendarDays: `<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/><path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/><path d="M8 18h.01"/><path d="M12 18h.01"/><path d="M16 18h.01"/>`,
  BarChart3: `<path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>`,
  KeyRound: `<path d="M2 18v3h3l9.5-9.5"/><circle cx="16" cy="8" r="5"/>`,
  BookMarked: `<path d="M10 2v8l3-3 3 3V2"/><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/>`,
  Home: `<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2h-4v-7H9v7H5a2 2 0 0 1-2-2Z"/>`,
  FileText: `<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v6h6"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>`,
  Database: `<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5"/><path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3"/>`,
  FolderKanban: `<path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/><path d="M8 10v6"/><path d="M12 10v4"/><path d="M16 10v8"/>`,
  ClipboardList: `<rect width="8" height="4" x="8" y="2" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/>`,
  Settings: `<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.51a2 2 0 0 1 1-1.72l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2Z"/><circle cx="12" cy="12" r="3"/>`,
}

function normalizePathname(pathname: string) {
  if (pathname === '/') return pathname
  return pathname.replace(/\/$/, '')
}

function sanitizeColor(color?: string) {
  return color && /^#[0-9A-Fa-f]{6}$/.test(color) ? color : '#0150a0'
}

function escapeXml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

function normalizeConfig(
  storedConfig: SidebarSettingsResponse['sidebar_items_config']
): SidebarItemsConfig {
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

function createLucideFaviconSvg(iconKey: string, color: string) {
  const paths = iconPaths[iconKey] ?? iconPaths.LayoutGrid
  const safeColor = sanitizeColor(color)

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">
      <rect width="256" height="256" rx="56" fill="${safeColor}"/>
      <g
        transform="translate(28 28) scale(8.35)"
        fill="none"
        stroke="white"
        stroke-width="2.45"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        ${paths}
      </g>
    </svg>
  `
}

function createEmojiFaviconSvg(emoji: string, color: string) {
  const safeColor = sanitizeColor(color)
  const safeEmoji = escapeXml(emoji || '📌')

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">
     
      <text
        x="50%"
        y="54%"
        text-anchor="middle"
        dominant-baseline="middle"
        font-size="250"
      >
        ${safeEmoji}
      </text>
    </svg>
  `
}

function createFaviconSvg(config: SidebarItemConfig) {
  if (config.iconType === 'emoji') {
    return createEmojiFaviconSvg(config.emoji, config.color)
  }

  return createLucideFaviconSvg(config.icon, config.color)
}

function setFavicon(svg: string) {
  const href = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`

  const existingIcons = document.querySelectorAll<HTMLLinkElement>(
    "link[rel='icon'], link[rel='shortcut icon']"
  )

  existingIcons.forEach((link) => {
    link.href = href
    link.type = 'image/svg+xml'
    link.setAttribute('data-dynamic-favicon', 'true')
  })

  let dynamicIcon = document.querySelector<HTMLLinkElement>(
    "link[data-dynamic-main-favicon='true']"
  )

  if (!dynamicIcon) {
    dynamicIcon = document.createElement('link')
    dynamicIcon.rel = 'icon'
    dynamicIcon.type = 'image/svg+xml'
    dynamicIcon.setAttribute('data-dynamic-main-favicon', 'true')
    document.head.appendChild(dynamicIcon)
  }

  dynamicIcon.href = href
}

export default function DynamicFavicon() {
  const pathname = usePathname()

  useEffect(() => {
    let cancelled = false

    const updateFavicon = async () => {
      const currentPath = normalizePathname(pathname)

      try {
        const res = await fetch('/api/settings/sidebar', {
          cache: 'no-store',
        })

        const json: SidebarSettingsResponse | null = await res.json().catch(() => null)

        if (cancelled) return

        const config = normalizeConfig(json?.sidebar_items_config)
        const pageConfig =
          config[currentPath] ?? {
            iconType: 'lucide',
            icon: 'LayoutGrid',
            emoji: '📌',
            color: '#0150a0',
          }

        setFavicon(createFaviconSvg(pageConfig))
      } catch {
        if (cancelled) return

        const fallback =
          defaultConfig[currentPath] ?? {
            iconType: 'lucide',
            icon: 'LayoutGrid',
            emoji: '📌',
            color: '#0150a0',
          }

        setFavicon(createFaviconSvg(fallback))
      }
    }

    updateFavicon()

    window.addEventListener('sidebar-updated', updateFavicon)

    return () => {
      cancelled = true
      window.removeEventListener('sidebar-updated', updateFavicon)
    }
  }, [pathname])

  return null
}