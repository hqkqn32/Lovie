import { expect, type Page } from "@playwright/test"
import { createClient } from "@supabase/supabase-js"

function requiredEnv(name: string) {
  const v = process.env[name]
  if (!v) throw new Error(`Missing ${name} env var (required for Playwright auth).`)
  return v
}

async function getMagicLinkActionUrl(email: string, redirectTo: string) {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? requiredEnv("NEXT_PUBLIC_SUPABASE_URL")
  const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY")

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo },
  })

  if (!error) return data.properties.action_link

  // If user doesn't exist, create and retry (Supabase behavior varies by project settings).
  const { error: createError } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
  })
  if (createError) throw error

  const retry = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo },
  })
  if (retry.error) throw retry.error
  return retry.data.properties.action_link
}

export async function loginWithMagicLink(page: Page, email: string) {
  const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000"
  const redirectTo = `${baseUrl}/auth/callback`
  const actionLink = await getMagicLinkActionUrl(email, redirectTo)

  // Visiting the action link redirects back to /auth/callback which sets session cookies.
  await page.goto(actionLink)
  await page.waitForURL("**/dashboard")
}

export async function createRequest(
  page: Page,
  recipientEmail: string,
  amount: string,
  note?: string
) {
  await page.goto("/dashboard")

  await page.getByRole("button", { name: "New Request" }).click()
  await page.getByLabel("Recipient email").fill(recipientEmail)
  await page.getByLabel("Amount").fill(amount)
  if (note) {
    await page.getByLabel("Note (optional)").fill(note)
  }

  await page.getByRole("button", { name: "Create Request" }).click()
  await expect(page.getByText("Request created")).toBeVisible()
}

