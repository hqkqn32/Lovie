"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"

export default function AuthCallbackPage() {
  const router = useRouter()
  const [status, setStatus] = React.useState<string>("processing")

  React.useEffect(() => {
    const handleAuth = async () => {
      try {
        // Read hash IMMEDIATELY before anything else
        const hash = window.location.hash
        const search = window.location.search
        
        console.log('[callback] Raw hash:', hash)
        console.log('[callback] Raw search:', search)
        
        setStatus(`Hash: ${hash.substring(0, 50)}...`)
        
        const supabase = createClient()
        
        // Try query param code first (normal magic link)
        const params = new URLSearchParams(search)
        const code = params.get('code')
        
        if (code) {
          console.log('[callback] Using code from query')
          const { error } = await supabase.auth.exchangeCodeForSession(code)
          if (error) throw error
        } else if (hash) {
          // Parse hash fragment manually
          const hashParams = new URLSearchParams(hash.replace('#', ''))
          const accessToken = hashParams.get('access_token')
          const refreshToken = hashParams.get('refresh_token')
          
          console.log('[callback] Access token exists:', !!accessToken)
          console.log('[callback] Refresh token exists:', !!refreshToken)
          
          if (accessToken && refreshToken) {
            console.log('[callback] Calling setSession')
            const { error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            })
            if (error) {
              console.error('[callback] setSession error:', error)
              throw error
            }
            console.log('[callback] Session set successfully!')
          } else {
            throw new Error('No tokens found in hash')
          }
        } else {
          throw new Error('No code or hash found')
        }
        
        console.log('[callback] Redirecting to dashboard')
        router.replace('/dashboard')
        router.refresh()
      } catch (error) {
        console.error('[callback] Auth error:', error)
        const msg = error instanceof Error ? error.message : 'Login failed'
        setStatus(`Error: ${msg}`)
        toast.error(msg)
        setTimeout(() => {
          router.replace('/login')
        }, 2000)
      }
    }

    // Run immediately
    handleAuth()
  }, [router])

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-4 py-12 text-center">
      <p className="text-sm text-muted-foreground">Signing you in…</p>
      <p className="text-xs text-muted-foreground mt-2">{status}</p>
    </div>
  )
}