# Specification: P2P Payment Request Feature

## Overview

A peer-to-peer payment request system that allows users to request money from others via email, track request statuses, and fulfill payment requests. Similar to Venmo's "Request" feature or Cash App payment requests.

**Target Users:** Consumer fintech app users who need to request payments from friends, family, or acquaintances.

**Core Value Proposition:** Simple, transparent money requests with clear status tracking and automatic expiration.

---

## User Stories

### US1: Create Payment Request
**As a** user  
**I want to** create a payment request for a specific amount from someone  
**So that** I can request money owed to me in a trackable way

**Acceptance Criteria:**
- User can enter recipient's email address
- User can enter amount (must be > 0)
- User can add optional note (max 500 characters)
- System validates email format
- System validates amount is positive and has max 2 decimal places
- System generates unique shareable link
- System sets expiration to 7 days from creation
- User cannot request from their own email address
- User receives confirmation with shareable link

### US2: View Request Dashboard
**As a** user  
**I want to** see all my sent and received payment requests  
**So that** I can track the status of money I'm requesting or being requested to pay

**Acceptance Criteria:**
- Dashboard shows two tabs: "Sent" and "Received"
- Each request shows: amount, recipient/sender, note, status, timestamp
- Sent requests show: Pending, Paid, Declined, Expired, Cancelled
- Received requests show: Pending, Paid, Declined, Expired
- User can filter by status
- User can search by recipient/sender email
- List is sorted by creation date (newest first)
- Pagination if more than 20 requests

### US3: Pay Request (Recipient)
**As a** recipient of a payment request  
**I want to** pay the requested amount  
**So that** I can fulfill my payment obligation

**Acceptance Criteria:**
- User can click "Pay" button on pending request
- System shows payment confirmation modal with amount and recipient
- User confirms payment
- System simulates 2-3 second processing delay
- System updates request status to "Paid"
- System records payment timestamp
- Both sender and recipient see updated status
- User cannot pay expired request
- User cannot pay already-paid request
- User cannot pay declined request
- User cannot pay cancelled request

### US4: Decline Request (Recipient)
**As a** recipient of a payment request  
**I want to** decline a request I don't want to fulfill  
**So that** the requester knows I won't be paying

**Acceptance Criteria:**
- User can click "Decline" button on pending request
- System shows confirmation modal
- User confirms decline
- System updates request status to "Declined"
- System records decline timestamp
- Both sender and recipient see updated status
- User cannot decline expired request
- User cannot decline already-paid request
- User cannot decline already-declined request

### US5: Cancel Request (Sender)
**As a** sender of a payment request  
**I want to** cancel my pending request  
**So that** I can retract requests I no longer need

**Acceptance Criteria:**
- User can click "Cancel" button on their pending sent request
- System shows confirmation modal
- User confirms cancellation
- System updates request status to "Cancelled"
- System records cancellation timestamp
- Recipient can no longer pay the request
- User cannot cancel already-paid request
- User cannot cancel expired request
- User cannot cancel already-declined request

### US6: View Request Details
**As a** user  
**I want to** see detailed information about a specific request  
**So that** I can review the full context before taking action

**Acceptance Criteria:**
- Detail page shows: amount, note, sender email, recipient email, creation date, expiration date, status
- For received pending requests: shows "Pay" and "Decline" buttons
- For sent pending requests: shows "Cancel" button
- For expired/paid/declined requests: buttons are disabled/hidden
- Shows countdown timer for pending requests (e.g., "Expires in 5 days")
- Shows shareable link (sender can copy)

### US7: Access via Shareable Link
**As a** recipient receiving a shareable link  
**I want to** view and pay the request directly from the link  
**So that** I can pay without logging in first (if not registered)

**Acceptance Criteria:**
- Shareable link format: `/request/[unique-id]`
- Unauthenticated users can view request details (amount, note, sender)
- To pay, user must authenticate first
- After authentication, user is redirected to pay flow
- Invalid/non-existent links show 404 error
- Expired requests show appropriate message

