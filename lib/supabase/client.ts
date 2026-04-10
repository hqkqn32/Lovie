import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name) {
          const cookies = document.cookie.split('; ')
          const cookie = cookies.find(c => c.startsWith(`${name}=`))
          return cookie ? decodeURIComponent(cookie.split('=')[1]) : null
        },
        set(name, value, options) {
          let cookie = `${name}=${encodeURIComponent(value)}; path=/`
          if (options?.maxAge) cookie += `; max-age=${options.maxAge}`
          if (options?.domain) cookie += `; domain=${options.domain}`
          if (options?.sameSite) cookie += `; samesite=${options.sameSite}`
          document.cookie = cookie
        },
        remove(name, options) {
          document.cookie = `${name}=; path=/; max-age=0`
        },
      },
    }
  )
}