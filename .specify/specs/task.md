# Tasks: P2P Payment Request Feature

## Overview

This document breaks down the implementation into actionable tasks organized by phase. Each task includes acceptance criteria and estimated time.

**Total Estimated Time:** 20-24 hours across 7 days

---

## Phase 1: Foundation Setup (Day 1, ~3 hours)

### T001: Initialize Next.js Project
**Description:** Create Next.js 14 project with TypeScript, Tailwind, and App Router

**Steps:**
```bash
npx create-next-app@latest p2p-payment-request --typescript --tailwind --app --eslint
cd p2p-payment-request
```

**Acceptance Criteria:**
- Project created with TypeScript
- Tailwind CSS configured
- App Router enabled
- ESLint configured

**Estimated Time:** 15 minutes

---

### T002: Install Core Dependencies
**Description:** Install all required packages for the project

**Steps:**
```bash
npm install @supabase/ssr @supabase/supabase-js
npm install prisma @prisma/client
npm install zod react-hook-form @hookform/resolvers
npm install @tanstack/react-query
npm install date-fns lucide-react
npm install clsx tailwind-merge class-variance-authority
npx shadcn-ui@latest init
```

**Acceptance Criteria:**
- All dependencies installed successfully
- shadcn/ui initialized
- No installation errors

**Estimated Time:** 20 minutes

---

### T003: Create Supabase Project
**Description:** Set up Supabase project for database and authentication

**Steps:**
1. Go to https://supabase.com
2. Create new project: "p2p-payment-request"
3. Wait for provisioning
4. Copy project URL and anon key
5. Enable Email Auth in Authentication settings
6. Configure email templates for magic link

**Acceptance Criteria:**
- Supabase project created
- Email auth enabled
- Environment variables copied

**Estimated Time:** 30 minutes

---

### T004: Configure Environment Variables
**Description:** Set up local environment configuration

**Create `.env.local`:**
```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.xxx.supabase.co:5432/postgres
```

**Acceptance Criteria:**
- `.env.local` created
- All variables set correctly
- File added to `.gitignore`

**Estimated Time:** 10 minutes

---

### T005: Setup Prisma
**Description:** Initialize Prisma and create database schema

**Steps:**
```bash
npx prisma init
```

**Edit `prisma/schema.prisma`:**
```prisma
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
  amount          Decimal       @db.Decimal(10, 2)
  note            String?       @db.VarChar(500)
  status          RequestStatus @default(PENDING)
  shareableLink   String        @unique @default(cuid())
  
  senderId        String
  sender          User          @relation("SentRequests", fields: [senderId], references: [id], onDelete: Cascade)
  
  recipientEmail  String
  recipientId     String?
  recipient       User?         @relation("ReceivedRequests", fields: [recipientId], references: [id], onDelete: SetNull)
  
  createdAt       DateTime      @default(now())
  expiresAt       DateTime
  paidAt          DateTime?
  declinedAt      DateTime?
  cancelledAt     DateTime?
  
  @@index([senderId])
  @@index([recipientEmail])
  @@index([status])
  @@index([shareableLink])
  @@index([expiresAt])
}
```

**Run migration:**
```bash
npx prisma migrate dev --name init
npx prisma generate
```

**Acceptance Criteria:**
- Schema created correctly
- Migration applied to database
- Prisma client generated
- Tables visible in Supabase dashboard

**Estimated Time:** 30 minutes

---

### T006: Create Prisma Client Singleton
**Description:** Set up Prisma client for use across the app

**Create `lib/prisma.ts`:**
```typescript
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

**Acceptance Criteria:**
- Prisma client singleton created
- No multiple instance warnings

**Estimated Time:** 10 minutes

---

### T007: Create Supabase Auth Helpers
**Description:** Set up Supabase authentication utilities

**Create `lib/supabase/server.ts`:**
```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export function createClient() {
  const cookieStore = cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
      },
    }
  )
}
```

**Create `lib/supabase/client.ts`:**
```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

**Create `lib/auth.ts`:**
```typescript
import { createClient } from '@/lib/supabase/server'

export async function getUser() {
  const supabase = createClient()
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

**Acceptance Criteria:**
- Server and client Supabase helpers created
- Auth utility functions working

**Estimated Time:** 20 minutes

---

### T008: Implement Magic Link Login
**Description:** Create login page with magic link authentication

**Create `app/(auth)/login/page.tsx`:**
```typescript
'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      setMessage(error.message)
    } else {
      setMessage('Check your email for the magic link!')
    }
    setLoading(false)
  }

  return (
    
      
        Sign In
        
          <Input
            type="email"
            placeholder="Your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          
            {loading ? 'Sending...' : 'Send Magic Link'}
          
        
        {message && {message}}
      
    
  )
}
```

**Create `app/auth/callback/route.ts`:**
```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const supabase = createClient()
    await supabase.auth.exchangeCodeForSession(code)
  }

  return NextResponse.redirect(new URL('/dashboard', request.url))
}
```

**Acceptance Criteria:**
- Login page renders
- Magic link sent on form submit
- Email received with magic link
- Clicking link redirects to dashboard
- User session created
## Phase 2: Core Request Creation (Day 2, ~4 hours)

### T009: Create Zod Validation Schemas
**Description:** Define validation schemas for request data

**Create `lib/validations.ts`:**
```typescript
import { z } from 'zod'

export const createRequestSchema = z.object({
  recipientEmail: z.string().email('Invalid email address'),
  amount: z.string()
    .regex(/^\d+(\.\d{1,2})?$/, 'Amount must have max 2 decimal places')
    .refine(val => parseFloat(val) > 0, 'Amount must be greater than $0.00'),
  note: z.string().max(500, 'Note cannot exceed 500 characters').optional(),
})