### US8: Request Expiration
**As a** system  
**I want to** automatically expire requests after 7 days  
**So that** old unpaid requests don't accumulate indefinitely

**Acceptance Criteria:**
- Requests created with `expiresAt = createdAt + 7 days`
- When viewing expired pending request, status automatically updates to "Expired"
- Expired requests cannot be paid
- Expired requests cannot be declined
- Expired requests cannot be cancelled
- Detail page shows "Expired" badge and timestamp

---

## Functional Requirements

### FR1: Authentication
- Email-based authentication using Supabase Auth
- Magic link login (passwordless)
- User session persists across browser sessions
- Session expires after 7 days of inactivity
- Logout functionality

### FR2: Request Creation
- Validates recipient email is valid format
- Validates amount is positive number with max 2 decimal places
- Validates note is max 500 characters
- Prevents user from requesting from their own email
- Generates unique UUID for request ID
- Generates unique shareable link slug
- Sets expiration to exactly 7 days (168 hours) from creation
- Returns created request object with shareable link

### FR3: Request Listing & Filtering
- Fetches all requests where user is sender OR recipient
- Separates into "Sent" and "Received" tabs
- Filters by status: All, Pending, Paid, Declined, Expired, Cancelled
- Search by email (partial match, case-insensitive)
- Sorts by `createdAt` descending
- Pagination: 20 requests per page

### FR4: Request Status Transitions
Valid state transitions:
PENDING → PAID (recipient pays)
PENDING → DECLINED (recipient declines)
PENDING → CANCELLED (sender cancels)
PENDING → EXPIRED (system, when current_time > expiresAt)
Invalid transitions (must be blocked):
- Any status → PENDING
- PAID → any other status
- DECLINED → any other status except EXPIRED
- CANCELLED → any other status except EXPIRED
- EXPIRED → any other status

### FR5: Payment Simulation
- Shows loading spinner for 2-3 seconds
- Updates request status to PAID
- Sets `paidAt` timestamp
- Returns success confirmation
- Does NOT actually process money (this is a simulation)
- Shows success modal with confirmation message

### FR6: Decimal Precision
- All amounts stored as `Decimal(10,2)` in database
- Maximum amount: $99,999,999.99
- Minimum amount: $0.01
- Display format: `$1,234.56` (comma separators, 2 decimals)
- Input validation: rejects amounts with > 2 decimal places

### FR7: Expiration Logic
- Check expiration on every request read
- If `current_time > expiresAt AND status = PENDING`, update to EXPIRED
- Lazy evaluation: no background cron job needed (check on-demand)
- Countdown timer shows days/hours/minutes remaining

---

## Non-Functional Requirements

### NFR1: Performance
- Dashboard load time < 2 seconds
- Request creation response < 1 second
- Payment simulation completes in 2-3 seconds
- Support 100 concurrent users

### NFR2: Security
- All API endpoints require authentication (except public shareable link view)
- Users can only pay/decline requests sent TO them
- Users can only cancel requests sent BY them
- Prevent SQL injection via parameterized queries (Prisma)
- Prevent XSS via React's default escaping
- HTTPS only in production

### NFR3: Usability
- Mobile-responsive design (works on 320px width)
- Desktop-optimized layout (max 1280px container)
- Accessible: WCAG 2.1 Level AA compliance
- Clear error messages for validation failures
- Loading states for all async operations

### NFR4: Reliability
- 99.9% uptime on Vercel
- Database backups via Supabase (automatic)
- Graceful error handling with user-friendly messages
- No data loss on failed transactions

---

## Data Model

