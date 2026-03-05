import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next()

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

  const { data } = await supabase.auth.getUser()
  const user = data.user

  const pathname = request.nextUrl.pathname

  // ✅ route group (auth) NON è nell’URL: le tue route reali sono /login /register /reset-password
  const isAuthRoute =
    pathname === '/login' ||
    pathname === '/register' ||
    pathname === '/reset-password' ||
    pathname === '/auth/callback'

  // ✅ roba pubblica
  const isPublicAsset =
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/brand') ||
    pathname.startsWith('/images')

  const isPublic = isAuthRoute || isPublicAsset

  // 🔴 se non loggato, proteggi tutto tranne pubblico
  if (!user && !isPublic) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('returnTo', pathname)
    return NextResponse.redirect(url)
  }

  // 🟢 se loggato, blocca accesso alle pagine auth
  if (user && isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    url.search = ''
    return NextResponse.redirect(url)
  }

  return response
}

// ⚠️ ESCLUDI /api ALTRIMENTI ROMPI LOGIN/REGISTER/LOGOUT
export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}