import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        flowType: 'pkce',
        storage: {
          getItem: (key) => {
            if (typeof window === 'undefined') return null
            return document.cookie
              .split('; ')
              .find(row => row.startsWith(`${key}=`))
              ?.split('=')[1] || null
          },
          setItem: (key, value) => {
            if (typeof window === 'undefined') return
            document.cookie = `${key}=${value}; path=/; max-age=604800; SameSite=Lax`
          },
          removeItem: (key) => {
            if (typeof window === 'undefined') return
            document.cookie = `${key}=; path=/; max-age=0`
          }
        }
      }
    }
  )
}