### User
```typescript
{
id: string (UUID)
email: string (unique, indexed)
createdAt: DateTime
}

### PaymentRequest
```typescript{
id: string (UUID)
amount: Decimal (10,2) // CRITICAL: Fintech precision
note: string? (max 500 chars)
status: enum (PENDING | PAID | DECLINED | EXPIRED | CANCELLED)
shareableLink: string (unique, indexed)senderId: string (foreign key → User)
recipientEmail: string (indexed)
recipientId: string? (foreign key → User, nullable)createdAt: DateTime
expiresAt: DateTime (createdAt + 7 days)
paidAt: DateTime?
declinedAt: DateTime?
cancelledAt: DateTime?
}
📄 İŞTE SPEC İÇERİĞİ - KOPYALA YAPIŞTIR:
markdown# Specification: P2P Payment Request Feature

## Overview

A peer-to-peer payment request system that allows users to request money from others via email, track request statuses, and fulfill payment requests. Similar to Venmo's "Request" feature or Cash App payment requests.

**Target Users:** Consumer fintech app users who need to request payments from friends, family, or acquaintances.

**Core Value Proposition:** Simple, transparent money requests with clear status tracking and automatic expiration.

---

## User Stories

### US1: Create Payment Request
**As a** user  
**I want to** create a payment request for a specific amount from someone  
**So that** I can request money owed to me in a trackable way

**Acceptance Criteria:**
- User can enter recipient's email address
- User can enter amount (must be > 0)
- User can add optional note (max 500 characters)
- System validates email format
- System validates amount is positive and has max 2 decimal places
- System generates unique shareable link
- System sets expiration to 7 days from creation
- User cannot request from their own email address
- User receives confirmation with shareable link

### US2: View Request Dashboard
**As a** user  
**I want to** see all my sent and received payment requests  
**So that** I can track the status of money I'm requesting or being requested to pay

**Acceptance Criteria:**
- Dashboard shows two tabs: "Sent" and "Received"
- Each request shows: amount, recipient/sender, note, status, timestamp
- Sent requests show: Pending, Paid, Declined, Expired, Cancelled
- Received requests show: Pending, Paid, Declined, Expired
- User can filter by status
- User can search by recipient/sender email
- List is sorted by creation date (newest first)
- Pagination if more than 20 requests

### US3: Pay Request (Recipient)
**As a** recipient of a payment request  
**I want to** pay the requested amount  
**So that** I can fulfill my payment obligation

**Acceptance Criteria:**
- User can click "Pay" button on pending request
- System shows payment confirmation modal with amount and recipient
- User confirms payment
- System simulates 2-3 second processing delay
- System updates request status to "Paid"
- System records payment timestamp
- Both sender and recipient see updated status
- User cannot pay expired request
- User cannot pay already-paid request
- User cannot pay declined request
- User cannot pay cancelled request

### US4: Decline Request (Recipient)
**As a** recipient of a payment request  
**I want to** decline a request I don't want to fulfill  
**So that** the requester knows I won't be paying

**Acceptance Criteria:**
- User can click "Decline" button on pending request
- System shows confirmation modal
- User confirms decline
- System updates request status to "Declined"
- System records decline timestamp
- Both sender and recipient see updated status
- User cannot decline expired request
- User cannot decline already-paid request
- User cannot decline already-declined request

### US5: Cancel Request (Sender)
**As a** sender of a payment request  
**I want to** cancel my pending request  
**So that** I can retract requests I no longer need

**Acceptance Criteria:**
- User can click "Cancel" button on their pending sent request
- System shows confirmation modal
- User confirms cancellation
- System updates request status to "Cancelled"
- System records cancellation timestamp
- Recipient can no longer pay the request
- User cannot cancel already-paid request
- User cannot cancel expired request
- User cannot cancel already-declined request

### US6: View Request Details
**As a** user  
**I want to** see detailed information about a specific request  
**So that** I can review the full context before taking action

