import { test, expect } from "@playwright/test"
import { createRequest, loginWithMagicLink } from "../helpers"

test.describe("create request", () => {
  test.skip(
    !process.env.SUPABASE_SERVICE_ROLE_KEY,
    "Set SUPABASE_SERVICE_ROLE_KEY to enable auth in E2E tests."
  )

  test("user can create a payment request", async ({ page }) => {
    const senderEmail = `sender+${Date.now()}@example.com`
    const recipientEmail = `recipient+${Date.now()}@example.com`

    await loginWithMagicLink(page, senderEmail)
    await createRequest(page, recipientEmail, "10.50", "Dinner")

    await page.getByRole("tab", { name: "Sent" }).click()
    await expect(page.getByText("Sent Requests")).toBeVisible()

    // Verify it appears in the Sent list
    await expect(page.getByText(recipientEmail)).toBeVisible()
    await expect(page.getByText("$10.50")).toBeVisible()
    await expect(page.getByText("PENDING")).toBeVisible()
  })
})

