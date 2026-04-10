import { test, expect } from "@playwright/test"
import { createRequest, loginWithMagicLink } from "../helpers"

test.describe("cancel request", () => {
  test.skip(
    !process.env.PLAYWRIGHT_MAGIC_LINK_CALLBACK_URL,
    "Set PLAYWRIGHT_MAGIC_LINK_CALLBACK_URL to enable auth in E2E tests."
  )

  test("user can cancel their own request", async ({ page }) => {
    const senderEmail = `sender+${Date.now()}@example.com`
    const recipientEmail = `recipient+${Date.now()}@example.com`

    await loginWithMagicLink(page, senderEmail)
    await createRequest(page, recipientEmail, "25.00", "Test cancel")

    // Click the newest card (sent tab default)
    await page.getByText(`To ${recipientEmail}`).first().click()
    await expect(page).toHaveURL(/\/dashboard\/request\/.+/)

    await page.getByRole("button", { name: "Cancel request" }).click()
    await page.getByRole("button", { name: "Cancel Request" }).click()

    await expect(page.getByText("Request cancelled")).toBeVisible()
    await expect(page.getByText("CANCELLED")).toBeVisible()
  })
})

