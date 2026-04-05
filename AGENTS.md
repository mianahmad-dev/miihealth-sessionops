<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# AGENTS.md

## Project
SessionOps Studio — B2B internal console for configuring, launching, and reviewing voice intake assistants.

## Stack
Next.js 15 (App Router), TypeScript strict, Drizzle ORM + SQLite (better-sqlite3), NextAuth v5, Tailwind 4 + shadcn/ui, Zod, SSE for real-time transcript streaming.

## Code Conventions
- Use Server Components by default. Add "use client" only when needed (forms, hooks, browser APIs)
- Use Server Actions for mutations (src/actions/). No separate API routes for CRUD
- API routes only for: auth, SSE streaming, voice processing
- Validate all inputs with Zod before DB operations
- Use uuid for all primary keys
- Timestamps as unix integers, not Date objects
- Import with @/* alias
- No default exports except pages and layouts

## DB Rules
- Schema lives in src/lib/db/schema.ts
- Single DB client singleton in src/lib/db/index.ts
- All queries use Drizzle query builder, no raw SQL
- Migrations via drizzle-kit

## Auth Rules
- Two roles: admin (full CRUD), viewer (read-only)
- Enforce roles in Server Actions, not just UI
- middleware.ts handles route protection
- Use getCurrentUser() helper from src/lib/auth/helpers.ts

## Business Rules
- Draft assistants CANNOT launch sessions — enforce on backend
- Every assistant mutation writes to audit_logs table
- Version field increments on every assistant edit
- Summaries always labeled "DRAFT — For staff review only"
- Mock voice provider is the default (VOICE_PROVIDER=mock)

## Error Handling
- Every page must have empty, loading, and error states
- Use Suspense + loading.tsx for async pages
- Toast notifications on mutation success/error (sonner)
- Mic permission denial shows actionable error message

## Don'ts
- No hardcoded secrets
- No features outside docs/SPEC.md
- No refactoring working code unless asked
- No microservices, no GraphQL, no WebSocket (except voice)
- No console.log in production code (use proper error handling)