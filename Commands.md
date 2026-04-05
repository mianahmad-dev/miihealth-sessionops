# Commands for Claude Code (copy-paste one at a time)

## Phase 1
```
Read docs/SPEC.md. Build Phase 1: scaffold Next.js 15 project, install all deps (drizzle-orm better-sqlite3 next-auth@beta zod bcryptjs uuid + dev deps), init shadcn with components (button input table dialog badge tabs card select textarea dropdown-menu separator sheet skeleton avatar toast), create Drizzle schema for all 5 tables, drizzle config, migrations, DB singleton, seed script, NextAuth CredentialsProvider, middleware for route protection, login page. Verify npm run dev + login works.
```

## Phase 2
```
Read docs/SPEC.md Phase 2. Build dashboard layout (sidebar + header with user/role/logout) and full assistant CRUD: list page with table + search + status filter, create form, edit form, server actions for publish/archive/duplicate. Audit log on every mutation. Viewer role enforced in server actions.
```

## Phase 3
```
Read docs/SPEC.md Phase 3. Build lib/voice/: types.ts (VoiceProvider interface), mock-provider.ts (3 scripted healthcare conversations), index.ts (factory reads VOICE_PROVIDER env, defaults to mock). Test it works standalone.
```

## Phase 4a
```
Read docs/SPEC.md. Build live session page at /sessions/live/[assistantId]. Guard: published only. Mic permission with error handling. Session state machine (initializing→active→ending→completed/failed). SSE endpoint at /api/sessions/[id]/stream. Transcript display with speaker labels, timestamps, auto-scroll. Timer. End Session button. Use mock provider. Save transcript events to DB during session.
```

## Phase 4b
```
Wire up /api/voice/process route (receives audio, calls voice provider, saves transcript events). Wire MediaRecorder in live session (4s chunks to voice process endpoint). Build /api/sessions/[id]/end route (calls provider.endSession, saves summary + metadata). On End Session: call end route, redirect to /sessions/[id].
```

## Phase 5
```
Read docs/SPEC.md. Build session history page (all sessions table: date, assistant, duration, turns, status badge, filters). Per-assistant sessions at /assistants/[id]/sessions. Session review page: metadata card, full color-coded transcript, summary card with collected/missing fields, escalation flags with severity badges + evidence, "requires human review" banner, error display.
```

## Phase 6
```
Build audit log page at /audit (admin only). Then add: empty states on all list pages, loading skeletons, error states, toast on mutations. Verify draft assistants blocked from launching sessions on backend. All summary cards show "DRAFT — For staff review only".
```

## Phase 7
```
Create: Dockerfile (multi-stage standalone), docker-compose.yml (volume for sqlite), deploy.sh (Ubuntu, Node 20, PM2), .env.example, .github/workflows/ci.yml (lint, typecheck, build). Write README.md: overview, architecture, setup, run, deploy, design decisions, trade-offs, known limitations, what next.
```

## Post-phase check (run after each phase)
```
Check codebase against CLAUDE.md rules. List violations. Fix them. Be brief.
```