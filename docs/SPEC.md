# CLAUDE.md — SessionOps Studio

## Project Overview
Build "SessionOps Studio" — a browser-based B2B internal operations console for configuring, launching, and reviewing voice intake assistants. This is a take-home assignment for a Senior Full-Stack Engineer role at MiiHealth.

**Time constraint: 6 hours. Prioritize working core flows over feature count.**

---

## Tech Stack (Non-negotiable)

- **Framework:** Next.js 15 (App Router, Server Components, Server Actions)
- **Language:** TypeScript (strict mode)
- **Database:** SQLite via Drizzle ORM (better-sqlite3)
- **Auth:** NextAuth.js v5 (Auth.js) with CredentialsProvider
- **Styling:** Tailwind CSS 4 + shadcn/ui
- **Validation:** Zod (+ drizzle-zod)
- **Voice Pipeline (real):** Deepgram STT (HTTP API) → GPT-4o-mini → Browser SpeechSynthesis (free TTS)
- **Voice Pipeline (mock):** Scripted conversations with simulated delays — DEFAULT mode
- **Real-time transcript:** Server-Sent Events (SSE)
- **Deployment:** Docker + PM2 for Ubuntu VM

---

## Data Model (Drizzle Schema)

Create in `src/lib/db/schema.ts`:

```
users
- id: text (uuid) PK
- email: text unique not null
- name: text not null
- role: text enum("admin", "viewer") not null
- passwordHash: text not null
- createdAt: integer (unix timestamp)
- updatedAt: integer (unix timestamp)

assistants
- id: text (uuid) PK
- name: text not null
- purpose: text not null (instructions/system prompt)
- language: text not null default "en"
- voice: text not null default "default"
- status: text enum("draft", "published", "archived") not null default "draft"
- tools: text (JSON stringified array of tool IDs)
- version: integer not null default 1
- createdBy: text FK → users.id
- createdAt: integer
- updatedAt: integer

sessions
- id: text (uuid) PK
- assistantId: text FK → assistants.id not null
- assistantVersion: integer not null (snapshot which version ran)
- operatorId: text FK → users.id not null
- status: text enum("initializing", "active", "ending", "completed", "failed", "needs_review") not null
- startedAt: integer
- endedAt: integer
- durationSec: integer
- turnCount: integer default 0
- summary: text (JSON stringified structured summary, nullable)
- errorReason: text nullable
- createdAt: integer

transcript_events
- id: text (uuid) PK
- sessionId: text FK → sessions.id not null
- speaker: text enum("user", "assistant", "system") not null
- content: text not null
- timestampMs: integer not null (ms offset from session start)
- sequenceNum: integer not null
- createdAt: integer

audit_logs
- id: text (uuid) PK
- userId: text FK → users.id not null
- action: text enum("create", "update", "publish", "archive", "duplicate") not null
- entityType: text enum("assistant", "session") not null
- entityId: text not null
- changes: text nullable (JSON stringified diff)
- createdAt: integer
```

---

## Folder Structure

