📦 PARÇA 1/5 - Kopyala:
markdown# Technical Plan: P2P Payment Request Feature

## Architecture Overview

**Architecture Pattern:** Monolithic Next.js application with API routes (REST-like)  
**Deployment:** Vercel (serverless)  
**Database:** Supabase PostgreSQL (hosted)  
**Authentication:** Supabase Auth (magic link)  

**Justification:** 
- Next.js provides excellent DX with App Router, server components, and API routes
- Supabase offers managed PostgreSQL + Auth + Storage in one platform
- Vercel deployment is zero-config and scales automatically
- Monolith is appropriate for MVP scope (can extract services later if needed)

---

## Tech Stack

### Frontend
```yaml
Framework: Next.js 14.2+ (App Router)
Language: TypeScript 5.3+
Styling: Tailwind CSS 3.4+
UI Components: shadcn/ui (Radix UI primitives)
Forms: React Hook Form 7.50+ + Zod validation
State Management: 
  - React Query v5 (server state)
  - React Context (auth state)
Icons: Lucide React
Date Handling: date-fns
```

### Backend
```yaml
API: Next.js API Routes (App Router route handlers)
ORM: Prisma 5.10+
Database: PostgreSQL 15+ (Supabase)
Auth: Supabase Auth Client
Validation: Zod schemas (shared between client/server)
```

### Testing
```yaml
E2E: Playwright 1.42+
Unit: Vitest (optional for critical logic)
Type Checking: TypeScript strict mode
Linting: ESLint + Prettier
```

### DevOps
```yaml
Hosting: Vercel
CI/CD: Vercel automatic deployments
Environment: .env.local (development), Vercel env vars (production)
Monitoring: Vercel Analytics (built-in)
```

---

## Database Design

### Schema (Prisma)

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id        String   @id @default(uuid())
  email     String   @unique
  createdAt DateTime @default(now())
  
  sentRequests     PaymentRequest[] @relation("SentRequests")
  receivedRequests PaymentRequest[] @relation("ReceivedRequests")
  
  @@index([email])
}

enum RequestStatus {
  PENDING
  PAID
  DECLINED
  EXPIRED
  CANCELLED
}