export type CreateRequestInput = z.infer
```

**Acceptance Criteria:**
- Schema validates email format
- Schema validates amount (positive, max 2 decimals)
- Schema validates note length

**Estimated Time:** 15 minutes

---

### T010: Create Request API Route
**Description:** Implement POST /api/requests endpoint

**Create `app/api/requests/route.ts`:**
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createRequestSchema } from '@/lib/validations'
import { z } from 'zod'

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
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error(error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

**Acceptance Criteria:**
- Endpoint requires authentication
- Validates request data
- Prevents self-requests
- Creates request in database
- Returns shareable link
- Handles errors properly

**Estimated Time:** 30 minutes

---

### T011: Install shadcn/ui Components
**Description:** Install UI components needed for forms

**Steps:**
```bash
npx shadcn-ui@latest add button
npx shadcn-ui@latest add input
npx shadcn-ui@latest add dialog
npx shadcn-ui@latest add form
npx shadcn-ui@latest add label
npx shadcn-ui@latest add toast
npx shadcn-ui@latest add textarea
```

**Acceptance Criteria:**
- All components installed in `components/ui/`
- No import errors

**Estimated Time:** 10 minutes

---

### T012: Create Request Form Component
**Description:** Build form for creating payment requests

**Create `components/dashboard/create-request-form.tsx`:**
```typescript
'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createRequestSchema, type CreateRequestInput } from '@/lib/validations'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/use-toast'

export function CreateRequestForm({ onSuccess }: { onSuccess: () => void }) {
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()
  
  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(createRequestSchema),
  })

  const onSubmit = async (data: CreateRequestInput) => {
    setLoading(true)
    try {
      const res = await fetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to create request')
      }

      const result = await res.json()
      toast({
        title: 'Request created!',
        description: `Shareable link: ${result.shareableLink}`,
      })
      onSuccess()
    } catch (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    
      
        Recipient Email
        
        {errors.recipientEmail && (
          {errors.recipientEmail.message}
        )}
      

      
        Amount ($)
        
        {errors.amount && (
          {errors.amount.message}
        )}
      

      
        Note (optional)
        
        {errors.note && (
          {errors.note.message}
        )}
      

      
        {loading ? 'Creating...' : 'Create Request'}
      
    
  )
}
```

**Acceptance Criteria:**
- Form validates input
- Shows validation errors
- Submits to API
- Shows success/error toasts
- Disables during submission

**Estimated Time:** 45 minutes

---

### T013: Create Request Modal
**Description:** Modal wrapper for create request form

**Create `components/dashboard/create-request-modal.tsx`:**
```typescript
'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { CreateRequestForm } from './create-request-form'
import { Plus } from 'lucide-react'

export function CreateRequestModal() {
  const [open, setOpen] = useState(false)

  return (
    
      
        
          
          New Request
        
      
      
        
          Create Payment Request
        
        <CreateRequestForm onSuccess={() => setOpen(false)} />
      
    
  )
}
```

**Acceptance Criteria:**
- Modal opens on button click
- Form renders inside modal
- Modal closes on successful submission
- Modal closes on cancel

**Estimated Time:** 20 minutes

---

### T014: Create Basic Dashboard Layout
**Description:** Set up dashboard shell with header and navigation

**Create `app/(dashboard)/layout.tsx`:**
```typescript
import { getUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getUser()
  
  if (!user) {
    redirect('/login')
  }

  const handleSignOut = async () => {
    'use server'
    const supabase = createClient()
    await supabase.auth.signOut()
    redirect('/login')
  }

  return (
    
      
        
          Payment Requests
          
            {user.email}
            
              Sign Out
            
          
        
      
      
        {children}
      
    
  )
}
```

**Create `app/(dashboard)/dashboard/page.tsx`:**
```typescript
import { CreateRequestModal } from '@/components/dashboard/create-request-modal'

export default function DashboardPage() {
  return (
    
      
        Dashboard
        
      
      Request list will go here...
    
  )
}
```

**Acceptance Criteria:**
- Dashboard accessible at /dashboard
- Redirects to login if not authenticated
- Header shows user email
- Sign out button works
- Create request modal accessible
## Phase 3: Dashboard & Listing (Day 3, ~4 hours)

### T015: Setup React Query
**Description:** Configure React Query for data fetching

**Create `app/providers.tsx`:**
```typescript
'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000, // 1 minute
      },
    },
  }))

  return (
    
      {children}
    
  )
}
```

**Update `app/layout.tsx`:**
```typescript
import { Providers } from './providers'

