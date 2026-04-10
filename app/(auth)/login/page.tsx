"use client"

import * as React from "react"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { Loader2Icon } from "lucide-react"

import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const schema = z.object({
  email: z.string().email("Please enter a valid email address"),
})

type FormValues = z.infer<typeof schema>

export default function LoginPage() {
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
  })

  const onSubmit = handleSubmit(async ({ email }) => {
    setIsSubmitting(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithOtp({
  email,
  options: {
    emailRedirectTo: `${window.location.origin}/auth/callback`,
    shouldCreateUser: true,
  },
})

      if (error) {
        toast.error(error.message || "Failed to send magic link, try again")
        return
      }

      toast.success("Check your email for login link")
    } catch {
      toast.error("Failed to send magic link, try again")
    } finally {
      setIsSubmitting(false)
    }
  })

  return (
    <div className="flex flex-1 items-center justify-center bg-gradient-to-b from-primary/5 to-background px-4 py-12">
      <Card className="w-full max-w-md ring-1 ring-primary/10">
        <CardHeader>
          <CardTitle className="text-primary">Sign in</CardTitle>
          <CardDescription>We’ll email you a magic link to sign in.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
                aria-invalid={Boolean(errors.email)}
                {...register("email")}
              />
              {errors.email ? (
                <p className="text-sm text-destructive">{errors.email.message}</p>
              ) : null}
            </div>

            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2Icon className="size-4 animate-spin" />
                  Sending…
                </>
              ) : (
                "Send Magic Link"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

