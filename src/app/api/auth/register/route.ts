import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function POST(request: NextRequest) {
  const { email, password } = await request.json()

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

  const { data, error } = await supabase.auth.signUp({
    email: String(email || '').trim(),
    password: String(password || ''),
    options: {
      // dopo conferma email (se attiva) o subito (se disattiva)
      emailRedirectTo: `${request.nextUrl.origin}/login`,
    },
  })

  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 400 })
  }

  // Nota: se hai "Confirm email" attivo, user potrebbe essere creato ma session null
  return response
}