export default function RootLayout({ children }) {
  return (
    
      
        {children}
      
    
  )
}
```

**Acceptance Criteria:**
- React Query provider wraps app
- Default options configured

**Estimated Time:** 15 minutes

---

### T016: Create List Requests API Route
**Description:** Implement GET /api/requests with filtering

**Update `app/api/requests/route.ts` (add GET):**
```typescript
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth()
    const { searchParams } = new URL(req.url)
    
    const type = searchParams.get('type') || 'all'
    const status = searchParams.get('status') || 'all'
    const search = searchParams.get('search') || ''
    
    const where: any = {
      AND: [
        // Filter by type
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
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

**Acceptance Criteria:**
- Endpoint returns user's requests
- Filters by type (sent/received/all)
- Filters by status
- Searches by email
- Includes sender info
- Sorts by newest first

**Estimated Time:** 30 minutes

---

### T017: Create useRequests Hook
**Description:** React Query hook for fetching requests

**Create `hooks/use-requests.ts`:**
```typescript
import { useQuery } from '@tanstack/react-query'

type RequestsParams = {
  type?: 'all' | 'sent' | 'received'
  status?: string
  search?: string
}

export function useRequests(params: RequestsParams = {}) {
  return useQuery({
    queryKey: ['requests', params],
    queryFn: async () => {
      const searchParams = new URLSearchParams()
      if (params.type) searchParams.set('type', params.type)
      if (params.status) searchParams.set('status', params.status)
      if (params.search) searchParams.set('search', params.search)
      
      const res = await fetch(`/api/requests?${searchParams}`)
      if (!res.ok) throw new Error('Failed to fetch requests')
      return res.json()
    },
  })
}
```

**Acceptance Criteria:**
- Hook fetches requests from API
- Accepts filter parameters
- Caches results
- Handles loading/error states

**Estimated Time:** 15 minutes

---

### T018: Create Status Badge Component
**Description:** Color-coded badge for request status

**Create `components/request/status-badge.tsx`:**
```typescript
import { cn } from '@/lib/utils'

const statusStyles = {
  PENDING: 'bg-blue-100 text-blue-800',
  PAID: 'bg-green-100 text-green-800',
  DECLINED: 'bg-red-100 text-red-800',
  EXPIRED: 'bg-gray-100 text-gray-800',
  CANCELLED: 'bg-orange-100 text-orange-800',
}

export function StatusBadge({ status }: { status: string }) {
  return (
    
      {status}
    
  )
}
```

**Acceptance Criteria:**
- Badge displays status
- Correct colors for each status
- Small, rounded appearance

**Estimated Time:** 10 minutes

---

### T019: Create Request Card Component
**Description:** Card component for displaying request in list

**Install card component:**
```bash
npx shadcn-ui@latest add card
```

**Create `components/dashboard/request-card.tsx`:**
```typescript
import Link from 'next/link'
import { format } from 'date-fns'
import { StatusBadge } from '@/components/request/status-badge'
import { Card, CardContent } from '@/components/ui/card'

type Request = {
  id: string
  amount: string
  note: string | null
  status: string
  recipientEmail: string
  sender: { email: string }
  createdAt: string
}

export function RequestCard({ request }: { request: Request }) {
  return (
    
      
        
          
            
              ${request.amount}
              {request.recipientEmail}
              {request.note && (
                
                  {request.note}
                
              )}
            
            
          
          
            {format(new Date(request.createdAt), 'MMM d, yyyy')}
          
        
      
    
  )
}
```

**Acceptance Criteria:**
- Displays amount, recipient, note, status
- Shows creation date
- Truncates long notes
- Links to detail page
- Hover effect

**Estimated Time:** 20 minutes

---

### T020: Create Request List Component
**Description:** List view with tabs for sent/received

**Install tabs and select components:**
```bash
npx shadcn-ui@latest add tabs
npx shadcn-ui@latest add select
```

**Create `components/dashboard/request-list.tsx`:**
```typescript
'use client'

import { useState } from 'react'
import { useRequests } from '@/hooks/use-requests'
import { RequestCard } from './request-card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export function RequestList() {
  const [type, setType] = useState('all')
  const [status, setStatus] = useState('all')
  const [search, setSearch] = useState('')
  
  const { data, isLoading, error } = useRequests({ type, status, search })

  if (isLoading) return Loading...
  if (error) return Error loading requests

  return (
    
      
        <Input
          placeholder="Search by email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        
          
            
          
          
            All
            Pending
            Paid
            Declined
            Expired
            Cancelled
          
        
      

      <Tabs value={type} onValueChange={(v) => setType(v as any)}>
        
          All
          Sent
          Received
        

        
          {data?.requests.length === 0 ? (
            No requests found
          ) : (
            data?.requests.map((request) => (
              
            ))
          )}
        
      
    
  )
}
```

**Acceptance Criteria:**
- Shows sent/received/all tabs
- Filter by status dropdown
- Search by email input
- Displays loading state
- Shows empty state
- Updates on filter change

**Estimated Time:** 40 minutes

---

### T021: Update Dashboard Page
**Description:** Add request list to dashboard

**Update `app/(dashboard)/dashboard/page.tsx`:**
```typescript
import { CreateRequestModal } from '@/components/dashboard/create-request-modal'
import { RequestList } from '@/components/dashboard/request-list'

export default function DashboardPage() {
  return (
    
      
        Dashboard
        
      
      
    
  )
}
```

**Acceptance Criteria:**
- Dashboard shows request list
- Create button still visible
- Layout looks good on mobile
## Phase 4: Payment Actions (Day 4, ~3 hours)

### T022: Create Get Single Request API Route
**Description:** Implement GET /api/requests/[id]

**Create `app/api/requests/[id]/route.ts`:**
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth()
    
    const request = await prisma.paymentRequest.findUnique({
      where: { id: params.id },
      include: { sender: true, recipient: true },
    })

    if (!request) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    }

    // Check authorization
    if (request.senderId !== user.id && request.recipientEmail !== user.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Check expiration
    if (request.status === 'PENDING' && new Date() > request.expiresAt) {
      await prisma.paymentRequest.update({
        where: { id: params.id },
        data: { status: 'EXPIRED' },
      })
      request.status = 'EXPIRED'
    }

    return NextResponse.json({ request })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

**Acceptance Criteria:**
- Returns single request
- Checks authorization
- Updates expired requests
- Returns 404 for missing requests

**Estimated Time:** 20 minutes

---

### T023: Create Pay Request API Route
**Description:** Implement PATCH /api/requests/[id]/pay

**Create `app/api/requests/[id]/pay/route.ts`:**
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth()
    
    const request = await prisma.paymentRequest.findUnique({
      where: { id: params.id },
    })

    if (!request) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    }

    // Authorization: must be recipient
    if (request.recipientEmail !== user.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Check if already paid
    if (request.status === 'PAID') {
      return NextResponse.json({ error: 'Request already paid' }, { status: 400 })
    }

    // Check if expired
    if (new Date() > request.expiresAt) {
      await prisma.paymentRequest.update({
        where: { id: params.id },
        data: { status: 'EXPIRED' },
      })
      return NextResponse.json({ error: 'Request expired' }, { status: 400 })
    }

    // Check status
    if (request.status !== 'PENDING') {
      return NextResponse.json({ 
        error: `Cannot pay ${request.status.toLowerCase()} request` 
      }, { status: 400 })
    }

    // Simulate 2-3 second payment processing
    await new Promise(resolve => setTimeout(resolve, 2500))

    // Update status to PAID
    const updated = await prisma.paymentRequest.update({
      where: { id: params.id },
      data: {
        status: 'PAID',
        paidAt: new Date(),
        recipientId: user.id,
      },
      include: { sender: true },
    })

    return NextResponse.json({ request: updated })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

**Acceptance Criteria:**
- Only recipient can pay
- Validates status is PENDING
- Checks expiration
- Prevents double payment
- Simulates 2-3s delay
- Updates status to PAID
- Records payment timestamp

**Estimated Time:** 30 minutes

---

### T024: Create Decline Request API Route
**Description:** Implement PATCH /api/requests/[id]/decline

**Create `app/api/requests/[id]/decline/route.ts`:**
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth()
    
    const request = await prisma.paymentRequest.findUnique({
      where: { id: params.id },
    })

    if (!request) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    }

    // Authorization: must be recipient
    if (request.recipientEmail !== user.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Check status
    if (request.status !== 'PENDING') {
      return NextResponse.json({ 
        error: `Cannot decline ${request.status.toLowerCase()} request` 
      }, { status: 400 })
    }

    // Update status to DECLINED
    const updated = await prisma.paymentRequest.update({
      where: { id: params.id },
      data: {
        status: 'DECLINED',
        declinedAt: new Date(),
      },
      include: { sender: true },
    })

    return NextResponse.json({ request: updated })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

**Acceptance Criteria:**
- Only recipient can decline
- Validates status is PENDING
- Updates status to DECLINED
- Records decline timestamp

**Estimated Time:** 20 minutes

---

### T025: Create Cancel Request API Route
**Description:** Implement PATCH /api/requests/[id]/cancel

**Create `app/api/requests/[id]/cancel/route.ts`:**
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth()
    
    const request = await prisma.paymentRequest.findUnique({
      where: { id: params.id },
    })

    if (!request) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    }

    // Authorization: must be sender
    if (request.senderId !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Check status
    if (request.status !== 'PENDING') {
      return NextResponse.json({ 
        error: `Cannot cancel ${request.status.toLowerCase()} request` 
      }, { status: 400 })
    }

    // Update status to CANCELLED
    const updated = await prisma.paymentRequest.update({
      where: { id: params.id },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
      },
      include: { sender: true },
    })

    return NextResponse.json({ request: updated })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

**Acceptance Criteria:**
- Only sender can cancel
- Validates status is PENDING
- Updates status to CANCELLED
- Records cancellation timestamp

**Estimated Time:** 20 minutes

---

### T026: Create Request Detail Page
**Description:** Page for viewing single request with actions

**Install alert-dialog component:**
```bash
npx shadcn-ui@latest add alert-dialog
```

**Create `app/(dashboard)/request/[id]/page.tsx`:**
```typescript
'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatusBadge } from '@/components/request/status-badge'
import { useToast } from '@/components/ui/use-toast'
import { useState } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

export default function RequestDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [showPayDialog, setShowPayDialog] = useState(false)
  const [showDeclineDialog, setShowDeclineDialog] = useState(false)
  const [showCancelDialog, setShowCancelDialog] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['request', params.id],
    queryFn: async () => {
      const res = await fetch(`/api/requests/${params.id}`)
      if (!res.ok) throw new Error('Failed to fetch request')
      return res.json()
    },
  })

  const payMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/requests/${params.id}/pay`, { method: 'PATCH' })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error)
      }
      return res.json()
    },
    onSuccess: () => {
      toast({ title: 'Payment successful!' })
      queryClient.invalidateQueries({ queryKey: ['request', params.id] })
      queryClient.invalidateQueries({ queryKey: ['requests'] })
      setShowPayDialog(false)
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    },
  })

  const declineMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/requests/${params.id}/decline`, { method: 'PATCH' })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error)
      }
      return res.json()
    },
    onSuccess: () => {
      toast({ title: 'Request declined' })
      queryClient.invalidateQueries({ queryKey: ['request', params.id] })
      queryClient.invalidateQueries({ queryKey: ['requests'] })
      setShowDeclineDialog(false)
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    },
  })

  const cancelMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/requests/${params.id}/cancel`, { method: 'PATCH' })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error)
      }
      return res.json()
    },
    onSuccess: () => {
      toast({ title: 'Request cancelled' })
      queryClient.invalidateQueries({ queryKey: ['request', params.id] })
      queryClient.invalidateQueries({ queryKey: ['requests'] })
      setShowCancelDialog(false)
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    },
  })

  if (isLoading) return Loading...

  const request = data?.request
  if (!request) return Request not found

  return (
    
      <Button variant="outline" onClick={() => router.back()} className="mb-4">
        ← Back
      

      
        
          
            Request Details
            
          
        
        
          
            ${request.amount}
          

          
            
              From
              {request.sender.email}
            
            
              To
              {request.recipientEmail}
            
            
              Created
              {format(new Date(request.createdAt), 'PPP')}
            
            
              Expires
              {format(new Date(request.expiresAt), 'PPP')}
            
          

          {request.note && (
            
              Note
              {request.note}
            
          )}

          
            Shareable Link
            
              {`${window.location.origin}/request/${request.shareableLink}`}
            
          

          
            {request.status === 'PENDING' && (
              <>
                <Button onClick={() => setShowPayDialog(true)} disabled={payMutation.isPending}>
                  {payMutation.isPending ? 'Processing...' : 'Pay'}
                
                <Button variant="outline" onClick={() => setShowDeclineDialog(true)} disabled={declineMutation.isPending}>
                  Decline
                
                <Button variant="destructive" onClick={() => setShowCancelDialog(true)} disabled={cancelMutation.isPending}>
                  Cancel
                
              </>
            )}
          
        
      

      {/* Pay Confirmation Dialog */}
      
        
          
            Confirm Payment
            
              Are you sure you want to pay ${request.amount}?
            
          
          
            Cancel
            <AlertDialogAction onClick={() => payMutation.mutate()}>
              Confirm Payment
            
          
        
      

      {/* Decline Confirmation Dialog */}
      
        
          
            Decline Request
            
              Are you sure you want to decline this payment request?
            
          
          
            Cancel
            <AlertDialogAction onClick={() => declineMutation.mutate()}>
              Decline
            
          
        
      

      {/* Cancel Confirmation Dialog */}
      
        
          
            Cancel Request
            
              Are you sure you want to cancel this payment request?
            
          
          
            Cancel
            <AlertDialogAction onClick={() => cancelMutation.mutate()}>
              Confirm Cancellation
            
          
        
      
    
  )
}
```

**Acceptance Criteria:**
- Shows all request details
- Displays correct actions based on status
- Pay button shows loading state (2-3s)
- Confirmation dialogs for all actions
- Updates UI after actions
- Shows shareable link
## Phase 5: Expiration & Shareable Links (Day 5, ~2 hours)

### T027: Create Public Request View API Route
**Description:** Public endpoint for viewing request via shareable link

**Create `app/api/public/requests/[id]/route.ts`:**
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const request = await prisma.paymentRequest.findUnique({
      where: { shareableLink: params.id },
      include: { sender: true },
    })

    if (!request) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    }

    // Check expiration
    if (request.status === 'PENDING' && new Date() > request.expiresAt) {
      await prisma.paymentRequest.update({
        where: { id: request.id },
        data: { status: 'EXPIRED' },
      })
      request.status = 'EXPIRED'
    }

    // Return public info only (don't expose recipient email for privacy)
    return NextResponse.json({
      request: {
        id: request.id,
        amount: request.amount,
        note: request.note,
        status: request.status,
        senderEmail: request.sender.email,
        expiresAt: request.expiresAt,
        createdAt: request.createdAt,
      },
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

**Acceptance Criteria:**
- No authentication required
- Finds request by shareable link
- Checks expiration
- Returns public data only (no recipient email)
- Returns 404 for invalid links

**Estimated Time:** 20 minutes

---

### T028: Create Public Shareable Link Page
**Description:** Public page for viewing request from shareable link

**Create `app/request/[link]/page.tsx`:**
```typescript
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatusBadge } from '@/components/request/status-badge'
import { format } from 'date-fns'
import Link from 'next/link'

