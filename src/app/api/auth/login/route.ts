import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function POST(request: NextRequest) {
  const { email, password } = await request.json()

  console.log("📨 Login attempt:", email)

  const response = NextResponse.json({ ok: true })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
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
    }
  )

  const { data, error } = await supabase.auth.signInWithPassword({
    email: String(email || '').trim(),
    password: String(password || ''),
  })

  if (error) {
    console.log("❌ Login FAILED:", error.message)

    return NextResponse.json(
      { ok: false, message: 'Email o password non corretti' },
      { status: 401 }
    )
  }

  console.log("✅ Login SUCCESS")
  console.log("👤 User:", data.user?.email)
  console.log("🆔 User ID:", data.user?.id)

  return response
}