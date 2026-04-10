# P2P Payment Request App

**Live Demo:** https://lovie-amjpjjyxt-hqkqn32s-projects.vercel.app  
**GitHub:** https://github.com/hqkqn32/Lovie

A peer-to-peer payment request system built for Lovie interview assignment.

## ✨ Features

- 🔐 Passwordless authentication (magic link)
- 💸 Create payment requests with 7-day expiration
- 📊 Dashboard with sent/received tabs
- ✅ Pay, decline, or cancel requests
- 🔗 Shareable public links
- 🧪 E2E tests with Playwright (video recordings)

## 🛠️ Tech Stack

**Frontend:** Next.js 14, TypeScript, Tailwind CSS, shadcn/ui  
**Backend:** Next.js API Routes, Supabase Auth  
**Database:** PostgreSQL (Supabase), Prisma ORM  
**Testing:** Playwright E2E tests  
**Deployment:** Vercel

## 📦 Documentation

- [Specification](./.specify/specs/payment-request.md)
- [Technical Plan](./.specify/specs/plan.md)
- [Task Breakdown](./.specify/specs/tasks.md)

## 🧪 E2E Tests

Tests are automated with Playwright. Video recordings available in `test-results/`.

```bash
npm run test:e2e
```

## 🚀 Local Setup

See [Technical Plan](./.specify/specs/plan.md) for full setup instructions.