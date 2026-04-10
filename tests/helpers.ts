import { expect, type Page } from "@playwright/test"

/**
 * Logs in via Supabase magic-link flow.
 *
 * Because email delivery is out-of-band, you must provide an authenticated callback URL
 * (the URL the user would click from their email) via:
 * - PLAYWRIGHT_MAGIC_LINK_CALLBACK_URL
 *
 * You can generate this however you prefer (Supabase dashboard, admin API, etc).
 */
export async function loginWithMagicLink(page: Page, email: string) {
  const callbackUrl = process.env.PLAYWRIGHT_MAGIC_LINK_CALLBACK_URL
  if (!callbackUrl) {
    throw new Error(
      "Missing PLAYWRIGHT_MAGIC_LINK_CALLBACK_URL env var (required to complete magic-link auth in E2E)."
    )
  }

  await page.goto("/login")
  await page.getByLabel("Email").fill(email)
  await page.getByRole("button", { name: "Send Magic Link" }).click()

  await expect(page.getByText("Check your email for login link")).toBeVisible()

  await page.goto(callbackUrl)
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

