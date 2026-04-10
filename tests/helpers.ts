import { expect, type Page } from "@playwright/test"
import { createClient } from "@supabase/supabase-js"
import { Client } from "pg"

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

  async function generateOnce() {
    return await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo },
    })
  }

  const first = await generateOnce()
  if (!first.error) {
    return {
      actionLink: first.data.properties.action_link,
      userId: first.data.user.id,
    }
  }

  console.error("[playwright] generateLink failed (attempt 1):", first.error)

  // If user doesn't exist (or project requires it), create and retry.
  const created = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
  })
  if (created.error) {
    console.error("[playwright] createUser failed:", created.error)
  }

  const second = await generateOnce()
  if (second.error) {
    console.error("[playwright] generateLink failed (attempt 2):", second.error)
    throw second.error
  }

  return {
    actionLink: second.data.properties.action_link,
    userId: second.data.user.id,
  }
}

export async function loginWithMagicLink(page: Page, email: string) {
  const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000"
  const redirectTo = `${baseUrl}/auth/callback`
  const { actionLink, userId } = await getMagicLinkActionUrl(email, redirectTo)

  // Ensure the Prisma `User` row exists (id must match Supabase user id).
  const normalizedEmail = email.trim().toLowerCase()
  try {
    const databaseUrl = requiredEnv("DATABASE_URL")
    const client = new Client({ connectionString: databaseUrl })
    await client.connect()
    try {
      await client.query(`DELETE FROM "User" WHERE email = $1`, [normalizedEmail])
      await client.query(
        `INSERT INTO "User" (id, email, "createdAt") VALUES ($1, $2, NOW())`,
        [userId, normalizedEmail]
      )
    } finally {
      await client.end()
    }
  } catch (e) {
    console.error("[playwright] Failed to sync Prisma User:", e)
    throw e
  }

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

