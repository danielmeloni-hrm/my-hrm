'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase'
import type { LucideIcon } from 'lucide-react'
import {
  Check,
  Loader2,
  Save,
  User,
  Lock,
  LayoutGrid,
  PanelLeft,
  PanelRight,
  PanelBottom,
  PlusCircle,
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

type AvailableIcon = {
  key: string
  label: string
  Icon: LucideIcon
}

export default function SettingsPage() {
  const supabase = createClient()

  const availableIcons: AvailableIcon[] = useMemo(
    () => [
      { key: 'PlusCircle', label: 'Plus', Icon: PlusCircle },
      { key: 'LayoutGrid', label: 'Grid', Icon: LayoutGrid },
      { key: 'StickyNote', label: 'Note', Icon: StickyNote },
      { key: 'Ticket', label: 'Ticket', Icon: Ticket },
      { key: 'Kanban', label: 'Kanban', Icon: Kanban },
      { key: 'CalendarDays', label: 'Calendar', Icon: CalendarDays },
      { key: 'BarChart3', label: 'Report', Icon: BarChart3 },
      { key: 'KeyRound', label: 'Key', Icon: KeyRound },
      { key: 'BookMarked', label: 'Book', Icon: BookMarked },
      { key: 'Home', label: 'Home', Icon: Home },
      { key: 'FileText', label: 'File', Icon: FileText },
      { key: 'Database', label: 'Database', Icon: Database },
      { key: 'FolderKanban', label: 'Folder', Icon: FolderKanban },
      { key: 'ClipboardList', label: 'List', Icon: ClipboardList },
    ],
    []
  )

  const availableColors = useMemo(
    () => [
      '#0150a0',
      '#2563eb',
      '#16a34a',
      '#dc2626',
      '#9333ea',
      '#ea580c',
      '#0891b2',
      '#4b5563',
      '#111827',
      '#db2777',
    ],
    []
  )

  const availableEmojis = useMemo(
    () => [
      '➕',
      '📊',
      '📝',
      '📌',
      '📁',
      '📂',
      '📅',
      '🗓️',
      '🎯',
      '✅',
      '🚀',
      '⚙️',
      '🔐',
      '🔑',
      '🧾',
      '📈',
      '📉',
      '🛠️',
      '🔥',
      '⭐',
      '💼',
      '🧩',
      '📋',
      '🗂️',
      '🚨',
      '🔄',
      '📦',
      '🏷️',
      '🖥️',
      '💡',
    ],
    []
  )

  const allMenuItems: MenuItem[] = useMemo(
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
      },      {
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

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [userEmail, setUserEmail] = useState('')
  const [userId, setUserId] = useState('')

  const [selectedPaths, setSelectedPaths] = useState<string[]>([])
  const [sidebarPosition, setSidebarPosition] = useState<SidebarPosition>('left')
  const [itemsConfig, setItemsConfig] = useState<SidebarItemsConfig>({})

  const [iconModalPath, setIconModalPath] = useState<string | null>(null)
  const [iconModalTab, setIconModalTab] = useState<IconType>('lucide')

  const [saveMsg, setSaveMsg] = useState('')

  const [newPassword, setNewPassword] = useState('')
  const [pwdLoading, setPwdLoading] = useState(false)
  const [pwdMsg, setPwdMsg] = useState('')

  const buildDefaultItemsConfig = (): SidebarItemsConfig => {
    return allMenuItems.reduce<SidebarItemsConfig>((acc, item) => {
      acc[item.path] = {
        iconType: 'lucide',
        icon: item.defaultIcon,
        emoji: item.defaultEmoji,
        color: item.defaultColor,
      }

      return acc
    }, {})
  }

  const normalizeStoredConfig = (
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

  const getIconComponent = (iconKey: string) => {
    return availableIcons.find((icon) => icon.key === iconKey)?.Icon ?? LayoutGrid
  }

  const getItemFallback = (path: string) => {
    const item = allMenuItems.find((menuItem) => menuItem.path === path)

    return {
      iconType: 'lucide' as IconType,
      icon: item?.defaultIcon ?? 'LayoutGrid',
      emoji: item?.defaultEmoji ?? '📌',
      color: item?.defaultColor ?? '#0150a0',
    }
  }

  const updateItemLucideIcon = (path: string, icon: string) => {
    setSaveMsg('')
    setItemsConfig((prev) => {
      const fallback = getItemFallback(path)
      const current = prev[path] ?? fallback

      return {
        ...prev,
        [path]: {
          ...current,
          iconType: 'lucide',
          icon,
        },
      }
    })
  }

  const updateItemEmoji = (path: string, emoji: string) => {
    setSaveMsg('')
    setItemsConfig((prev) => {
      const fallback = getItemFallback(path)
      const current = prev[path] ?? fallback

      return {
        ...prev,
        [path]: {
          ...current,
          iconType: 'emoji',
          emoji,
        },
      }
    })
  }

  const updateItemColor = (path: string, color: string) => {
    setSaveMsg('')
    setItemsConfig((prev) => {
      const fallback = getItemFallback(path)
      const current = prev[path] ?? fallback

      return {
        ...prev,
        [path]: {
          ...current,
          color,
        },
      }
    })
  }

  useEffect(() => {
    let mounted = true

    async function init() {
      setLoading(true)
      setSaveMsg('')
      setPwdMsg('')

      const { data: u } = await supabase.auth.getUser()
      if (!mounted) return

      setUserEmail(u.user?.email ?? '')
      setUserId(u.user?.id ?? '')

      const defaultConfig = buildDefaultItemsConfig()

      try {
        const res = await fetch('/api/settings/sidebar', { method: 'GET', cache: 'no-store' })
        const json: SidebarSettingsResponse | null = await res.json().catch(() => null)

        const storedPaths = json?.sidebar_visible_paths
        const storedPosition = json?.sidebar_position
        const storedItemsConfig = json?.sidebar_items_config

        setSelectedPaths(
          Array.isArray(storedPaths) && storedPaths.length > 0
            ? storedPaths
            : allMenuItems.map((m) => m.path)
        )

        setSidebarPosition(
          storedPosition === 'left' || storedPosition === 'right' || storedPosition === 'bottom'
            ? storedPosition
            : 'left'
        )

        setItemsConfig(normalizeStoredConfig(storedItemsConfig, defaultConfig))
      } catch {
        setSelectedPaths(allMenuItems.map((m) => m.path))
        setSidebarPosition('left')
        setItemsConfig(defaultConfig)
      }

      setLoading(false)
    }

    init()

    return () => {
      mounted = false
    }
  }, [supabase, allMenuItems])

  const togglePath = (path: string) => {
    setSaveMsg('')
    setSelectedPaths((prev) =>
      prev.includes(path) ? prev.filter((p) => p !== path) : [...prev, path]
    )
  }

  const saveSidebar = async () => {
    setSaving(true)
    setSaveMsg('')

    try {
      const res = await fetch('/api/settings/sidebar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sidebar_visible_paths: selectedPaths,
          sidebar_position: sidebarPosition,
          sidebar_items_config: itemsConfig,
        }),
      })

      if (!res.ok) {
        setSaveMsg('Errore durante il salvataggio della sidebar.')
        setSaving(false)
        return
      }

      window.dispatchEvent(new Event('sidebar-updated'))
      setSaveMsg('Impostazioni sidebar aggiornate con successo.')
    } catch {
      setSaveMsg('Errore durante il salvataggio della sidebar.')
    } finally {
      setSaving(false)
    }
  }

  const changePassword = async () => {
    setPwdLoading(true)
    setPwdMsg('')

    const res = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newPassword }),
    })

    const j = await res.json().catch(() => null)

    if (!res.ok) {
      setPwdMsg(j?.message || 'Errore cambio password.')
      setPwdLoading(false)
      return
    }

    setPwdMsg('Password aggiornata con successo.')
    setNewPassword('')
    setPwdLoading(false)
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="flex items-center gap-2 text-gray-500">
          <Loader2 className="animate-spin" />
          Caricamento impostazioni...
        </div>
      </div>
    )
  }

  const modalConfig = iconModalPath ? itemsConfig[iconModalPath] ?? getItemFallback(iconModalPath) : null
  const ModalPreviewIcon = modalConfig ? getIconComponent(modalConfig.icon) : LayoutGrid

  return (
    <div className="p-8 max-w-6xl">
      <h1 className="text-2xl font-black tracking-tight text-gray-900 mb-6">Impostazioni</h1>

      <section className="bg-white border border-gray-100 rounded-3xl p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-2xl bg-gray-100">
            <User className="text-gray-700" />
          </div>
          <h2 className="font-black text-gray-900">Dettagli account</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100">
            <div className="text-[10px] font-black uppercase tracking-widest text-gray-400">
              Email
            </div>
            <div className="font-bold text-gray-900 break-all">{userEmail || '-'}</div>
          </div>

          <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100">
            <div className="text-[10px] font-black uppercase tracking-widest text-gray-400">
              User ID
            </div>
            <div className="font-mono text-xs text-gray-800 break-all">{userId || '-'}</div>
          </div>
        </div>
      </section>

      <section className="bg-white border border-gray-100 rounded-3xl p-6 mb-6">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-2xl bg-gray-100">
              <LayoutGrid className="text-gray-700" />
            </div>
            <div>
              <h2 className="font-black text-gray-900">Sidebar</h2>
              <p className="text-xs text-gray-500">
                Scegli pagine, posizione, icona Lucide, emoji e colore.
              </p>
            </div>
          </div>

          <button
            onClick={saveSidebar}
            disabled={saving}
            className="px-4 py-2 rounded-xl bg-[#0150a0] hover:bg-[#013d7a] text-white font-black text-xs flex items-center gap-2 disabled:opacity-60"
          >
            {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
            Salva
          </button>
        </div>

        {saveMsg && <div className="mb-4 text-sm font-bold text-gray-700">{saveMsg}</div>}

        <div className="mb-6">
          <div className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">
            Posizione sidebar
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              {
                key: 'left' as SidebarPosition,
                title: 'Sinistra',
                description: 'Sidebar fissa a sinistra.',
                Icon: PanelLeft,
              },
              {
                key: 'right' as SidebarPosition,
                title: 'Destra',
                description: 'Sidebar fissa a destra.',
                Icon: PanelRight,
              },
              {
                key: 'bottom' as SidebarPosition,
                title: 'Sotto',
                description: 'Solo icone visibili, nome pagina su hover.',
                Icon: PanelBottom,
              },
            ].map((positionItem) => {
              const active = sidebarPosition === positionItem.key

              return (
                <button
                  key={positionItem.key}
                  type="button"
                  onClick={() => {
                    setSidebarPosition(positionItem.key)
                    setSaveMsg('')
                  }}
                  className={`rounded-2xl border p-4 text-left transition ${
                    active ? 'border-blue-200 bg-blue-50/40' : 'border-gray-100 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="p-2 rounded-xl bg-white border border-gray-100">
                      <positionItem.Icon className="text-gray-700" size={18} />
                    </div>

                    <div
                      className={`w-7 h-7 rounded-xl flex items-center justify-center ${
                        active ? 'bg-[#0150a0] text-white' : 'bg-gray-100 text-gray-400'
                      }`}
                    >
                      <Check size={16} />
                    </div>
                  </div>

                  <div className="font-black text-sm text-gray-900">{positionItem.title}</div>
                  <div className="text-xs text-gray-500 mt-1">{positionItem.description}</div>
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <div className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">
            Pagine visibili e icona
          </div>

          <div className="grid grid-cols-1 gap-3">
            {allMenuItems.map((item) => {
              const checked = selectedPaths.includes(item.path)
              const currentConfig = itemsConfig[item.path] ?? getItemFallback(item.path)
              const PreviewIcon = getIconComponent(currentConfig.icon)

              return (
                <div
                  key={`${item.path}-${item.name}`}
                  className={`rounded-2xl border p-4 transition ${
                    checked ? 'border-blue-200 bg-blue-50/30' : 'border-gray-100 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <button
                        type="button"
                        onClick={() => {
                          setIconModalPath(item.path)
                          setIconModalTab(currentConfig.iconType ?? 'lucide')
                        }}
                        className="w-11 h-11 rounded-2xl flex items-center justify-center bg-white border border-gray-100 shrink-0 hover:scale-105 transition"
                        style={{ color: currentConfig.color }}
                        title="Modifica icona"
                      >
                        {currentConfig.iconType === 'emoji' ? (
                          <span className="text-2xl leading-none">{currentConfig.emoji}</span>
                        ) : (
                          <PreviewIcon size={21} strokeWidth={2.1} />
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => togglePath(item.path)}
                        className="text-left min-w-0"
                      >
                        <div className="font-bold text-gray-900 text-sm">{item.name}</div>
                        <div className="text-xs text-gray-400 truncate">{item.path}</div>
                        <div className="text-[10px] font-black uppercase tracking-widest text-gray-400 mt-1">
                          {currentConfig.iconType === 'emoji' ? 'Emoji' : 'Lucide'} · clicca
                          sull’icona per modificare
                        </div>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => togglePath(item.path)}
                      className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${
                        checked ? 'bg-[#0150a0] text-white' : 'bg-gray-100 text-gray-400'
                      }`}
                    >
                      <Check size={16} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      <section className="bg-white border border-gray-100 rounded-3xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-2xl bg-gray-100">
            <Lock className="text-gray-700" />
          </div>

          <div>
            <h2 className="font-black text-gray-900">Password</h2>
            <p className="text-xs text-gray-500">Cambia la password dell’account.</p>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-3">
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="flex-1 px-4 py-3 rounded-2xl border border-gray-200 outline-none focus:ring-2 focus:ring-[#0150a0] text-black"
            placeholder="Nuova password (min 8 caratteri)"
          />

          <button
            onClick={changePassword}
            disabled={pwdLoading || newPassword.length < 8}
            className="px-4 py-3 rounded-2xl bg-[#0150a0] hover:bg-[#013d7a] text-white font-black text-xs disabled:opacity-60"
          >
            {pwdLoading ? 'Aggiornamento...' : 'Aggiorna password'}
          </button>
        </div>

        {pwdMsg && <div className="mt-3 text-sm font-bold text-gray-700">{pwdMsg}</div>}
      </section>

      {iconModalPath && modalConfig && (
        <div className="fixed inset-0 z-[100] bg-black/30 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl rounded-3xl bg-white border border-gray-100 shadow-2xl p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-2xl border border-gray-100 bg-white flex items-center justify-center"
                  style={{ color: modalConfig.color }}
                >
                  {modalConfig.iconType === 'emoji' ? (
                    <span className="text-3xl leading-none">{modalConfig.emoji}</span>
                  ) : (
                    <ModalPreviewIcon size={24} strokeWidth={2.1} />
                  )}
                </div>

                <div>
                  <h3 className="font-black text-gray-900">Personalizza icona</h3>
                  <p className="text-xs text-gray-500">{iconModalPath}</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIconModalPath(null)}
                className="w-9 h-9 rounded-xl bg-gray-100 hover:bg-gray-200 font-black text-gray-600"
              >
                ×
              </button>
            </div>

            <div className="flex gap-2 mb-5 rounded-2xl bg-gray-100 p-1">
              <button
                type="button"
                onClick={() => setIconModalTab('lucide')}
                className={`flex-1 rounded-xl py-2 text-xs font-black transition ${
                  iconModalTab === 'lucide' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
                }`}
              >
                Icone Lucide
              </button>

              <button
                type="button"
                onClick={() => setIconModalTab('emoji')}
                className={`flex-1 rounded-xl py-2 text-xs font-black transition ${
                  iconModalTab === 'emoji' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
                }`}
              >
                Emoji
              </button>
            </div>

            {iconModalTab === 'lucide' && (
              <>
                <div className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">
                  Icona
                </div>

                <div className="grid grid-cols-6 sm:grid-cols-8 gap-2 mb-5">
                  {availableIcons.map((iconItem) => {
                    const IconComponent = iconItem.Icon
                    const active =
                      modalConfig.iconType === 'lucide' && modalConfig.icon === iconItem.key

                    return (
                      <button
                        key={iconItem.key}
                        type="button"
                        title={iconItem.label}
                        onClick={() => updateItemLucideIcon(iconModalPath, iconItem.key)}
                        className={`h-11 rounded-2xl border flex items-center justify-center transition ${
                          active ? 'border-blue-300 bg-blue-50' : 'border-gray-100 hover:bg-gray-50'
                        }`}
                        style={{ color: modalConfig.color }}
                      >
                        <IconComponent size={20} strokeWidth={2.1} />
                      </button>
                    )
                  })}
                </div>

                <div className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">
                  Colore
                </div>

                <div className="flex flex-wrap gap-2">
                  {availableColors.map((color) => {
                    const active = modalConfig.color === color

                    return (
                      <button
                        key={color}
                        type="button"
                        onClick={() => updateItemColor(iconModalPath, color)}
                        className={`w-10 h-10 rounded-2xl border flex items-center justify-center transition ${
                          active ? 'border-gray-900 scale-105' : 'border-gray-200 hover:scale-105'
                        }`}
                        style={{ backgroundColor: color }}
                      >
                        {active && <Check size={16} className="text-white" />}
                      </button>
                    )
                  })}
                </div>
              </>
            )}

            {iconModalTab === 'emoji' && (
              <>
                <div className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">
                  Emoji
                </div>

                <div className="grid grid-cols-6 sm:grid-cols-10 gap-2">
                  {availableEmojis.map((emoji) => {
                    const active =
                      modalConfig.iconType === 'emoji' && modalConfig.emoji === emoji

                    return (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => updateItemEmoji(iconModalPath, emoji)}
                        className={`h-12 rounded-2xl border text-2xl flex items-center justify-center transition ${
                          active ? 'border-blue-300 bg-blue-50' : 'border-gray-100 hover:bg-gray-50'
                        }`}
                      >
                        {emoji}
                      </button>
                    )
                  })}
                </div>
              </>
            )}

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setIconModalPath(null)}
                className="px-4 py-2 rounded-xl bg-[#0150a0] text-white font-black text-xs"
              >
                Fatto
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}