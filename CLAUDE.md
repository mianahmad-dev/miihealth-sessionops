@AGENTS.md
# CLAUDE.md

## Project
SessionOps Studio — B2B internal console for voice intake assistants. Next.js 15 App Router + TypeScript + SQLite/Drizzle + NextAuth + shadcn/ui.

## How This Project Works
This project is built phase-by-phase. I will tell you which phase to work on. Before starting any phase, read `docs/SPEC.md` for data model, folder structure, constants, provider contracts, and component specs. Read `AGENTS.md` for coding conventions. Do only what the current phase asks — nothing more.

## Rules
- Mock voice provider is DEFAULT. App must work with zero API keys
- All assistant mutations MUST write audit_logs
- Role checks in Server Actions, not just UI
- Draft assistants cannot launch sessions — enforce on backend
- Every page: empty, loading, error states
- Summaries labeled "DRAFT — For staff review only"
- No hardcoded secrets. All via .env
- Don't add features outside the spec
- Don't refactor working code unless asked
- Keep responses short. No explanations unless asked

## Stack
Next.js 15, TypeScript strict, Drizzle ORM + better-sqlite3, NextAuth v5 CredentialsProvider, Tailwind 4 + shadcn/ui, Zod, SSE for transcript streaming

## Commands
- `npm run dev` — start dev server
- `npm run db:generate` — generate migrations
- `npm run db:migrate` — run migrations
- `npm run db:seed` — seed sample data
- `npm run build` — production build
- `npm run lint` — lint

## Response Style
- No explanations unless asked
- No summaries of what you did
- No "Here's what I changed" recaps
- No markdown code blocks in chat — just edit files directly
- Say "Done" when finished, nothing more

## Error Handling
- If you hit the same error twice, stop and ask me
- Don't attempt more than 2 fixes for the same issue
- Run typecheck after every file change: npx tsc --noEmit