async function getPublicRequest(link: string) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/public/requests/${link}`, {
    cache: 'no-store',
  })
  if (!res.ok) return null
  return res.json()
}

export default async function PublicRequestPage({ params }: { params: { link: string } }) {
  const data = await getPublicRequest(params.link)

  if (!data || !data.request) {
    return (
      
        
          
            Request Not Found
          
          
            This payment request does not exist or has been removed.
          
        
      
    )
  }

  const request = data.request
  const isPending = request.status === 'PENDING'

  return (
    
      
        
          
            Payment Request
            
          
        
        
          
            ${request.amount}
            
              from {request.senderEmail}
            
          

          {request.note && (
            
              Note
              {request.note}
            
          )}

          
            Created: {format(new Date(request.createdAt), 'PPP')}
            Expires: {format(new Date(request.expiresAt), 'PPP')}
          

          {isPending ? (
            
              Log In to Pay
            
          ) : (
            
              This request has been {request.status.toLowerCase()}.
            
          )}

          
            Powered by Payment Request App
          
        
      
    
  )
}
```

**Acceptance Criteria:**
- No authentication required
- Shows request details
- Hides recipient email (privacy)
- Shows "Log In to Pay" button if pending
- Shows status message if not pending
- Handles invalid links gracefully

**Estimated Time:** 30 minutes