**Acceptance Criteria:**
- Detail page shows: amount, note, sender email, recipient email, creation date, expiration date, status
- For received pending requests: shows "Pay" and "Decline" buttons
- For sent pending requests: shows "Cancel" button
- For expired/paid/declined requests: buttons are disabled/hidden
- Shows countdown timer for pending requests (e.g., "Expires in 5 days")
- Shows shareable link (sender can copy)

### US7: Access via Shareable Link
**As a** recipient receiving a shareable link  
**I want to** view and pay the request directly from the link  
**So that** I can pay without logging in first (if not registered)

**Acceptance Criteria:**
- Shareable link format: `/request/[unique-id]`
- Unauthenticated users can view request details (amount, note, sender)
- To pay, user must authenticate first
- After authentication, user is redirected to pay flow
- Invalid/non-existent links show 404 error
- Expired requests show appropriate message

### US8: Request Expiration
**As a** system  
**I want to** automatically expire requests after 7 days  
**So that** old unpaid requests don't accumulate indefinitely

**Acceptance Criteria:**
- Requests created with `expiresAt = createdAt + 7 days`
- When viewing expired pending request, status automatically updates to "Expired"
- Expired requests cannot be paid
- Expired requests cannot be declined
- Expired requests cannot be cancelled
- Detail page shows "Expired" badge and timestamp

---

## Functional Requirements

### FR1: Authentication
- Email-based authentication using Supabase Auth
- Magic link login (passwordless)
- User session persists across browser sessions
- Session expires after 7 days of inactivity
- Logout functionality

### FR2: Request Creation
- Validates recipient email is valid format
- Validates amount is positive number with max 2 decimal places
- Validates note is max 500 characters
- Prevents user from requesting from their own email
- Generates unique UUID for request ID
- Generates unique shareable link slug
- Sets expiration to exactly 7 days (168 hours) from creation
- Returns created request object with shareable link

### FR3: Request Listing & Filtering
- Fetches all requests where user is sender OR recipient
- Separates into "Sent" and "Received" tabs
- Filters by status: All, Pending, Paid, Declined, Expired, Cancelled
- Search by email (partial match, case-insensitive)
- Sorts by `createdAt` descending
- Pagination: 20 requests per page

### FR4: Request Status Transitions
Valid state transitions:
PENDING → PAID (recipient pays)
PENDING → DECLINED (recipient declines)
PENDING → CANCELLED (sender cancels)
PENDING → EXPIRED (system, when current_time > expiresAt)

Invalid transitions (must be blocked):
- Any status → PENDING
- PAID → any other status
- DECLINED → any other status except EXPIRED
- CANCELLED → any other status except EXPIRED
- EXPIRED → any other status

### FR5: Payment Simulation
- Shows loading spinner for 2-3 seconds
- Updates request status to PAID
- Sets `paidAt` timestamp
- Returns success confirmation
- Does NOT actually process money (this is a simulation)
- Shows success modal with confirmation message

### FR6: Decimal Precision
- All amounts stored as `Decimal(10,2)` in database
- Maximum amount: $99,999,999.99
- Minimum amount: $0.01
- Display format: `$1,234.56` (comma separators, 2 decimals)
- Input validation: rejects amounts with > 2 decimal places

### FR7: Expiration Logic
- Check expiration on every request read
- If `current_time > expiresAt AND status = PENDING`, update to EXPIRED
- Lazy evaluation: no background cron job needed (check on-demand)
- Countdown timer shows days/hours/minutes remaining

---

## Non-Functional Requirements

### NFR1: Performance
- Dashboard load time < 2 seconds
- Request creation response < 1 second
- Payment simulation completes in 2-3 seconds
- Support 100 concurrent users

### NFR2: Security
- All API endpoints require authentication (except public shareable link view)
- Users can only pay/decline requests sent TO them
- Users can only cancel requests sent BY them
- Prevent SQL injection via parameterized queries (Prisma)
- Prevent XSS via React's default escaping
- HTTPS only in production