```
sessionops-studio/
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   └── login/page.tsx
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx                ← sidebar + header shell
│   │   │   ├── page.tsx                  ← redirect to /assistants
│   │   │   ├── assistants/
│   │   │   │   ├── page.tsx              ← list all assistants (RSC)
│   │   │   │   ├── new/page.tsx          ← create form
│   │   │   │   └── [id]/
│   │   │   │       ├── page.tsx          ← view/edit assistant
│   │   │   │       └── sessions/page.tsx ← sessions for this assistant
│   │   │   ├── sessions/
│   │   │   │   ├── page.tsx              ← all sessions list
│   │   │   │   ├── [id]/page.tsx         ← session review (transcript + summary)
│   │   │   │   └── live/[assistantId]/page.tsx ← live session screen (client component)
│   │   │   └── audit/page.tsx            ← audit log viewer (admin only)
│   │   ├── api/
│   │   │   ├── auth/[...nextauth]/route.ts
│   │   │   ├── sessions/
│   │   │   │   ├── [id]/stream/route.ts  ← SSE endpoint for live transcript
│   │   │   │   └── [id]/end/route.ts     ← end session + generate summary
│   │   │   └── voice/
│   │   │       └── process/route.ts      ← receive audio chunk, return text response
│   │   ├── layout.tsx
│   │   └── globals.css
│   ├── components/
│   │   ├── ui/                           ← shadcn components
│   │   ├── assistants/
│   │   │   ├── assistant-form.tsx
│   │   │   ├── assistant-table.tsx
│   │   │   └── status-badge.tsx
│   │   ├── sessions/
│   │   │   ├── live-session.tsx           ← main live session client component
│   │   │   ├── transcript-viewer.tsx
│   │   │   ├── session-table.tsx
│   │   │   └── summary-card.tsx
│   │   └── layout/
│   │       ├── sidebar.tsx
│   │       └── header.tsx
│   ├── lib/
│   │   ├── db/
│   │   │   ├── schema.ts
│   │   │   ├── index.ts                  ← DB client singleton
│   │   │   └── seed.ts                   ← seed script
│   │   ├── auth/
│   │   │   ├── config.ts                 ← NextAuth config
│   │   │   └── helpers.ts                ← getCurrentUser(), requireAdmin()
│   │   ├── voice/
│   │   │   ├── types.ts                  ← VoiceProvider interface
│   │   │   ├── mock-provider.ts          ← default, free, scripted convos
│   │   │   ├── pipeline-provider.ts      ← Deepgram STT + GPT-4o-mini + Browser TTS
│   │   │   └── index.ts                  ← factory: reads VOICE_PROVIDER env
│   │   ├── audit.ts                      ← auditLog() helper
│   │   ├── constants.ts                  ← APPROVED_TOOLS, VOICES, LANGUAGES
│   │   └── validations.ts               ← Zod schemas
│   ├── actions/
│   │   ├── assistants.ts                 ← Server Actions for CRUD
│   │   └── sessions.ts                   ← Server Actions for session ops
│   └── middleware.ts                     ← auth guard + role check per route
├── drizzle.config.ts
├── seed.ts                               ← npm run seed entry
├── Dockerfile
├── docker-compose.yml
├── deploy.sh                             ← Ubuntu VM deploy script
├── .github/workflows/ci.yml
├── .env.example
├── CLAUDE.md
├── README.md
└── docs/
    ├── architecture.md
    └── trade-offs.md
```

---

## Implementation Order (Follow This Exactly)

### Phase 1: Scaffold + DB + Auth (do first)

1. `npx create-next-app@latest sessionops-studio --typescript --tailwind --app --src-dir --import-alias "@/*"`
2. Install deps:
   ```bash
   npm i drizzle-orm better-sqlite3 @auth/core @auth/drizzle-adapter next-auth@beta zod drizzle-zod bcryptjs uuid
   npm i -D drizzle-kit @types/better-sqlite3 @types/bcryptjs @types/uuid
   ```
3. Init shadcn: `npx shadcn@latest init` then add: `button input table dialog badge tabs card select textarea dropdown-menu separator sheet toast skeleton avatar`
4. Create Drizzle schema (`src/lib/db/schema.ts`) — all 5 tables as defined above
5. Create `drizzle.config.ts`, run `npx drizzle-kit generate` then `npx drizzle-kit migrate`
6. Create DB client singleton (`src/lib/db/index.ts`)
7. Create seed script — 2 users:
   - admin@sessionops.local / admin123 (role: admin)
   - viewer@sessionops.local / viewer123 (role: viewer)
   - 2 sample assistants (1 published, 1 draft)
   - 1 sample completed session with 8-10 transcript events and a summary
8. Setup NextAuth with CredentialsProvider — validate email/password against users table
9. Create middleware.ts — protect all routes except /login, check session
10. Create login page — simple email/password form, redirect to /assistants on success

### Phase 2: Layout + Assistant CRUD

11. Build dashboard layout — sidebar with nav links (Assistants, Sessions, Audit Log), header with user name + role badge + logout
12. Assistants list page (Server Component):
    - Fetch all assistants with Drizzle
    - Render table: name, status badge (draft=yellow, published=green, archived=gray), language, voice, version, updated date
    - Search input (filter by name, client-side is fine)
    - Filter dropdown by status
    - "New Assistant" button (admin only)
13. Create assistant page:
    - Form: name, purpose (textarea), language (select), voice (select), tools (multi-checkbox from APPROVED_TOOLS)
    - Server Action: validate with Zod, insert, write audit log, redirect to list
14. Edit assistant page (same form, pre-filled):
    - Server Action: validate, update, bump version, write audit log
    - Only admin can edit
15. Assistant actions (Server Actions):
    - Publish: draft → published (only admin)
    - Archive: published → archived (only admin)
    - Duplicate: copy config, reset to draft, version 1 (only admin)
    - Each writes audit log
16. Role enforcement: Viewer sees all data but cannot create/edit/publish/archive. Hide or disable buttons.

### Phase 3: Voice Provider Abstraction + Mock Provider