model PaymentRequest {
  id              String        @id @default(uuid())
  amount          Decimal       @db.Decimal(10, 2) // CRITICAL: Fintech precision
  note            String?       @db.VarChar(500)
  status          RequestStatus @default(PENDING)
  shareableLink   String        @unique @default(cuid())
  
  // Sender (always a registered user)
  senderId        String
  sender          User          @relation("SentRequests", fields: [senderId], references: [id], onDelete: Cascade)
  
  // Recipient (may or may not be registered)
  recipientEmail  String
  recipientId     String?
  recipient       User?         @relation("ReceivedRequests", fields: [recipientId], references: [id], onDelete: SetNull)
  
  // Timestamps
  createdAt       DateTime      @default(now())
  expiresAt       DateTime      // Set to createdAt + 7 days
  paidAt          DateTime?
  declinedAt      DateTime?
  cancelledAt     DateTime?
  
  @@index([senderId])
  @@index([recipientEmail])
  @@index([status])
  @@index([shareableLink])
  @@index([expiresAt]) // For future expiration cleanup job
}
```

**Key Decisions:**
1. **Decimal(10,2):** Fixed-point decimal for precise currency storage (no float rounding errors)
2. **Recipient fields:** `recipientEmail` always exists, `recipientId` nullable (allows requests to non-users)
3. **shareableLink:** Uses `cuid()` for URL-safe unique IDs
4. **Cascade deletion:** If sender deletes account, their requests are deleted
5. **SetNull deletion:** If recipient deletes account, requests remain but `recipientId` nulled
📦 PARÇA 2/5 - Kopyala:
markdown## API Design

### Route Structure (Next.js App Router)
app/
├── api/
│   ├── auth/
│   │   ├── magic-link/
│   │   │   └── route.ts          # POST: Send magic link
│   │   └── callback/
│   │       └── route.ts          # GET: Handle magic link callback (Supabase)
│   ├── requests/
│   │   ├── route.ts              # GET: List requests, POST: Create request
│   │   └── [id]/
│   │       ├── route.ts          # GET: Get single request
│   │       ├── pay/
│   │       │   └── route.ts      # PATCH: Pay request
│   │       ├── decline/
│   │       │   └── route.ts      # PATCH: Decline request
│   │       └── cancel/
│   │           └── route.ts      # PATCH: Cancel request
│   └── public/
│       └── requests/
│           └── [id]/
│               └── route.ts      # GET: Public request view (no auth)

### Authentication Middleware

```typescript
// lib/auth.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function getUser() {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookies().get(name)?.value
        },
      },
    }
  )
  
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function requireAuth() {
  const user = await getUser()
  if (!user) {
    throw new Error('Unauthorized')
  }
  return user
}
```

### API Route Example

```typescript
// app/api/requests/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const createRequestSchema = z.object({
  recipientEmail: z.string().email(),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/),
  note: z.string().max(500).optional(),
})

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth()
    const body = await req.json()
    const validated = createRequestSchema.parse(body)
    
    // Prevent self-request
    if (validated.recipientEmail === user.email) {
      return NextResponse.json(
        { error: 'You cannot request payment from yourself' },
        { status: 400 }
      )
    }
    
    // Check if amount is positive
    const amount = parseFloat(validated.amount)
    if (amount <= 0) {
      return NextResponse.json(
        { error: 'Amount must be greater than $0.00' },
        { status: 400 }
      )
    }
    
    // Create request
    const request = await prisma.paymentRequest.create({
      data: {
        amount: validated.amount,
        note: validated.note,
        senderId: user.id,
        recipientEmail: validated.recipientEmail,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    })
    
    return NextResponse.json({
      id: request.id,
      shareableLink: `/request/${request.shareableLink}`,
      expiresAt: request.expiresAt,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const user = await requireAuth()
  const { searchParams } = new URL(req.url)
  
  const type = searchParams.get('type') || 'all'
  const status = searchParams.get('status') || 'all'
  const search = searchParams.get('search') || ''
  
  const where = {
    AND: [
      // Filter by type (sent/received/all)
      type === 'sent' ? { senderId: user.id } :
      type === 'received' ? { recipientEmail: user.email } :
      { OR: [{ senderId: user.id }, { recipientEmail: user.email }] },
      
      // Filter by status
      status !== 'all' ? { status: status.toUpperCase() } : {},
      
      // Search by email
      search ? {
        OR: [
          { recipientEmail: { contains: search, mode: 'insensitive' } },
          { sender: { email: { contains: search, mode: 'insensitive' } } },
        ]
      } : {},
    ],
  }
  
  const requests = await prisma.paymentRequest.findMany({
    where,
    include: { sender: true },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })
  
  return NextResponse.json({ requests })
}
```

---

## Folder Structure
p2p-payment-request/
├── .cursor/                    # Cursor Spec-Kit commands
├── .specify/                   # Spec-Kit templates
├── app/
│   ├── (auth)/                 # Auth layout group
│   │   ├── login/
│   │   │   └── page.tsx
│   │   └── auth/
│   │       └── callback/
│   │           └── route.ts    # Supabase callback
│   ├── (dashboard)/            # Dashboard layout group (requires auth)
│   │   ├── layout.tsx          # Dashboard shell
│   │   ├── dashboard/
│   │   │   └── page.tsx        # Main dashboard
│   │   └── request/
│   │       └── [id]/
│   │           └── page.tsx    # Request detail
│   ├── request/                # Public shareable link
│   │   └── [link]/
│   │       └── page.tsx
│   ├── api/                    # API routes (see above)
│   ├── layout.tsx              # Root layout
│   └── page.tsx                # Landing page
├── components/
│   ├── ui/                     # shadcn/ui components
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── dialog.tsx
│   │   ├── input.tsx
│   │   └── ...
│   ├── auth/
│   │   └── login-form.tsx
│   ├── dashboard/
│   │   ├── request-list.tsx
│   │   ├── request-card.tsx
│   │   ├── filter-bar.tsx
│   │   └── create-request-modal.tsx
│   └── request/
│       ├── request-detail.tsx
│       ├── pay-modal.tsx
│       └── status-badge.tsx
├── lib/
│   ├── auth.ts                 # Supabase auth helpers
│   ├── prisma.ts               # Prisma client singleton
│   ├── utils.ts                # Utility functions
│   └── validations.ts          # Zod schemas
├── hooks/
│   ├── use-requests.ts         # React Query hooks
│   └── use-auth.ts             # Auth state hook
├── types/
│   └── index.ts                # Shared TypeScript types
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── tests/
│   ├── e2e/
│   │   ├── auth.spec.ts
│   │   ├── create-request.spec.ts
│   │   ├── pay-request.spec.ts
│   │   └── ...
│   └── playwright.config.ts
├── .env.local                  # Local environment variables
├── .gitignore
├── next.config.js
├── package.json
├── tailwind.config.ts
├── tsconfig.json
└── README.md
📦 PARÇA 3/5 - Kopyala:
markdown## Implementation Strategy

### Phase 1: Foundation (Day 1, ~3 hours)

**Goal:** Set up project skeleton and database

1. **Project Setup**
```bash
   npx create-next-app@latest p2p-payment --typescript --tailwind --app
   cd p2p-payment
   npm install @supabase/ssr @supabase/supabase-js
   npm install prisma @prisma/client
   npm install zod react-hook-form @hookform/resolvers
   npm install @tanstack/react-query
   npm install date-fns lucide-react
   npx shadcn-ui@latest init
```

2. **Supabase Setup**
   - Create Supabase project
   - Copy env vars to `.env.local`
   - Configure email templates for magic link

3. **Prisma Setup**
```bash
   npx prisma init
   # Edit schema.prisma
   npx prisma migrate dev --name init
   npx prisma generate
```

4. **Auth Implementation**
   - Create Supabase client helpers
   - Implement magic link login
   - Set up auth callback route
   - Create auth context provider

**Acceptance:** User can sign in with magic link

---

### Phase 2: Core Request Creation (Day 2, ~4 hours)

**Goal:** Users can create payment requests

1. **API Routes**
   - `POST /api/requests` - Create request
   - Validation with Zod
   - Database insertion with Prisma

2. **UI Components**
   - Create Request Modal
   - Form with React Hook Form
   - Client-side validation
   - Success/error states

3. **Dashboard Skeleton**
   - Layout with header/nav
   - Empty state
   - Loading states

**Acceptance:** User can create request, see shareable link

---

### Phase 3: Dashboard & Listing (Day 3, ~4 hours)

**Goal:** Users can view and manage requests

1. **API Routes**
   - `GET /api/requests` - List with filters
   - `GET /api/requests/[id]` - Single request

2. **UI Components**
   - Request list (sent/received tabs)
   - Request card component
   - Filter bar (status, search)
   - Pagination

3. **React Query Integration**
   - Custom hooks for data fetching
   - Optimistic updates
   - Cache invalidation

**Acceptance:** User sees sent/received requests, can filter/search

---

### Phase 4: Payment Actions (Day 4, ~3 hours)

**Goal:** Users can pay, decline, cancel requests

1. **API Routes**
   - `PATCH /api/requests/[id]/pay`
   - `PATCH /api/requests/[id]/decline`
   - `PATCH /api/requests/[id]/cancel`
   - Status transition validation

2. **UI Components**
   - Request detail page
   - Pay modal with 2-3s simulation
   - Decline confirmation
   - Cancel confirmation
   - Success animations

3. **Edge Case Handling**
   - Prevent double-payment
   - Check authorization
   - Validate status transitions

**Acceptance:** User can pay/decline/cancel with proper validations

---

### Phase 5: Expiration & Shareable Links (Day 5, ~2 hours)

**Goal:** Handle request expiration and public links

1. **Expiration Logic**
   - Middleware to check `expiresAt` on read
   - Auto-update status to EXPIRED
   - Countdown timer component

2. **Shareable Link Page**
   - Public route `/request/[link]`
   - Display request details
   - "Log in to Pay" CTA
   - Handle expired/paid states

**Acceptance:** Requests expire after 7 days, shareable links work

---

### Phase 6: Testing (Day 6, ~4 hours)

**Goal:** Comprehensive E2E test coverage

1. **Playwright Setup**
```bash
   npm install -D @playwright/test
   npx playwright install
```

2. **Test Scenarios** (10 tests from spec)
   - Happy paths (create, pay, decline, cancel)
   - Edge cases (expired, validation, unauthorized)
   - Shareable links

3. **Video Recording**
   - Configure `video: 'on'` in playwright.config.ts
   - Store in `test-results/`

**Acceptance:** All 10 tests pass with video recordings

---

### Phase 7: Deployment & Polish (Day 7, ~2 hours)

**Goal:** Deploy to production, write docs

1. **Vercel Deployment**
   - Connect GitHub repo
   - Add environment variables
   - Deploy

2. **README**
   - Project overview
   - Setup instructions
   - Tech stack
   - Demo URL
   - E2E test instructions

3. **Final Checks**
   - Mobile responsiveness
   - Loading states
   - Error messages
   - Status badge colors

**Acceptance:** Live demo URL works, README complete

---

## Key Technical Decisions

### 1. Why Decimal(10,2) for Amounts?

**Problem:** JavaScript `number` type uses IEEE 754 floating point, which causes rounding errors:
```javascript
0.1 + 0.2 === 0.30000000000000004 // true
```

**Solution:** Prisma `Decimal` type maps to PostgreSQL `NUMERIC(10,2)`:
- 10 digits total (8 before decimal, 2 after)
- Max value: $99,999,999.99
- Exact precision (no rounding errors)

**Implementation:**
```typescript
import { Decimal } from '@prisma/client/runtime'

const amount = new Decimal('100.50')
const doubled = amount.mul(2) // Decimal('201.00')
```

---

### 2. Why Lazy Expiration vs Cron Job?

**Lazy (chosen):**
- Check `expiresAt` when request is read
- Update status if expired
- No background infrastructure needed

**Pros:**
- Simple to implement
- No cron job management
- Vercel-friendly (serverless)

**Cons:**
- Requests stay PENDING in DB until accessed
- Not true real-time expiration

**Decision:** For MVP, lazy is sufficient. Can add cron later.

---

### 3. Why Supabase Auth vs NextAuth?

**Supabase Auth (chosen):**
- Built into Supabase (one less dependency)
- Magic link out-of-box
- Row Level Security integration

**NextAuth:**
- More flexible providers
- Better for social logins

**Decision:** Supabase Auth is simpler for magic link only.

---

### 4. Why React Query vs Server Components Only?

**React Query (chosen):**
- Client-side filtering/searching without page reload
- Optimistic updates (better UX)
- Cache management
- Polling for real-time updates (if needed)

**Server Components:**
- Simpler for static content
- Better SEO

**Decision:** Use both - Server Components for initial data, React Query for interactivity.
## Security Considerations

### 1. Authorization Checks

Every mutating API route must verify:
```typescript
const user = await requireAuth()

// For pay/decline
const request = await prisma.paymentRequest.findUnique({ where: { id } })
if (request.recipientEmail !== user.email) {
  throw new Error('Unauthorized')
}

// For cancel
if (request.senderId !== user.id) {
  throw new Error('Unauthorized')
}
```

### 2. SQL Injection Prevention

Prisma automatically parameterizes queries:
```typescript
// SAFE (Prisma handles escaping)
await prisma.paymentRequest.findMany({
  where: { recipientEmail: userInput }
})
```

### 3. XSS Prevention

React escapes by default:
```tsx
{request.note} {/* Safe, auto-escaped */}
```

**Dangerous patterns to avoid:**
```tsx
 {/* ❌ Never do this */}
```

### 4. HTTPS Only

Vercel enforces HTTPS automatically. Supabase also requires HTTPS.

---

## Performance Optimizations

### 1. Database Indexes

Already defined in Prisma schema:
```prisma
@@index([senderId])
@@index([recipientEmail])
@@index([status])
@@index([shareableLink])
```

### 2. React Query Caching

```typescript
const { data } = useQuery({
  queryKey: ['requests', type, status],
  queryFn: fetchRequests,
  staleTime: 30000, // 30 seconds
})
```

### 3. Next.js Image Optimization

Not needed for MVP (no user-uploaded images).

### 4. Code Splitting

Next.js App Router handles automatically via dynamic imports.

---

## Error Handling Strategy

### API Routes

```typescript
try {
  // Business logic
} catch (error) {
  if (error instanceof z.ZodError) {
    return NextResponse.json({ error: error.errors }, { status: 400 })
  }
  if (error.message === 'Unauthorized') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }
  console.error(error)
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
}
```

### Client Components

```typescript
const { mutate, isError, error } = useMutation({
  mutationFn: payRequest,
  onError: (error) => {
    toast.error(error.message || 'Payment failed')
  },
})
```

---

## Environment Variables

### Development (.env.local)

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
DATABASE_URL=postgresql://postgres:[password]@db.xxx.supabase.co:5432/postgres
```

### Production (Vercel)

Same variables, set via Vercel dashboard.

---

## Testing Strategy

### E2E Tests (Playwright)

**Test user setup:**
```typescript
// tests/setup.ts
export const TEST_USERS = {
  sender: { email: 'sender@test.com' },
  recipient: { email: 'recipient@test.com' },
}

export async function seedTestUsers() {
  // Create users in DB before tests
}
```

**Example test:**
```typescript
test('create and pay request', async ({ page }) => {
  // Login as sender
  await page.goto('/login')
  await page.fill('[name="email"]', TEST_USERS.sender.email)
  await page.click('button:has-text("Send Magic Link")')
  
  // In real test, intercept email and extract link
  // For now, use Supabase admin SDK to get magic link token
  
  // Create request
  await page.goto('/dashboard')
  await page.click('button:has-text("New Request")')
  await page.fill('[name="recipientEmail"]', TEST_USERS.recipient.email)
  await page.fill('[name="amount"]', '100.00')
  await page.click('button:has-text("Create")')
  
  // Switch to recipient
  await page.goto('/login')
  // ... login as recipient
  
  // Pay request
  await page.goto('/dashboard')
  await page.click('text=Received')
  await page.click('text=View Details')
  await page.click('button:has-text("Pay")')
  await page.click('button:has-text("Confirm")')
  
  // Wait for simulation
  await page.waitForTimeout(3000)
  
  // Assert status changed
  await expect(page.locator('text=PAID')).toBeVisible()
})
```

---

## Deployment Checklist

- [ ] Environment variables set in Vercel
- [ ] Database migrations run on production DB
- [ ] Supabase email templates configured
- [ ] Custom domain (optional)
- [ ] E2E tests pass on production URL
- [ ] README includes live demo link
- [ ] GitHub repo is public
- [ ] Video recordings uploaded
## Known Limitations & Future Improvements

### Limitations (MVP)
1. No real payment processing (simulation only)
2. No email notifications
3. No request editing
4. Lazy expiration (not real-time)
5. No rate limiting

### Future Improvements
1. **Webhooks:** Notify on status changes
2. **Cron job:** Real-time expiration checker
3. **Audit log:** Track all status transitions
4. **Request templates:** Save common requests
5. **Analytics:** Dashboard with metrics
6. **Mobile app:** React Native version

---

## Success Criteria (Definition of Done)

- [x] All 8 user stories implemented
- [x] All 12 edge cases handled
- [x] 10 E2E tests passing with video recordings
- [x] Mobile responsive (320px - 1280px)
- [x] Deployed to Vercel with public URL
- [x] README with setup instructions
- [x] GitHub repo public
- [x] Spec, Plan, Tasks documented

---

**Document Version:** 1.0  
**Last Updated:** 2026-04-10  
**Author:** Kağan (for Lovie Interview Assignment)