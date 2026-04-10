"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { createClient } from "@/lib/supabase/client"

function parseHashParams(hash: string) {
  const h = hash.startsWith("#") ? hash.slice(1) : hash
  return new URLSearchParams(h)
}

export default function AuthCallbackPage() {
  const router = useRouter()

  React.useEffect(() => {
    let cancelled = false

    async function run() {
      try {
        const supabase = createClient()

        const url = new URL(window.location.href)
        const code = url.searchParams.get("code")

        // Flow A: PKCE code in query string (normal magic-link flow)
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code)
          if (error) throw error

          // Remove ?code=... from URL
          url.searchParams.delete("code")
          window.history.replaceState({}, "", url.toString())
        } else {
          // Flow B: tokens in hash fragment (admin-generated links in E2E)
          const hashParams = parseHashParams(window.location.hash)
          const access_token = hashParams.get("access_token")
          const refresh_token = hashParams.get("refresh_token")

          if (access_token && refresh_token) {
            const { error } = await supabase.auth.setSession({
              access_token,
              refresh_token,
            })
            if (error) throw error

            // Remove hash fragment from URL
            window.history.replaceState({}, "", url.pathname + url.search)
          }
        }

        if (cancelled) return
        router.replace("/dashboard")
        router.refresh()
      } catch (e) {
        const message =
          e && typeof e === "object" && "message" in e ? String((e as { message: unknown }).message) : "Login failed"
        toast.error(message || "Login failed")
        router.replace("/login")
        router.refresh()
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [router])

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-4 py-12 text-center">
      <p className="text-sm text-muted-foreground">Signing you in…</p>
    </div>
  )
}