### NFR3: Usability
- Mobile-responsive design (works on 320px width)
- Desktop-optimized layout (max 1280px container)
- Accessible: WCAG 2.1 Level AA compliance
- Clear error messages for validation failures
- Loading states for all async operations

### NFR4: Reliability
- 99.9% uptime on Vercel
- Database backups via Supabase (automatic)
- Graceful error handling with user-friendly messages
- No data loss on failed transactions

---

## Data Model

### User
```typescript
{
  id: string (UUID)
  email: string (unique, indexed)
  createdAt: DateTime
}
```

### PaymentRequest
```typescript
{
  id: string (UUID)
  amount: Decimal (10,2) // CRITICAL: Fintech precision
  note: string? (max 500 chars)
  status: enum (PENDING | PAID | DECLINED | EXPIRED | CANCELLED)
  shareableLink: string (unique, indexed)
  
  senderId: string (foreign key → User)
  recipientEmail: string (indexed)
  recipientId: string? (foreign key → User, nullable)
  
  createdAt: DateTime
  expiresAt: DateTime (createdAt + 7 days)
  paidAt: DateTime?
  declinedAt: DateTime?
  cancelledAt: DateTime?
}
```

**Indexes:**
- `senderId` (for listing sent requests)
- `recipientEmail` (for listing received requests)
- `status` (for filtering)
- `shareableLink` (for public access)

---

## API Contracts

### POST /api/auth/magic-link
**Request:**
```json
{
  "email": "user@example.com"
}
```
**Response:**
```json
{
  "message": "Magic link sent to your email"
}
```

### POST /api/requests
**Request:**
```json
{
  "recipientEmail": "recipient@example.com",
  "amount": "100.50",
  "note": "Dinner last night"
}
```
**Response:**
```json
{
  "id": "uuid",
  "shareableLink": "/request/abc123",
  "expiresAt": "2026-04-17T12:00:00Z"
}
```
**Errors:**
- 400: Invalid email format
- 400: Amount must be > 0
- 400: Cannot request from yourself
- 400: Note exceeds 500 characters

### GET /api/requests?type=sent&status=pending&search=john
**Query Params:**
- `type`: "sent" | "received" | "all" (default: "all")
- `status`: "pending" | "paid" | "declined" | "expired" | "cancelled" | "all" (default: "all")
- `search`: email partial match (optional)
- `page`: number (default: 1)
- `limit`: number (default: 20)

**Response:**
```json
{
  "requests": [
    {
      "id": "uuid",
      "amount": "100.50",
      "note": "Dinner",
      "status": "PENDING",
      "recipientEmail": "john@example.com",
      "senderEmail": "me@example.com",
      "createdAt": "2026-04-10T12:00:00Z",
      "expiresAt": "2026-04-17T12:00:00Z"
    }
  ],
  "total": 1,
  "page": 1,
  "totalPages": 1
}
```

### GET /api/requests/[id]
**Response:**
```json
{
  "id": "uuid",
  "amount": "100.50",
  "note": "Dinner",
  "status": "PENDING",
  "recipientEmail": "john@example.com",
  "senderEmail": "me@example.com",
  "shareableLink": "/request/abc123",
  "createdAt": "2026-04-10T12:00:00Z",
  "expiresAt": "2026-04-17T12:00:00Z",
  "paidAt": null
}
```

### PATCH /api/requests/[id]/pay
**Response:**
```json
{
  "success": true,
  "request": { /* updated request */ }
}
```
**Errors:**
- 403: Not the recipient
- 400: Request already paid
- 400: Request expired
- 400: Request declined/cancelled

### PATCH /api/requests/[id]/decline
**Response:**
```json
{
  "success": true,
  "request": { /* updated request */ }
}
```
**Errors:**
- 403: Not the recipient
- 400: Request already declined
- 400: Request expired
- 400: Request already paid

