# AI Usage Note

## Tools Used

- **Claude (Anthropic)** — primary development assistant via Claude Code CLI
- **Claude Code harness** — configured via `CLAUDE.md` and `AGENTS.md` (both checked into the repo)

## How I Used It

Claude Code was used as a pair programmer — I drove the architecture, reviewed every file it touched, caught bugs, and made all the consequential decisions. The spec, folder structure, data model, and business rules were written by me before Claude wrote any code. Claude generated implementations to match those specs; I reviewed, rejected, debugged, and corrected throughout.

---

## What Was in CLAUDE.md / AGENTS.md

Both files define:
- Project name, stack, and phase-based build instructions
- Coding conventions (Server Components by default, Server Actions for mutations, Drizzle query builder only, uuid PKs, unix timestamps)
- Business rules (draft guard, audit logs on every assistant mutation, role enforcement in actions, DRAFT labels on summaries)
- Response style constraints (no explanations, no code blocks in chat, edit files directly)
- Error handling policy (stop after two failed attempts on the same issue, run typecheck after every file change)

---

## What Claude Was Asked to Do

- Generate the initial project scaffold (Next.js App Router, Drizzle schema, NextAuth setup)
- Implement each feature phase as defined in `docs/SPEC.md`
- Write Server Actions, API routes, and page components to spec
- Implement the voice provider interface and pipeline provider (Web Speech API + GPT-4o-mini)
- Generate the SSE streaming route for live transcripts
- Wire up audit logging for all assistant mutations
- Write Dockerfile, docker-compose.yml, deploy.sh, and CI workflow

---

## What Was Accepted

- Overall project structure and file layout
- Drizzle schema design (5 tables, UUIDs, unix timestamps, proper FKs)
- `VoiceProvider` interface abstraction — clean separation between the interface contract and the implementation
- `PipelineVoiceProvider` tool-calling agentic loop structure (up to 5 LLM iterations per turn for tool resolution)
- SUMMARY_SYSTEM_PROMPT shape — structured JSON output with escalation flags and evidence references
- `AbortController` pattern in `live-session.tsx` to prevent double session creation in React Strict Mode dev
- SSE polling architecture for transcript streaming
- Audit log helper and its usage in every assistant server action
- Draft-guard enforcement in both the page and the `/api/sessions/create` route

---

## What Was Rejected or Corrected

### Mock provider — removed entirely
Claude generated a mock voice provider returning scripted responses. I rejected it — the project goal is to demonstrate a real working voice intake pipeline, not a simulation. Shipping mock-only would have undermined the core value. I made the call to require `OPENAI_API_KEY` and ship only the real pipeline, documenting this as a conscious trade-off.

### Deepgram STT — never implemented
The spec mentioned Deepgram as an optional STT path. After evaluating the added complexity (server-side audio streaming, a third API key, binary blob handling), I decided against it. Browser Web Speech API achieves the same result — the user's voice becomes text — without any server-side audio infrastructure. Deepgram references leaked into an early README draft; I caught and removed them.

### `NEXTAUTH_SECRET` → `AUTH_SECRET`
Claude consistently wrote `NEXTAUTH_SECRET` in env examples and documentation. NextAuth v5 (Auth.js) uses `AUTH_SECRET`. I caught the mismatch by cross-referencing the generated `docker-compose.yml` against the auth config, fixed all occurrences across README, `.env.example`, and docs.

### `db:seed` unconditional in `deploy.sh`
Generated deploy script re-seeded on every run, which would wipe data on redeploy. I corrected it to gate the seed on whether the `users` table is empty — standard practice for idempotent deploy scripts.

### Missing auth guard on `/api/voice/text`
Claude generated the voice text route without a `getCurrentUser()` check at the top. I caught this during code review of the API layer — any unauthenticated request could trigger an OpenAI call and write to the DB. Added `requireAuth()` guard manually.

### `next.config.ts` missing `output: "standalone"`
The Dockerfile copies from `.next/standalone/` at the runner stage. Claude generated an empty next config. Without `output: "standalone"`, the Docker build would succeed but produce a broken image. I caught this by reading the Dockerfile output stage against the build config.

### `.gitignore` missing `*.db`
Default Next.js `.gitignore` does not exclude SQLite files. The DB files got staged. I caught it before commit, added `*.db`, `*.db-shm`, `*.db-wal` to `.gitignore` and removed them from tracking.

---

## Bugs I Found and Debugged

### `better-sqlite3` async transaction crash — the hard one
Users were seeing *"Network error — this turn was not saved"* during live sessions. The error message came from a `catch` block that fires when `fetch()` itself throws — which only happens if the server returns a non-JSON response.