17. Define `VoiceProvider` interface in `src/lib/voice/types.ts`:
    ```typescript
    export interface TranscriptEvent {
      speaker: "user" | "assistant" | "system";
      content: string;
      timestampMs: number;
    }

    export interface SessionResult {
      transcript: TranscriptEvent[];
      summary: Record<string, unknown> | null;
      status: "completed" | "failed" | "needs_review";
      errorReason?: string;
    }

    export interface VoiceProvider {
      startSession(assistantConfig: {
        purpose: string;
        language: string;
        voice: string;
        tools: string[];
      }): Promise<string>; // returns sessionId
      sendAudio(sessionId: string, audioChunk: Blob): Promise<TranscriptEvent[]>;
      endSession(sessionId: string): Promise<SessionResult>;
    }
    ```
18. Build mock provider (`mock-provider.ts`):
    - Has 3-4 hardcoded conversation scripts (healthcare intake scenarios)
    - `startSession()` picks a script based on assistant purpose keywords
    - `sendAudio()` ignores the audio, returns next scripted user line + assistant response with realistic delays (300-800ms)
    - `endSession()` returns full transcript + hardcoded structured summary
    - Summary shape:
      ```json
      {
        "chief_concern": "string",
        "collected_fields": { "name": "...", "dob": "...", "symptoms": "..." },
        "missing_fields": ["insurance_id", "allergies"],
        "escalation_flags": [
          { "flag": "Patient mentioned chest pain", "evidence": "Turn 4: 'I've been having chest pains'", "severity": "high" }
        ],
        "session_quality": "needs_review",
        "draft_notes": "Patient intake partially complete. Escalation flag raised for chest pain mention. Recommend clinical follow-up before appointment."
      }
      ```
19. Build provider factory (`src/lib/voice/index.ts`): reads `VOICE_PROVIDER` env, returns mock or pipeline

### Phase 4: Live Session Screen

20. Create live session page (`/sessions/live/[assistantId]/page.tsx`) — **client component**:
    - Guard: only published assistants can launch sessions
    - On mount: request microphone permission. If denied → show clear error with retry button
    - Create session row in DB (status: initializing)
    - Connect to SSE endpoint (`/api/sessions/[id]/stream`)
    - Session state machine UI:
      - initializing: "Connecting..." spinner
      - active: show transcript panel, who-is-speaking indicator, timer
      - ending: "Saving session..." spinner
      - completed: redirect to review page
      - failed: show error with reason
    - Transcript panel: scrollable list, each entry shows speaker icon/label + content + timestamp, auto-scroll to bottom
    - Audio capture: MediaRecorder API, send chunks every 3-5 seconds to `/api/voice/process`
    - End Session button: stops recording, calls end endpoint, waits for summary, redirects

21. Create SSE endpoint (`/api/sessions/[id]/stream/route.ts`):
    - Opens a ReadableStream, sends transcript events as they're added to DB
    - Poll DB every 500ms for new transcript_events (simple approach)
    - Send `event: transcript\ndata: {json}\n\n` format
    - Close stream when session status changes to completed/failed

22. Create voice process endpoint (`/api/voice/process/route.ts`):
    - Receives audio blob + sessionId
    - Calls voiceProvider.sendAudio()
    - Saves returned transcript events to DB
    - Returns OK

23. Create end session endpoint (`/api/sessions/[id]/end/route.ts`):
    - Calls voiceProvider.endSession()
    - Saves summary JSON to session row
    - Updates session status, endedAt, durationSec, turnCount
    - Returns session result

### Phase 5: Session History + Review

24. Sessions list page (Server Component):
    - Fetch all sessions with assistant name joined
    - Table: date, assistant name, duration, turns, status badge, link to review
    - Filter by status, search by assistant name
25. Per-assistant sessions page (`/assistants/[id]/sessions`):
    - Same table, filtered to one assistant
26. Session review page (`/sessions/[id]`):
    - Metadata card: assistant name + version, duration, turn count, status, date
    - Full transcript with speaker labels, color-coded (user=blue, assistant=green, system=gray), timestamps
    - Summary card: render the structured JSON nicely — chief concern, collected fields, missing fields
    - Escalation flags: render with severity badges (high=red, medium=yellow, low=blue), show evidence text
    - If status is "needs_review" show a prominent banner: "⚠ This session requires human review"
    - If status is "failed" show error reason

### Phase 6: Audit Log + Polish

27. Audit log page (`/audit`) — admin only:
    - Table: date, user, action, entity type, entity name, changes
    - Chronological, most recent first
28. Error states everywhere:
    - Empty states for lists ("No assistants yet", "No sessions recorded")
    - Loading states (skeleton components on data-fetching pages)
    - Error boundaries for failed data fetches
    - Toast notifications for mutations (success/error)
29. Draft assistant guard: if someone navigates to `/sessions/live/[draftAssistantId]` → redirect or show "This assistant must be published first"

### Phase 7: Deployment + Docs

