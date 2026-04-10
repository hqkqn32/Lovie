# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: cancel-request.spec.ts >> cancel request >> user can cancel their own request
- Location: tests/e2e/cancel-request.spec.ts:10:7

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: page.waitForURL: Test timeout of 30000ms exceeded.
=========================== logs ===========================
waiting for navigation to "**/dashboard" until "load"
  navigated to "http://localhost:3000/auth/callback#access_token=eyJhbGciOiJFUzI1NiIsImtpZCI6IjczNjllMzdlLWFiZGItNGRkZS05ZGI1LTFiZDNjOTEzYmUzNiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL3p6d2Nsam5lYmp6eHV5cW11eXBtLnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiIxNGM2MTJlZC05MGJjLTQwY2UtYWZlMC03NTRjNzQ2ZWMwNmQiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzc1ODI2MTE1LCJpYXQiOjE3NzU4MjI1MTUsImVtYWlsIjoic2VuZGVyKzE3NzU4MjI1MTQ2MzNAZXhhbXBsZS5jb20iLCJwaG9uZSI6IiIsImFwcF9tZXRhZGF0YSI6eyJwcm92aWRlciI6ImVtYWlsIiwicHJvdmlkZXJzIjpbImVtYWlsIl19LCJ1c2VyX21ldGFkYXRhIjp7ImVtYWlsX3ZlcmlmaWVkIjp0cnVlfSwicm9sZSI6ImF1dGhlbnRpY2F0ZWQiLCJhYWwiOiJhYWwxIiwiYW1yIjpbeyJtZXRob2QiOiJvdHAiLCJ0aW1lc3RhbXAiOjE3NzU4MjI1MTV9XSwic2Vzc2lvbl9pZCI6IjhkNjdjN2M5LTZhMzktNGVkMy05MjVjLWZkZDg2NGYzZmZlMiIsImlzX2Fub255bW91cyI6ZmFsc2V9.iEXgNB6eJUVD5VWZya3tQwzeoqEf0MasXdNDIn6IV2Lrx4i4SZLgFm2B5ToRlr8_ppwtO05SN1txxJcn930JwA&expires_at=1775826115&expires_in=3600&refresh_token=wyqjczcotrio&sb=&token_type=bearer&type=signup"
  navigated to "http://localhost:3000/auth/callback"
============================================================
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - paragraph [ref=e3]: Signing you in…
  - region "Notifications alt+T"
  - button "Open Next.js Dev Tools" [ref=e9] [cursor=pointer]:
    - generic [ref=e12]:
      - text: Rendering
      - generic [ref=e13]:
        - generic [ref=e14]: .
        - generic [ref=e15]: .
        - generic [ref=e16]: .
  - alert [ref=e17]
```

# Test source

```ts
  1  | import { expect, type Page } from "@playwright/test"
  2  | import { createClient } from "@supabase/supabase-js"
  3  | 
  4  | function requiredEnv(name: string) {
  5  |   const v = process.env[name]
  6  |   if (!v) throw new Error(`Missing ${name} env var (required for Playwright auth).`)
  7  |   return v
  8  | }
  9  | 
  10 | async function getMagicLinkActionUrl(email: string, redirectTo: string) {
  11 |   const supabaseUrl =
  12 |     process.env.NEXT_PUBLIC_SUPABASE_URL ?? requiredEnv("NEXT_PUBLIC_SUPABASE_URL")
  13 |   const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY")
  14 | 
  15 |   const admin = createClient(supabaseUrl, serviceRoleKey, {
  16 |     auth: { persistSession: false, autoRefreshToken: false },
  17 |   })
  18 | 
  19 |   const { data, error } = await admin.auth.admin.generateLink({
  20 |     type: "magiclink",
  21 |     email,
  22 |     options: { redirectTo },
  23 |   })
  24 | 
  25 |   if (!error) return data.properties.action_link
  26 | 
  27 |   // If user doesn't exist, create and retry (Supabase behavior varies by project settings).
  28 |   const { error: createError } = await admin.auth.admin.createUser({
  29 |     email,
  30 |     email_confirm: true,
  31 |   })
  32 |   if (createError) throw error
  33 | 
  34 |   const retry = await admin.auth.admin.generateLink({
  35 |     type: "magiclink",
  36 |     email,
  37 |     options: { redirectTo },
  38 |   })
  39 |   if (retry.error) throw retry.error
  40 |   return retry.data.properties.action_link
  41 | }
  42 | 
  43 | export async function loginWithMagicLink(page: Page, email: string) {
  44 |   const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000"
  45 |   const redirectTo = `${baseUrl}/auth/callback`
  46 |   const actionLink = await getMagicLinkActionUrl(email, redirectTo)
  47 | 
  48 |   // Visiting the action link redirects back to /auth/callback which sets session cookies.
  49 |   await page.goto(actionLink)
> 50 |   await page.waitForURL("**/dashboard")
     |              ^ Error: page.waitForURL: Test timeout of 30000ms exceeded.
  51 | }
  52 | 
  53 | export async function createRequest(
  54 |   page: Page,
  55 |   recipientEmail: string,
  56 |   amount: string,
  57 |   note?: string
  58 | ) {
  59 |   await page.goto("/dashboard")
  60 | 
  61 |   await page.getByRole("button", { name: "New Request" }).click()
  62 |   await page.getByLabel("Recipient email").fill(recipientEmail)
  63 |   await page.getByLabel("Amount").fill(amount)
  64 |   if (note) {
  65 |     await page.getByLabel("Note (optional)").fill(note)
  66 |   }
  67 | 
  68 |   await page.getByRole("button", { name: "Create Request" }).click()
  69 |   await expect(page.getByText("Request created")).toBeVisible()
  70 | }
  71 | 
  72 | 
```