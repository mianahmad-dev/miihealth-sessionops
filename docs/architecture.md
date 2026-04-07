# Architecture

## System Overview

SessionOps Studio is a single-process Next.js application backed by a SQLite database. All components run in one Node.js process on a single VM.

```
┌─────────────────────────────────────────────────────────┐
│                        Browser                          │
│                                                         │
│  ┌────────────┐  ┌──────────────┐  ┌────────────────┐  │
│  │  RSC Pages │  │Client Comps  │  │  SSE Client    │  │
│  │  (read)    │  │(live session)│  │  (transcript)  │  │
│  └─────┬──────┘  └──────┬───────┘  └───────┬────────┘  │
└────────┼────────────────┼──────────────────┼───────────┘
         │ HTTP           │ HTTP             │ SSE
┌────────▼────────────────▼──────────────────▼───────────┐
│                   Next.js 15 Server                     │
│                                                         │
│  ┌─────────────┐  ┌───────────────┐  ┌──────────────┐  │
│  │Server Comps │  │Server Actions │  │  API Routes  │  │
│  │(pages/RSC)  │  │(mutations)    │  │(auth/SSE/    │  │
│  └─────┬───────┘  └───────┬───────┘  │ voice text)  │  │
│        │                  │          └──────┬───────┘  │
│        └──────────────────┼─────────────────┘          │
│                           │                             │
│                  ┌────────▼────────┐                   │
│                  │  Drizzle ORM    │                   │
│                  └────────┬────────┘                   │
│                           │                             │
│                  ┌────────▼────────┐                   │
│                  │  SQLite File    │                   │
│                  │ (sessionops.db) │                   │
│                  └─────────────────┘                   │
│                                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │              Voice Provider                      │  │
│  │         ┌────────────────────────┐               │  │
│  │         │   PipelineProvider     │               │  │
│  │         │ Web Speech API (STT) + │               │  │
│  │         │ GPT-4o-mini +          │               │  │
│  │         │ Browser SpeechSynth    │               │  │
│  │         └────────────────────────┘               │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

## Request Flows

### Viewing Data (Server Components)
1. Browser requests page
2. Next.js renders Server Component on the server
3. Server Component queries SQLite via Drizzle directly
4. HTML returned to browser — no client JS for data fetching

### Mutations (Server Actions)
1. Browser form submit / button click
2. Server Action called (POST to Next.js server)
3. Role check via `getCurrentUser()`
4. Zod validation
5. Drizzle query
6. Audit log write
7. Revalidate cache + redirect or return result

### Live Session
1. User navigates to `/sessions/live/[assistantId]`
2. Client component requests mic permission (Web Speech API)
3. `POST /api/sessions/create` — starts a provider session (OpenAI greeting), creates session row (status: `initializing`)
4. `EventSource` connects to `/api/sessions/[id]/stream` (SSE)
5. Web Speech API captures speech, converts to text in-browser; final transcript sent to `POST /api/voice/text`
6. Pipeline provider calls GPT-4o-mini, saves user + assistant transcript events to DB
7. SSE endpoint polls DB every 500ms, streams new events to browser; browser TTS speaks assistant replies
8. User clicks End Session → `POST /api/sessions/[id]/end`
9. Voice provider `endSession()` generates structured summary via GPT-4o-mini, saved to DB
10. Client redirected to `/sessions/[id]` review page

## Key Modules

| Module | Path | Responsibility |
|---|---|---|
| DB Schema | `src/lib/db/schema.ts` | Drizzle table definitions |
| DB Client | `src/lib/db/index.ts` | Singleton better-sqlite3 connection |
| Auth Config | `src/lib/auth/config.ts` | NextAuth CredentialsProvider |
| Auth Helpers | `src/lib/auth/helpers.ts` | `getCurrentUser()`, `requireAdmin()` |
| Voice Factory | `src/lib/voice/index.ts` | Returns singleton `PipelineVoiceProvider` |
| Pipeline Provider | `src/lib/voice/pipeline-provider.ts` | Web Speech API STT + GPT-4o-mini + Browser SpeechSynthesis |
| Audit Helper | `src/lib/audit.ts` | `auditLog()` — writes to `audit_logs` table |
| Constants | `src/lib/constants.ts` | `APPROVED_TOOLS`, `VOICES`, `LANGUAGES` |
| Validations | `src/lib/validations.ts` | Zod schemas for all entities |
| Assistant Actions | `src/actions/assistants.ts` | CRUD + publish/archive/duplicate |
| Session Actions | `src/actions/sessions.ts` | Session lifecycle management |
| Middleware | `src/middleware.ts` | Route protection, auth guard |

## Data Flow: Transcript

```
Web Speech API (browser STT)
       │ final transcript text
       ▼
POST /api/voice/text
       │
       ▼
voiceProvider.sendText()  →  GPT-4o-mini (agentic loop with tools)
       │
       ▼
Returns TranscriptEvent[] (user + assistant turns) + TurnTrace
       │
       ▼
INSERT into transcript_events (one row per event, in a transaction)
INSERT into session_traces + tool_invocations (best-effort)
       │
       ▼
SSE endpoint polls transcript_events WHERE sequenceNum > lastSeen
       │
       ▼
Streams events to browser as JSON
       │
       ▼
Client appends to transcript panel, auto-scrolls
Browser SpeechSynthesis speaks assistant reply
```

## Auth & Authorization

- NextAuth v5 with CredentialsProvider (email + bcrypt password)
- Session stored as JWT cookie
- Two roles: `admin` (full CRUD) and `viewer` (read-only)
- Middleware enforces authentication on all routes except `/login`
- Server Actions re-check role — UI hiding is not the only guard
- `requireAdmin()` throws if called by a viewer — Server Action returns error

## Session State Machine

```
initializing ──► active ──► ending ──► completed
                  │                        │
                  └──────────► failed      │
                                           ▼
                               needs_review (set by summary analysis)
```

Transitions are explicit — no ad-hoc string assignments outside the state machine helper.