---

### T029: Add Countdown Timer Component
**Description:** Shows time remaining until expiration

**Create `components/request/countdown-timer.tsx`:**
```typescript
'use client'

import { useEffect, useState } from 'react'
import { formatDistance } from 'date-fns'

export function CountdownTimer({ expiresAt }: { expiresAt: string }) {
  const [timeLeft, setTimeLeft] = useState('')

  useEffect(() => {
    const updateTimer = () => {
      const now = new Date()
      const expiry = new Date(expiresAt)
      
      if (now > expiry) {
        setTimeLeft('Expired')
      } else {
        setTimeLeft(`Expires ${formatDistance(expiry, now, { addSuffix: true })}`)
      }
    }

    updateTimer()
    const interval = setInterval(updateTimer, 60000) // Update every minute

    return () => clearInterval(interval)
  }, [expiresAt])

  return {timeLeft}
}
```

**Update request detail page to use it:**
```typescript
import { CountdownTimer } from '@/components/request/countdown-timer'

// In the CardContent, add:

  

```

**Acceptance Criteria:**
- Shows time remaining
- Updates every minute
- Shows "Expired" if past expiration
- Uses friendly format ("in 5 days")

**Estimated Time:** 20 minutes

---

## Phase 6: Testing (Day 6, ~4 hours)

### T030: Install and Configure Playwright
**Description:** Set up Playwright for E2E testing

**Steps:**
```bash
npm install -D @playwright/test
npx playwright install
```

**Create `playwright.config.ts`:**
```typescript
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    video: 'on', // Record all tests
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
})
```

**Acceptance Criteria:**
- Playwright installed
- Config file created
- Video recording enabled
- Test directory structure created

**Estimated Time:** 15 minutes

---

### T031: Create Test Helpers
**Description:** Utility functions for tests

**Create `tests/helpers.ts`:**
```typescript
import { Page } from '@playwright/test'

export const TEST_USERS = {
  sender: { email: 'sender@test.com' },
  recipient: { email: 'recipient@test.com' },
}

export async function loginWithMagicLink(page: Page, email: string) {
  await page.goto('/login')
  await page.fill('input[type="email"]', email)
  await page.click('button:has-text("Send Magic Link")')
  
  // In production tests, you'd intercept the email or use Supabase admin SDK
  // For now, this is a placeholder
  await page.waitForTimeout(2000)
}

export async function createRequest(
  page: Page, 
  recipientEmail: string, 
  amount: string, 
  note?: string
) {
  await page.click('button:has-text("New Request")')
  await page.waitForSelector('[name="recipientEmail"]')
  await page.fill('[name="recipientEmail"]', recipientEmail)
  await page.fill('[name="amount"]', amount)
  if (note) {
    await page.fill('[name="note"]', note)
  }
  await page.click('button:has-text("Create Request")')
}
```

**Acceptance Criteria:**
- Helper functions created
- Reusable across tests

**Estimated Time:** 20 minutes

---

### T032: Write E2E Test - Create Request Happy Path
**Description:** Test creating a payment request