### PATCH /api/requests/[id]/cancel
**Response:**
```json
{
  "success": true,
  "request": { /* updated request */ }
}
```
**Errors:**
- 403: Not the sender
- 400: Request already cancelled
- 400: Request already paid
- 400: Request expired

### GET /api/public/requests/[id]
**Public endpoint** (no auth required for viewing)
**Response:**
```json
{
  "id": "uuid",
  "amount": "100.50",
  "note": "Dinner",
  "status": "PENDING",
  "senderEmail": "sender@example.com",
  "expiresAt": "2026-04-17T12:00:00Z"
}
```
**Note:** Does NOT expose recipient email (privacy)

---

## Edge Cases & Validation Rules

### EC1: Self-Request Prevention
- ❌ User cannot create request where `recipientEmail === user.email`
- Error: "You cannot request payment from yourself"

### EC2: Negative/Zero Amount
- ❌ Amount must be > 0
- Error: "Amount must be greater than $0.00"

### EC3: Decimal Precision
- ❌ Amount with > 2 decimal places
- Error: "Amount cannot have more than 2 decimal places"
- ✅ Round or truncate to 2 decimals on input

### EC4: Invalid Email Format
- ❌ Malformed email
- Error: "Please enter a valid email address"
- Validation: regex or email-validator library

### EC5: Expired Request Actions
- ❌ Cannot pay expired request
- ❌ Cannot decline expired request
- ❌ Cannot cancel expired request
- Auto-transition PENDING → EXPIRED when `current_time > expiresAt`

### EC6: Already-Paid Request
- ❌ Cannot pay again
- ❌ Cannot decline
- ❌ Cannot cancel
- Status is immutable once PAID

### EC7: Already-Declined Request
- ❌ Cannot pay
- ❌ Cannot decline again
- ✅ CAN transition to EXPIRED (if time passes)

### EC8: Already-Cancelled Request
- ❌ Cannot pay
- ❌ Cannot decline
- ❌ Cannot cancel again
- ✅ CAN transition to EXPIRED (if time passes)

### EC9: Unauthorized Actions
- ❌ User A cannot pay request sent BY User A (only TO)
- ❌ User B cannot cancel request sent BY User A
- ❌ User C cannot decline request sent TO User D
- Error: "You are not authorized to perform this action"

### EC10: Non-Existent Request
- ❌ Invalid UUID in URL
- Error: 404 "Request not found"

### EC11: Note Length
- ❌ Note > 500 characters
- Error: "Note cannot exceed 500 characters"
- Frontend: character counter

### EC12: Concurrent Payment Attempts
- ❌ Two users try to pay same request simultaneously
- Solution: Database transaction with row-level locking
- Only first transaction succeeds, second gets "already paid" error

---

## UI/UX Requirements

### Landing Page (Unauthenticated)
- Hero section: "Request Money, Simply"
- CTA: "Get Started" → redirects to login
- Features list: "Track requests, automatic expiration, shareable links"
- Footer: "Made with ❤️ for Lovie Interview"

### Login Page
- Email input field
- "Send Magic Link" button
- Loading state while sending
- Success message: "Check your email for login link"
- Error handling: "Failed to send email, try again"

### Dashboard (Authenticated)
- Header: Logo, user email, logout button
- Navigation tabs: "Sent Requests" | "Received Requests"
- "+ New Request" button (top right)
- Filter dropdown: All, Pending, Paid, Declined, Expired, Cancelled
- Search bar: "Search by email..."
- Request list (cards):
  - Amount (large, bold)
  - Recipient/Sender email
  - Note (truncated to 50 chars)
  - Status badge (color-coded)
  - Timestamp (relative: "2 days ago")
  - "View Details" link
- Pagination controls (if > 20 requests)
- Empty state: "No requests found. Create one!"

### Create Request Modal
- Modal overlay (blur background)
- Form fields:
  - Recipient Email (autofocus)
  - Amount ($ prefix, 2 decimal validation)
  - Note (optional, character counter)
