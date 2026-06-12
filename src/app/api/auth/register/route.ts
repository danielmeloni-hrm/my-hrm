import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function POST(request: NextRequest) {
  const { email, password, nome, cognome } = await request.json()

  const cleanEmail = String(email || '').trim()
  const cleanPassword = String(password || '')
  const cleanNome = String(nome || '').trim()
  const cleanCognome = String(cognome || '').trim()

  if (!cleanNome || !cleanCognome) {
    return NextResponse.json(
      { ok: false, message: 'Nome e cognome sono obbligatori' },
      { status: 400 }
    )
  }

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

  const { error } = await supabase.auth.signUp({
    email: cleanEmail,
    password: cleanPassword,
    options: {
      emailRedirectTo: `${request.nextUrl.origin}/login`,
      data: {
        nome: cleanNome,
        cognome: cleanCognome,
      },
    },
  })

  if (error) {
    console.log('REGISTER ERROR:', error)
    return NextResponse.json(
      { ok: false, message: error.message },
      { status: 400 }
    )
  }

  return response
}