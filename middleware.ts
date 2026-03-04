import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'

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
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: CookieOptions }>) {
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

  // ✅ Pagine pubbliche / auth (DEVONO MATCHARE LE TUE ROUTE REALI)
  const isAuthRoute =
    pathname === '/login' ||
    pathname === '/register' ||
    pathname.startsWith('reset-password')  ||
    pathname.startsWith('/auth/callback')

  // ✅ Asset pubblici
  const isPublicAsset =
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/brand') ||
    pathname.startsWith('/public')

  const isPublic = isAuthRoute || isPublicAsset

  // 🔴 NON LOGGATO: blocca tutto tranne pagine pubbliche
  if (!user && !isPublic) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('returnTo', pathname)
    return NextResponse.redirect(url)
  }

  // 🟢 GIÀ LOGGATO: evita di mostrare login/register/reset/callback
  if (user && isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/home' // <-- cambia se la tua home è un'altra
    url.search = ''
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
}