- "Create Request" button (disabled until valid)
- "Cancel" button
- Validation errors inline (red text below field)
- Success: close modal, show toast, redirect to request detail

### Request Detail Page
- Breadcrumb: Dashboard > Request Details
- Card layout:
  - Amount (hero size)
  - Status badge
  - Sender/Recipient emails
  - Note (full text)
  - Created date
  - Expiration countdown (for pending)
  - Shareable link (copy button)
- Action buttons (based on role & status):
  - Recipient + Pending: "Pay" (primary), "Decline" (secondary)
  - Sender + Pending: "Cancel" (destructive)
  - Paid/Declined/Expired/Cancelled: No buttons
- Payment modal:
  - Confirm amount
  - "Confirm Payment" button
  - Loading spinner (2-3s)
  - Success animation

### Shareable Link Page (Public)
- Minimal layout (no dashboard chrome)
- Request details (amount, note, sender)
- Status indicator
- If pending: "Log in to Pay" CTA button
- If paid/expired: Status message only
- Footer: "Powered by [App Name]"

### Responsive Design
- Mobile (<768px):
  - Single column layout
  - Stacked cards
  - Bottom sheet for modals
  - Hamburger menu
- Desktop (>768px):
  - Two-column layout (sidebar + main)
  - Modal overlays
  - Horizontal tabs

