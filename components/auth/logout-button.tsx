"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"

export function LogoutButton() {
  const router = useRouter()
  const [isLoading, setIsLoading] = React.useState(false)

  return (
    <Button
      variant="ghost"
      className="text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
      disabled={isLoading}
      onClick={async () => {
        setIsLoading(true)
        try {
          const supabase = createClient()
          const { error } = await supabase.auth.signOut()
          if (error) {
            toast.error(error.message || "Failed to log out")
            return
          }
          router.push("/login")
          router.refresh()
        } catch {
          toast.error("Failed to log out")
        } finally {
          setIsLoading(false)
        }
      }}
    >
      {isLoading ? "Logging out…" : "Logout"}
    </Button>
  )
}

