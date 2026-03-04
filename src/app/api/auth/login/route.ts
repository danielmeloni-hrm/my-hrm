import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function POST(request: NextRequest) {
  const { email, password } = await request.json()

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  console.log('🔧 SUPABASE_URL is set?', !!supabaseUrl)
  console.log('🔧 SUPABASE_ANON_KEY is set?', !!supabaseKey)
  console.log('📨 Login attempt:', email)

  if (!supabaseUrl || !supabaseKey) {
    console.log('❌ Missing env vars')
    return NextResponse.json(
      { ok: false, message: 'Server misconfigured: missing Supabase env vars' },
      { status: 500 }
    )
  }

  const response = NextResponse.json({ ok: true })

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options)
        })
      },
    },
  })

  const { data, error } = await supabase.auth.signInWithPassword({
    email: String(email || '').trim(),
    password: String(password || ''),
  })

  if (error) {
    console.log('❌ Login FAILED:', error.message)
    return NextResponse.json({ ok: false, message: error.message }, { status: 401 })
  }

  console.log('✅ Login SUCCESS:', data.user?.email, data.user?.id)
  console.log('🍪 Cookies set count:', response.cookies.getAll().length)

  return response
}