30. Dockerfile:
    ```dockerfile
    FROM node:20-alpine AS deps
    WORKDIR /app
    COPY package*.json ./
    RUN npm ci

    FROM node:20-alpine AS builder
    WORKDIR /app
    COPY --from=deps /app/node_modules ./node_modules
    COPY . .
    RUN npm run build

    FROM node:20-alpine AS runner
    WORKDIR /app
    ENV NODE_ENV=production
    COPY --from=builder /app/.next/standalone ./
    COPY --from=builder /app/.next/static ./.next/static
    COPY --from=builder /app/public ./public
    EXPOSE 3000
    CMD ["node", "server.js"]
    ```
31. docker-compose.yml: single service, mount volume for SQLite DB persistence
32. deploy.sh for Ubuntu VM:
    ```bash
    #!/bin/bash
    # Install Node 20, clone repo, npm ci, npm run build, npm run seed, pm2 start
    ```
33. .env.example:
    ```
    NEXTAUTH_SECRET=generate-a-random-secret
    NEXTAUTH_URL=http://localhost:3000
    VOICE_PROVIDER=mock
    DEEPGRAM_API_KEY=your-key-here-only-needed-if-VOICE_PROVIDER=pipeline
    OPENAI_API_KEY=your-key-here-only-needed-if-VOICE_PROVIDER=pipeline
    DATABASE_URL=./sessionops.db
    ```
34. GitHub Actions CI (`.github/workflows/ci.yml`): lint → type-check → build
35. README.md with: project overview, arch summary (paste diagram), setup + run instructions, deployment instructions, design decisions, trade-offs, known limitations, what next with more time

---

## Pipeline Voice Provider (Phase 3 Extension — Only After Mock Works)

When implementing `pipeline-provider.ts`:

```
Browser: MediaRecorder captures audio → sends WebM blob to /api/voice/process
Server:  Deepgram STT (POST /v1/listen, model=nova-2) → text
Server:  GPT-4o-mini chat completion (conversation history + assistant purpose as system prompt) → response text
Server:  Return response text to browser
Browser: window.speechSynthesis.speak(new SpeechSynthesisUtterance(responseText))
```

- Deepgram: use HTTP pre-recorded API, not WebSocket. Simpler. Send audio blob, get text back.
- GPT-4o-mini: maintain conversation history per session in memory (Map<sessionId, messages[]>). Send full history each turn.
- Browser TTS: `SpeechSynthesisUtterance` with language matching assistant config. Free.
- Summary: on endSession, send full transcript to GPT-4o-mini with the structured summary system prompt.

---

## Constants

```typescript
// src/lib/constants.ts

export const APPROVED_TOOLS = [
  { id: "symptom_lookup", name: "Symptom Reference Lookup", description: "Look up general symptom information from an approved knowledge base" },
  { id: "appointment_check", name: "Appointment Availability", description: "Check available appointment slots for a service line" },
  { id: "form_prefill", name: "Intake Form Pre-fill", description: "Pre-fill intake form fields from collected session data" },
] as const;

export const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "de", label: "German" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
] as const;

export const VOICES = [
  { value: "default", label: "Default" },
  { value: "professional", label: "Professional" },
  { value: "friendly", label: "Friendly" },
  { value: "clinical", label: "Clinical" },
] as const;

export const SESSION_STATUSES = ["initializing", "active", "ending", "completed", "failed", "needs_review"] as const;
export const ASSISTANT_STATUSES = ["draft", "published", "archived"] as const;
```

---

## Critical Rules

1. **NEVER hardcode API keys.** All secrets via .env. `.env` is in `.gitignore`.
2. **Draft assistants cannot launch sessions.** Enforce on backend, not just UI.
3. **All assistant mutations write an audit log.** No exceptions.
4. **Transcripts save to DB per-event, not as one blob at end.** Stream them in during the session.
5. **Every page handles empty, loading, and error states.**
6. **Viewer role is read-only.** Server Actions must check role, not just hide buttons.
7. **Mock provider is default.** App must work fully with zero API keys via `VOICE_PROVIDER=mock`.
8. **All summaries are labeled as "DRAFT — For staff review only"** in the UI.
9. **Session state machine is explicit.** No ad-hoc status string changes. Use a transition function.
10. **Microphone permission denial shows a clear, actionable error** — not a silent failure.

---

## What NOT to Build

- No multi-tenant / org switching
- No real-time collaborative editing
- No WebSocket for general app state (SSE for transcripts only)
- No GraphQL
- No separate microservices
- No email notifications
- No file upload
- No advanced analytics — basic counts (sessions per assistant, avg duration) are enough
- No custom voice training
- No enterprise SSO/SAML
