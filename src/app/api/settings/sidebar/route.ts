import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

type SidebarPosition = 'left' | 'right' | 'bottom'
type IconType = 'lucide' | 'emoji'

type SidebarItemConfig = {
  iconType: IconType
  icon: string
  emoji: string
  color: string
}

type SidebarItemsConfig = Record<string, SidebarItemConfig>

type SidebarRequestBody = {
  sidebar_visible_paths?: unknown
  sidebar_position?: unknown
  sidebar_items_config?: unknown
}

function isValidSidebarPosition(value: unknown): value is SidebarPosition {
  return value === 'left' || value === 'right' || value === 'bottom'
}

function isValidSidebarItemsConfig(value: unknown): value is SidebarItemsConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false

  return Object.values(value).every((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return false

    const config = item as Record<string, unknown>
    const validIconType = config.iconType === 'lucide' || config.iconType === 'emoji'

    return (
      validIconType &&
      typeof config.icon === 'string' &&
      typeof config.emoji === 'string' &&
      typeof config.color === 'string'
    )
  })
}

export async function GET() {
  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll() {},
      },
    }
  )

  const { data: userData, error: userErr } = await supabase.auth.getUser()

  if (userErr || !userData.user) {
    return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 })
  }

  const userId = userData.user.id

  const [
    { data: preferencesData, error: preferencesError },
    { data: profiloData, error: profiloError },
  ] = await Promise.all([
    supabase
      .from('user_preferences')
      .select('sidebar_visible_paths, sidebar_items_config')
      .eq('user_id', userId)
      .maybeSingle(),

    supabase
      .from('profili')
      .select('sidebar_position')
      .eq('id', userId)
      .maybeSingle(),
  ])

  if (preferencesError) {
    return NextResponse.json({ ok: false, message: preferencesError.message }, { status: 500 })
  }

  if (profiloError) {
    return NextResponse.json({ ok: false, message: profiloError.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    sidebar_visible_paths: preferencesData?.sidebar_visible_paths ?? null,
    sidebar_position: isValidSidebarPosition(profiloData?.sidebar_position)
      ? profiloData.sidebar_position
      : 'left',
    sidebar_items_config: isValidSidebarItemsConfig(preferencesData?.sidebar_items_config)
      ? preferencesData.sidebar_items_config
      : {},
  })
}

export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  const body: SidebarRequestBody = await request.json().catch(() => ({}))

  const sidebar_visible_paths: string[] = Array.isArray(body.sidebar_visible_paths)
    ? body.sidebar_visible_paths.filter((v: unknown): v is string => typeof v === 'string')
    : []

  const sidebar_position: SidebarPosition = isValidSidebarPosition(body.sidebar_position)
    ? body.sidebar_position
    : 'left'

  const sidebar_items_config: SidebarItemsConfig = isValidSidebarItemsConfig(
    body.sidebar_items_config
  )
    ? body.sidebar_items_config
    : {}

  const response = NextResponse.json({
    ok: true,
    sidebar_visible_paths,
    sidebar_position,
    sidebar_items_config,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const { data: userData, error: userErr } = await supabase.auth.getUser()

  if (userErr || !userData.user) {
    return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 })
  }

  const userId = userData.user.id

  const [preferencesResult, profiloResult] = await Promise.all([
    supabase.from('user_preferences').upsert(
      {
        user_id: userId,
        sidebar_visible_paths,
        sidebar_items_config,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    ),

    supabase
      .from('profili')
      .update({
        sidebar_position,
      })
      .eq('id', userId),
  ])

  if (preferencesResult.error) {
    return NextResponse.json(
      { ok: false, message: preferencesResult.error.message },
      { status: 500 }
    )
  }

  if (profiloResult.error) {
    return NextResponse.json({ ok: false, message: profiloResult.error.message }, { status: 500 })
  }

  return response
}