### Color Scheme
- Primary: Blue (#3B82F6)
- Success: Green (#10B981)
- Warning: Yellow (#F59E0B)
- Danger: Red (#EF4444)
- Neutral: Gray (#6B7280)
- Background: White (#FFFFFF)
- Text: Dark Gray (#1F2937)

### Status Badges
- PENDING: Blue background, white text
- PAID: Green background, white text
- DECLINED: Red background, white text
- EXPIRED: Gray background, white text
- CANCELLED: Orange background, white text

---

## Testing Requirements

### Unit Tests (Optional for MVP, but recommended)
- Request validation logic
- Status transition logic
- Decimal precision handling

### E2E Tests (REQUIRED)
**Playwright test scenarios:**

1. **test_create_request_happy_path**
   - Login with magic link
   - Navigate to dashboard
   - Click "New Request"
   - Fill form with valid data
   - Submit
   - Verify request appears in "Sent" tab
   - Verify status is PENDING

2. **test_pay_request_happy_path**
   - Login as recipient
   - Navigate to "Received" tab
   - Click on pending request
   - Click "Pay" button
   - Confirm payment
   - Wait for loading (2-3s)
   - Verify success message
   - Verify status is PAID

3. **test_decline_request**
   - Login as recipient
   - Open pending request
   - Click "Decline"
   - Confirm
   - Verify status is DECLINED

4. **test_cancel_request**
   - Login as sender
   - Open sent pending request
   - Click "Cancel"
   - Confirm
   - Verify status is CANCELLED

5. **test_request_expiration**
   - Create request with `expiresAt = now + 1 second` (override)
   - Wait 2 seconds
   - Refresh page
   - Verify status is EXPIRED

6. **test_cannot_pay_expired_request**
   - Open expired request
   - Verify "Pay" button is disabled/hidden
   - Attempt to pay via API (should fail)

7. **test_cannot_pay_already_paid_request**
   - Pay a request
   - Attempt to pay again
   - Verify error message

8. **test_shareable_link_works**
   - Create request
   - Copy shareable link
   - Open link in incognito
   - Verify request details visible
   - Verify "Log in to Pay" CTA

9. **test_invalid_amount_rejected**
   - Try to create request with $0
   - Verify error message
   - Try with negative amount
   - Verify error message

10. **test_invalid_email_rejected**
    - Try to create request with "notanemail"
    - Verify error message

**Video Recording:**
- Playwright auto-records video on failure
- Configure to record all tests: `video: 'on'`
- Store videos in `test-results/` directory

---

## Deployment Requirements

### Vercel Deployment
- Environment variables:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `DATABASE_URL` (Prisma connection string)
- Build command: `npm run build`
- Output directory: `.next`
- Node version: 20.x

### Supabase Setup
- Create project on Supabase
- Enable email auth
- Configure email templates (magic link)
- Set up Prisma migrations
- Enable Row Level Security (RLS) policies

### Database Migrations
```bash
npx prisma migrate dev --name init
npx prisma generate
```

### Post-Deployment Checklist
- ✅ Magic link emails work
- ✅ Request creation works
- ✅ Payment simulation works
- ✅ Shareable links accessible
- ✅ E2E tests pass on production URL
- ✅ Mobile responsive
- ✅ HTTPS enabled

---

## Success Metrics (Post-Launch)

### Feature Adoption
- Number of requests created (target: 100 in first week)
- Payment fulfillment rate (target: 60%)
- Average time to pay (target: < 24 hours)

### Technical Performance
- API response time p95 < 500ms
- Dashboard load time p95 < 2s
- Error rate < 1%

### User Experience
- Mobile vs desktop usage split
- Drop-off rate on payment flow (target: < 20%)
- Shareable link click-through rate

---

## Assumptions

1. **No Real Money Movement:** This is a simulation. No integration with Stripe/payment processors.
2. **Email-Only Auth:** No social login (Google, GitHub, etc.) for MVP.
3. **No Notifications:** No email/push notifications when request status changes (future enhancement).
4. **No Request Editing:** Once created, requests cannot be edited (only cancelled).
5. **Single Currency:** USD only, no multi-currency support.
6. **No Request History:** No audit log of status changes (only final timestamps).
7. **Public Shareable Links:** Anyone with the link can view (but not pay without auth).
8. **No Rate Limiting:** No API rate limits for MVP (trust users won't abuse).
9. **No Attachments:** No receipt/invoice upload with requests.
10. **Lazy Expiration:** Expiration checked on-read, no background job.

---

## Out of Scope (Future Enhancements)

- ❌ Request reminders (email/push)
- ❌ Request editing
- ❌ Recurring requests
- ❌ Split payments (multiple recipients)
- ❌ Payment scheduling
- ❌ Request templates
- ❌ Export to CSV
- ❌ Analytics dashboard
- ❌ Multi-language support
- ❌ Dark mode
- ❌ Request grouping/categories
- ❌ Social sharing (Twitter, WhatsApp)

---

## Open Questions

1. **Should declined requests be re-openable?** (Decision: No, final state)
2. **Should sender see recipient's payment method?** (Decision: No, privacy)
3. **Should there be a max amount limit?** (Decision: $99,999,999.99 via Decimal(10,2))
4. **Should requests be searchable by note text?** (Decision: Email search only for MVP)
5. **Should expired requests auto-delete?** (Decision: No, keep for history)

---

## Glossary

- **Magic Link:** Passwordless login link sent via email
- **Shareable Link:** Public URL to view a specific request
- **Lazy Expiration:** Expiration checked when request is accessed, not via cron
- **Decimal Precision:** Storing monetary values as fixed-point decimals (not floats)
- **RLS:** Row Level Security (Supabase feature for data isolation)
- **E2E:** End-to-End testing (user flow testing)

---

## References

- Venmo Request Feature: https://help.venmo.com/hc/en-us/articles/210413717
- Cash App Requests: https://cash.app/help/us/en-us/3118-request-money
- Stripe Decimal Handling: https://stripe.com/docs/currencies#zero-decimal
- Playwright Docs: https://playwright.dev/
- Supabase Auth: https://supabase.com/docs/guides/auth
- Prisma Decimal Type: https://www.prisma.io/docs/reference/api-reference/prisma-schema-reference#decimal

---

**Document Version:** 1.0  
**Last Updated:** 2026-04-10  
**Author:** Hakan (for Lovie Interview Assignment)