**Create `tests/e2e/create-request.spec.ts`:**
```typescript
import { test, expect } from '@playwright/test'
import { loginWithMagicLink, createRequest, TEST_USERS } from '../helpers'

test('user can create a payment request', async ({ page }) => {
  // Login
  await loginWithMagicLink(page, TEST_USERS.sender.email)
  
  // Navigate to dashboard
  await page.goto('/dashboard')
  
  // Create request
  await createRequest(page, TEST_USERS.recipient.email, '100.00', 'Dinner last night')
  
  // Verify toast appears
  await expect(page.locator('text=Request created!')).toBeVisible()
  
  // Verify request appears in sent tab
  await page.click('text=Sent')
  await expect(page.locator('text=$100.00')).toBeVisible()
  await expect(page.locator(`text=${TEST_USERS.recipient.email}`)).toBeVisible()
})
```

**Estimated Time:** 20 minutes

---

### T033: Write E2E Test - Pay Request Happy Path
**Description:** Test paying a payment request

**Create `tests/e2e/pay-request.spec.ts`:**
```typescript
import { test, expect } from '@playwright/test'
import { loginWithMagicLink, createRequest, TEST_USERS } from '../helpers'

test('user can pay a payment request', async ({ page, context }) => {
  // Create request as sender
  await loginWithMagicLink(page, TEST_USERS.sender.email)
  await page.goto('/dashboard')
  await createRequest(page, TEST_USERS.recipient.email, '50.00')
  
  // Switch to recipient
  const recipientPage = await context.newPage()
  await loginWithMagicLink(recipientPage, TEST_USERS.recipient.email)
  await recipientPage.goto('/dashboard')
  
  // Go to received tab
  await recipientPage.click('text=Received')
  
  // Click on request
  await recipientPage.click('text=$50.00')
  
  // Pay request
  await recipientPage.click('button:has-text("Pay")')
  await recipientPage.click('button:has-text("Confirm Payment")')
  
  // Wait for payment processing (2-3s simulation)
  await recipientPage.waitForTimeout(3000)
  
  // Verify success
  await expect(recipientPage.locator('text=Payment successful!')).toBeVisible()
  await expect(recipientPage.locator('text=PAID')).toBeVisible()
})
```

**Estimated Time:** 20 minutes

---

### T034: Write E2E Test - Decline Request
**Description:** Test declining a payment request

**Create `tests/e2e/decline-request.spec.ts`:**
```typescript
import { test, expect } from '@playwright/test'
import { loginWithMagicLink, createRequest, TEST_USERS } from '../helpers'

test('user can decline a payment request', async ({ page, context }) => {
  // Create request as sender
  await loginWithMagicLink(page, TEST_USERS.sender.email)
  await page.goto('/dashboard')
  await createRequest(page, TEST_USERS.recipient.email, '25.00')
  
  // Switch to recipient
  const recipientPage = await context.newPage()
  await loginWithMagicLink(recipientPage, TEST_USERS.recipient.email)
  await recipientPage.goto('/dashboard')
  
  // Go to received tab and open request
  await recipientPage.click('text=Received')
  await recipientPage.click('text=$25.00')
  
  // Decline request
  await recipientPage.click('button:has-text("Decline")')
  await recipientPage.click('button:has-text("Decline")')
  
  // Verify
  await expect(recipientPage.locator('text=Request declined')).toBeVisible()
  await expect(recipientPage.locator('text=DECLINED')).toBeVisible()
})
```

**Estimated Time:** 15 minutes

---

### T035: Write E2E Test - Cancel Request
**Description:** Test cancelling a payment request

**Create `tests/e2e/cancel-request.spec.ts`:**
```typescript
import { test, expect } from '@playwright/test'
import { loginWithMagicLink, createRequest, TEST_USERS } from '../helpers'

test('user can cancel their own request', async ({ page }) => {
  // Login and create request
  await loginWithMagicLink(page, TEST_USERS.sender.email)
  await page.goto('/dashboard')
  await createRequest(page, TEST_USERS.recipient.email, '75.00')
  
  // Open request
  await page.click('text=$75.00')
  
  // Cancel request
  await page.click('button:has-text("Cancel")')
  await page.click('button:has-text("Confirm Cancellation")')
  
  // Verify
  await expect(page.locator('text=Request cancelled')).toBeVisible()
  await expect(page.locator('text=CANCELLED')).toBeVisible()
})
```

**Estimated Time:** 15 minutes

---

### T036: Write E2E Test - Invalid Amount Validation
**Description:** Test amount validation

**Create `tests/e2e/invalid-amount.spec.ts`:**
```typescript
import { test, expect } from '@playwright/test'
import { loginWithMagicLink, TEST_USERS } from '../helpers'

test('rejects invalid amounts', async ({ page }) => {
  await loginWithMagicLink(page, TEST_USERS.sender.email)
  await page.goto('/dashboard')
  
  // Try zero amount
  await page.click('button:has-text("New Request")')
  await page.fill('[name="recipientEmail"]', TEST_USERS.recipient.email)
  await page.fill('[name="amount"]', '0')
  await page.click('button:has-text("Create Request")')
  
  await expect(page.locator('text=Amount must be greater than $0.00')).toBeVisible()
  
  // Try negative amount
  await page.fill('[name="amount"]', '-10')
  await page.click('button:has-text("Create Request")')
  
  await expect(page.locator('text=Amount must have max 2 decimal places')).toBeVisible()
})
```

**Estimated Time:** 15 minutes

---

### T037: Write E2E Test - Invalid Email Validation
**Description:** Test email validation

**Create `tests/e2e/invalid-email.spec.ts`:**
```typescript
import { test, expect } from '@playwright/test'
import { loginWithMagicLink } from '../helpers'

test('rejects invalid email addresses', async ({ page }) => {
  await loginWithMagicLink(page, 'sender@test.com')
  await page.goto('/dashboard')
  
  await page.click('button:has-text("New Request")')
  await page.fill('[name="recipientEmail"]', 'notanemail')
  await page.fill('[name="amount"]', '10.00')
  await page.click('button:has-text("Create Request")')
  
  await expect(page.locator('text=Invalid email address')).toBeVisible()
})
```

**Estimated Time:** 10 minutes

---

### T038: Write E2E Test - Shareable Link Works
**Description:** Test public shareable link