I traced it step by step:
1. Checked server logs — no obvious crash
2. Read the route handler (`/api/voice/text`) looking for unhandled throws outside try-catch
3. Found `db.transaction(async (tx) => {...})` — an async callback passed to `better-sqlite3`'s transaction API
4. Checked `better-sqlite3` v12 source: it explicitly throws `TypeError: Transaction function cannot return a promise`
5. This exception was outside the route's try-catch, so Next.js returned an HTML error page (dev mode), `res.json()` in the client threw SyntaxError, caught by the outer catch — surfaced as "Network error"

The fix: removed `async`/`await` from the callback (all `better-sqlite3` drizzle operations are synchronous anyway), called `.run()` explicitly on inserts. One-line root cause, but it required reading library source and tracing through three error-handling layers to find it.

### React Strict Mode double session creation
In development, React mounts effects twice. The session creation effect called `POST /api/sessions/create` which calls OpenAI for a greeting — an expensive, side-effecting operation. Without a guard, every dev page load would create two sessions and two OpenAI calls.

I identified the pattern and reviewed Claude's `AbortController` implementation: it passes `signal: controller.signal` to the fetch, checks `controller.signal.aborted` after every async step, and only progresses to `setUiStatus("active")` on the second (real) mount. Verified the logic was correct before accepting it.

### In-memory session state lost on hot reload
During dev, editing any source file triggers Turbopack HMR, which re-evaluates server modules. The `activeSessions` Map in `pipeline-provider.ts` and the `registry` Map in `session-registry.ts` are module-level — they're cleared on every hot reload. A live session started before a file edit would produce "Provider session not found" on the next turn.

I documented this as a known dev-mode limitation rather than a bug (it's a fundamental constraint of in-memory state in a hot-reloading server). In production with a stable process this doesn't occur.

---

## Architecture Decisions I Personally Made

### SQLite over Postgres
An internal B2B ops console for a small team doesn't need horizontal scaling. SQLite with WAL mode handles concurrent reads correctly, eliminates a separate database process, and makes the deployment `docker-compose.yml` a single service. Drizzle makes migrating to Postgres trivial if the need arises. The constraint is explicit: single-VM deployment.

### SSE over WebSocket for transcript streaming
Transcript streaming is strictly server→client. SSE is HTTP/1.1 compatible, automatically reconnects, works through standard load balancers without upgrade headers, and is simpler to implement correctly. WebSocket would add bidirectional complexity for a one-directional problem. Chose SSE.

### Browser Web Speech API for STT + TTS
Eliminates audio streaming infrastructure entirely. No binary blob handling, no server-side audio codec concerns, no Deepgram latency. The tradeoff is browser support (Chrome/Edge only) — acceptable for an internal ops tool where browser choice is controlled. TTS via `SpeechSynthesis` is free, has no latency overhead, and produces natural-sounding output on modern browsers.

### `memoryMode: "full" | "window"` per assistant
For short sessions, sending full history to GPT-4o-mini produces more coherent responses. For long sessions, a 20-message sliding window reduces cost and latency. I added this as a configurable per-assistant field (stored in DB, passed into the provider at session start) rather than hardcoding it — because the right tradeoff depends on the assistant's use case, not the infrastructure.

### Evaluation harness uses a fresh provider instance, not the singleton
The evaluation runner creates `new PipelineVoiceProvider()` directly instead of calling `getVoiceProvider()`. This was intentional: eval sessions should not share in-memory state with live sessions, and the singleton's `activeSessions` Map should not be polluted with eval runs. The eval also writes no DB rows — all 5 synthetic sessions run purely in-memory and the results are persisted only as a single `evaluation_runs` row with aggregated metrics.

### Escalation detection in system prompt, not post-processing
Rather than running a second LLM call to classify escalation after each turn, the system prompt instructs GPT-4o-mini to include the word `ESCALATE` in its response when specific trigger conditions are met. The summary generation prompt then picks up escalation flags from the transcript. This keeps the critical path to a single LLM call per turn and makes escalation behaviour inspectable in the transcript directly.

### Per-turn observability traces
Every turn saves `llmMs`, `toolMs`, `totalMs`, `toolCallCount`, and a full `contextSnapshot` to the `session_traces` table. This was not in the original spec — I added it because an AI intake system needs this instrumentation to be debuggable in production. Without per-turn traces you can't answer "why did turn 7 take 8 seconds" or "which tool call failed." The evaluation harness uses these traces to compute latency metrics.

---

## Known Gaps (Documented, Not Swept Under the Rug)

- **No rate limiting** on `/api/sessions/create` or auth endpoints — straightforward to add with `upstash/ratelimit` or a middleware token bucket, out of scope for the take-home timeframe
- **In-memory session state** — `activeSessions` and the session registry are process-local; multi-instance deployment would require Redis or a DB-backed session store
- **Web Speech API is Chrome/Edge only** — acceptable for an internal tool; a production system targeting broader reach would need server-side STT
- **No real-time summary streaming** — summary is generated on `endSession()` as a single blocking call; for longer sessions this could be streamed token-by-token
- **Audit log covers assistant mutations only** — session lifecycle events (who started, who ended) are not in the audit trail; easy to add but not spec'd
