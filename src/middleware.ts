import { createServerClient } from "@supabase/ssr"
import { jwtVerify } from "jose"
import { NextResponse, type NextRequest } from "next/server"
import { getBrandByHost, getBrandBySlug } from "@/brands"

function localBrandSlugFromPathname(pathname: string): string | null {
  if (pathname === "/losos" || pathname === "/losos/" || pathname.startsWith("/losos/")) {
    return "losos"
  }
  if (
    pathname === "/thespot" ||
    pathname === "/thespot/" ||
    pathname.startsWith("/thespot/")
  ) {
    return "the-spot"
  }
  return null
}

function buildRequestHeadersWithBrand(request: NextRequest, brandSlug: string) {
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set("x-brand-slug", brandSlug)
  requestHeaders.set("x-pathname", request.nextUrl.pathname)
  return requestHeaders
}

async function posSessionIsValid(token: string | undefined): Promise<boolean> {
  if (!token) return false
  const secret = process.env.POS_SESSION_SECRET
  if (!secret || secret.length < 32) return false
  try {
    await jwtVerify(token, new TextEncoder().encode(secret))
    return true
  } catch {
    return false
  }
}

export async function middleware(request: NextRequest) {
  const host =
    request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ??
    request.headers.get("host") ??
    ""
  const pathname = request.nextUrl.pathname
  const aliasedBrandSlug = localBrandSlugFromPathname(pathname)
  const brand = aliasedBrandSlug
    ? getBrandBySlug(aliasedBrandSlug)
    : getBrandByHost(host)

  const requestHeaders = buildRequestHeadersWithBrand(request, brand.slug)

  const isPosLogin =
    pathname === "/pos/login" || pathname === "/pos/login/"

  if (pathname.startsWith("/pos")) {
    if (pathname.startsWith("/pos/manager-login")) {
      return NextResponse.next({
        request: {
          headers: requestHeaders,
        },
      })
    }

    let response = NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    })

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options),
            )
          },
        },
      },
    )

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.redirect(new URL("/pos/manager-login", request.url))
    }

    if (!isPosLogin) {
      const token = request.cookies.get("pos-session")?.value
      if (!(await posSessionIsValid(token))) {
        return NextResponse.redirect(new URL("/pos/login", request.url))
      }
    }

    return response
  }

  const isAdminApiRoute = pathname.startsWith("/api/admin")

  if (isAdminApiRoute) {
    let supabaseApiResponse = NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    })

    const supabaseApi = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value),
            )
            supabaseApiResponse = NextResponse.next({
              request: {
                headers: requestHeaders,
              },
            })
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseApiResponse.cookies.set(name, value, options),
            )
          },
        },
      },
    )

    const {
      data: { user: adminApiUser },
    } = await supabaseApi.auth.getUser()

    if (!adminApiUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    return supabaseApiResponse
  }

  // const isCheckoutRoute = pathname.startsWith("/checkout")
  //
  // if (isCheckoutRoute) {
  //   const token = request.cookies.get("storefront-session")?.value
  //   if (!token) {
  //     return NextResponse.redirect(new URL("/", request.url))
  //   }
  // }

  const isAdminRoute = pathname.startsWith("/admin")
  const isAdminLoginPage = pathname === "/admin/login"

  if (!isAdminRoute) {
    if (aliasedBrandSlug) {
      const rewriteUrl = request.nextUrl.clone()
      if (aliasedBrandSlug === "losos") {
        if (pathname === "/losos" || pathname === "/losos/") {
          rewriteUrl.pathname = "/"
        } else if (pathname.startsWith("/losos/")) {
          rewriteUrl.pathname = pathname.slice("/losos".length) || "/"
        }
      } else if (aliasedBrandSlug === "the-spot") {
        if (pathname === "/thespot" || pathname === "/thespot/") {
          rewriteUrl.pathname = "/"
        } else if (pathname.startsWith("/thespot/")) {
          rewriteUrl.pathname = pathname.slice("/thespot".length) || "/"
        }
      }

      return NextResponse.rewrite(rewriteUrl, {
        request: {
          headers: requestHeaders,
        },
      })
    }

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    })
  }

  let supabaseResponse = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({
            request: {
              headers: buildRequestHeadersWithBrand(request, brand.slug),
            },
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (isAdminRoute && !isAdminLoginPage && !user) {
    return NextResponse.redirect(new URL("/admin/login", request.url))
  }

  if (isAdminLoginPage && user) {
    return NextResponse.redirect(new URL("/admin/categories", request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|pos/manager-login|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
}