**Create `tests/e2e/shareable-link.spec.ts`:**
```typescript
import { test, expect } from '@playwright/test'
import { loginWithMagicLink, createRequest, TEST_USERS } from '../helpers'

test('shareable link displays request publicly', async ({ page, context }) => {
  // Create request
  await loginWithMagicLink(page, TEST_USERS.sender.email)
  await page.goto('/dashboard')
  await createRequest(page, TEST_USERS.recipient.email, '150.00', 'Shareable test')
  
  // Get shareable link
  await page.click('text=$150.00')
  const linkElement = await page.locator('code').textContent()
  const link = linkElement?.split('/request/')[1]
  
  // Open in incognito (new context)
  const incognitoPage = await context.newPage()
  await incognitoPage.goto(`/request/${link}`)
  
  // Verify public view
  await expect(incognitoPage.locator('text=$150.00')).toBeVisible()
  await expect(incognitoPage.locator('text=Shareable test')).toBeVisible()
  await expect(incognitoPage.locator('button:has-text("Log In to Pay")')).toBeVisible()
})
```

**Estimated Time:** 20 minutes

---

### T039-T041: Write Remaining E2E Tests
**Description:** Complete test suite

**Create the following test files:**

**T039: `tests/e2e/expiration.spec.ts`**
- Test request expiration after 7 days
- Mock time to speed up test

**T040: `tests/e2e/expired-payment.spec.ts`**
- Test that expired requests cannot be paid
- Verify error message

**T041: `tests/e2e/double-payment.spec.ts`**
- Test that already-paid requests cannot be paid again
- Verify error message

**Acceptance Criteria:**
- All 10 E2E tests written
- Tests pass locally
- Video recordings generated
## Phase 7: Deployment & Documentation (Day 7, ~2 hours)

### T042: Deploy to Vercel
**Description:** Deploy application to production

**Steps:**
1. Push code to GitHub
````bash
   git add .
   git commit -m "Initial implementation"
   git remote add origin https://github.com/yourusername/p2p-payment-request.git
   git push -u origin main
````

2. Go to https://vercel.com
3. Click "New Project"
4. Import GitHub repository
5. Add environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `DATABASE_URL`
6. Click "Deploy"
7. Wait for deployment to complete

8. Run database migrations on production:
````bash
   # Update DATABASE_URL to production in .env
   npx prisma migrate deploy
````

**Acceptance Criteria:**
- App deployed successfully
- Environment variables configured
- Database migrations applied
- Production URL accessible
- No build errors

**Estimated Time:** 30 minutes

---

### T043: Write Comprehensive README
**Description:** Create detailed project documentation

**Create/Update `README.md`:**
````markdown
# P2P Payment Request App

A peer-to-peer payment request system built with Next.js, Supabase, and Prisma. Users can create, send, and manage payment requests with automatic expiration and shareable links.

## 🚀 Live Demo

**Demo URL:** [https://your-app.vercel.app](https://your-app.vercel.app)

## ✨ Features

- 🔐 Passwordless authentication with magic links
- 💸 Create payment requests with amount and optional notes
- 📊 Dashboard with sent/received request tabs
- 🔍 Filter and search requests by status and email
- ✅ Pay, decline, or cancel requests
- ⏰ Automatic 7-day expiration
- 🔗 Shareable public links for requests
- 📱 Mobile-responsive design
- 🎬 Comprehensive E2E test suite with video recordings

## 🛠️ Tech Stack

### Frontend
- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **UI Components:** shadcn/ui
- **Forms:** React Hook Form + Zod
- **State Management:** React Query v5

### Backend
- **API:** Next.js API Routes
- **Database:** PostgreSQL (Supabase)
- **ORM:** Prisma
- **Auth:** Supabase Auth (Magic Link)

### Testing & DevOps
- **E2E Testing:** Playwright
- **Deployment:** Vercel
- **CI/CD:** Vercel automatic deployments

## 📦 Local Setup

### Prerequisites
- Node.js 20.x or higher
- npm or yarn
- Supabase account

### Installation

1. **Clone the repository:**
```bash
   git clone https://github.com/yourusername/p2p-payment-request.git
   cd p2p-payment-request
```

2. **Install dependencies:**
```bash
   npm install
```

3. **Set up Supabase:**
   - Create a new project at https://supabase.com
   - Enable Email Auth in Authentication settings
   - Copy your project URL and anon key

4. **Configure environment variables:**
   Create `.env.local` file:
```bash
   NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
   DATABASE_URL=postgresql://postgres:[PASSWORD]@db.xxx.supabase.co:5432/postgres
```

5. **Run database migrations:**
```bash
   npx prisma migrate dev
   npx prisma generate
```

6. **Start development server:**
```bash
   npm run dev
```

7. **Open browser:**
   Navigate to http://localhost:3000

## 🧪 Running Tests

### E2E Tests

**Run all tests:**
```bash
npm run test:e2e
```

**Run tests in headed mode:**
```bash
npx playwright test --headed
```

**View test report:**
```bash
npx playwright show-report
```

**Video recordings:**
Test videos are automatically saved to `test-results/` directory.

## 📝 API Documentation

### Authentication
- `POST /api/auth/magic-link` - Send magic link email
- `GET /api/auth/callback` - Handle magic link callback

### Requests
- `POST /api/requests` - Create payment request
- `GET /api/requests` - List requests (with filters)
- `GET /api/requests/[id]` - Get single request
- `PATCH /api/requests/[id]/pay` - Pay request
- `PATCH /api/requests/[id]/decline` - Decline request
- `PATCH /api/requests/[id]/cancel` - Cancel request

### Public
- `GET /api/public/requests/[id]` - View request via shareable link (no auth)

## 🏗️ Project Structure

````
p2p-payment-request/
├── app/                      # Next.js app directory
│   ├── (auth)/              # Auth pages
│   ├── (dashboard)/         # Dashboard pages
│   ├── api/                 # API routes
│   └── request/             # Public shareable link pages
├── components/              # React components
│   ├── ui/                  # shadcn/ui components
│   ├── dashboard/           # Dashboard components
│   └── request/             # Request components
├── lib/                     # Utility functions
├── hooks/                   # Custom React hooks
├── prisma/                  # Database schema & migrations
├── tests/                   # E2E tests
└── public/                  # Static assets
🔒 Security

Email-based passwordless authentication
Authorization checks on all mutating endpoints
SQL injection prevention via Prisma
XSS prevention via React's default escaping
HTTPS enforced in production

📊 Database Schema
User

id (UUID)
email (unique)
createdAt

PaymentRequest

id (UUID)
amount (Decimal 10,2)
note (optional, max 500 chars)
status (PENDING | PAID | DECLINED | EXPIRED | CANCELLED)
shareableLink (unique)
senderId (FK → User)
recipientEmail
recipientId (nullable FK → User)
createdAt
expiresAt (7 days from creation)
paidAt, declinedAt, cancelledAt (timestamps)

🎨 AI Tools Used
This project was built using:

Cursor: AI-powered code editor for rapid development
Claude (Anthropic): For spec writing and architecture decisions
GitHub Spec-Kit: Spec-driven development workflow

📄 Documentation

Specification
Technical Plan
Task Breakdown

🤝 Contributing
This is an interview assignment project and is not open for contributions.
📜 License
MIT License
👤 Author
Hakan

GitHub: @hqkqn32
Assignment for: Lovie Interview (2026)
Built with ❤️ using Next.js, Supabase, and AI-assisted development

**Acceptance Criteria:**
- README is clear and comprehensive
- All sections filled out
- Demo URL included
- Setup instructions complete

**Estimated Time:** 30 minutes

---

### T044: Final Testing & Polish
**Description:** Test all features on production

**Checklist:**
- [ ] Magic link login works
- [ ] Create request works
- [ ] Request appears in dashboard
- [ ] Filters work (sent/received/status)
- [ ] Search works
- [ ] Pay action works (2-3s simulation)
- [ ] Decline action works
- [ ] Cancel action works
- [ ] Shareable links work
- [ ] Public page displays correctly
- [ ] Expired requests show EXPIRED status
- [ ] Mobile responsive (test on phone)
- [ ] No console errors
- [ ] Loading states display correctly
- [ ] Error messages are user-friendly

**Test URLs:**
1. `/login` - Login page
2. `/dashboard` - Main dashboard
3. `/request/[id]` - Request detail
4. `/request/[shareableLink]` - Public shareable link

**Acceptance Criteria:**
- All features working on production
- No console errors
- Mobile responsive confirmed
- All checklist items verified

**Estimated Time:** 30 minutes

---

### T045: Create Submission Package
**Description:** Prepare all deliverables for submission

**Required Items:**

1. **GitHub Repository**
   - Public repository
   - Clean commit history
   - All files pushed
   - README complete

2. **Live Demo**
   - Deployed to Vercel
   - URL accessible
   - All features working

3. **E2E Test Videos**
   - Videos in `test-results/` directory
   - OR upload to Google Drive and include link in README

4. **Documentation**
   - Spec, Plan, Tasks in `.specify/specs/`
   - README with setup instructions

5. **Cover Note** (2-3 paragraphs):
   Write answers to:
   - What was the most challenging part of this assignment?
   - How did AI tools help or hinder your process?
   - What would you improve given more time?

**Example Cover Note:**
Subject: P2P Payment Request - Lovie Interview Assignment
Hi Lovie Team,
I've completed the P2P Payment Request assignment. Here are the deliverables:
GitHub Repository: https://github.com/yourusername/p2p-payment-request
Live Demo: https://your-app.vercel.app
E2E Test Videos: [Link to test-results/ or Google Drive]
The most challenging part was implementing the lazy expiration logic while
maintaining data consistency. I chose to check expiration on-read rather than
using a background job, which simplified the architecture but required careful
transaction handling to prevent race conditions.
AI tools (Cursor + Claude) significantly accelerated development. The
spec-driven approach meant I could generate accurate API routes and components
with minimal iteration. However, I found that debugging edge cases still
required manual intervention, particularly around Prisma transaction handling
and React Query cache invalidation.
Given more time, I would add:

Email notifications for status changes
Request editing functionality
More comprehensive unit tests
Real-time updates via websockets

Thank you for the opportunity!
Best regards,
Kağan

**Acceptance Criteria:**
- All deliverables ready
- Cover note written
- Email ready to send

**Estimated Time:** 20 minutes

---

### T046: Submit Assignment
**Description:** Send final submission email

**Email To:** hiring@lovie.com

**Email Subject:** P2P Payment Request - Interview Assignment Submission - [Your Name]

**Email Body:**
Hi Lovie Team,
I've completed the P2P Payment Request assignment. Below are the deliverables:
📦 Deliverables:

GitHub Repository: [URL]
Live Demo: [URL]
E2E Test Videos: [Link to recordings]

📝 Reflection:
[Your 2-3 paragraph cover note here]
⏱️ Time Spent: ~[X] hours
🛠️ Tech Stack:

Next.js 14, TypeScript, Tailwind CSS
Supabase (PostgreSQL + Auth)
Prisma ORM, React Query
Playwright E2E tests
Deployed on Vercel

Thank you for reviewing my submission. I'm happy to answer any questions!
Best regards,
[Your Name]

**Acceptance Criteria:**
- Email sent to hiring@lovie.com
- All links working
- Professional tone
- No typos

**Estimated Time:** 10 minutes

---

## Summary

**Total Tasks:** 46  
**Total Estimated Time:** 20-24 hours  
**Phases:** 7  

**Phase Breakdown:**
- Phase 1 (Foundation): ~3 hours, 8 tasks
- Phase 2 (Request Creation): ~4 hours, 6 tasks
- Phase 3 (Dashboard): ~4 hours, 7 tasks
- Phase 4 (Payment Actions): ~3 hours, 5 tasks
- Phase 5 (Expiration): ~2 hours, 3 tasks
- Phase 6 (Testing): ~4 hours, 12 tasks
- Phase 7 (Deployment): ~2 hours, 5 tasks

**Critical Success Factors:**
- Follow phases sequentially
- Test each feature before moving to next
- Commit code frequently
- Keep spec/plan/tasks in sync
- Document decisions in README

**Priority Order:** 
Execute phases 1-5 first (core functionality), then testing (phase 6), then deployment (phase 7).
