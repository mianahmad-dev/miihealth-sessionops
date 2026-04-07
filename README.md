# SessionOps Studio

A browser-based B2B internal operations console for configuring, launching, and reviewing voice intake assistants.

## Architecture Overview

```
Browser
  └── Next.js 15 App (App Router, SSR + Client Components)
        ├── Server Components  ─── read-only pages (lists, review, audit)
        ├── Server Actions     ─── all mutations (assistants, sessions)
        ├── API Routes         ─── auth, SSE streaming, voice processing
        └── SQLite (Drizzle)   ─── single-file DB, zero-config

Voice Pipeline
  └── Browser Web Speech API (STT) → GPT-4o-mini (LLM + tool calling) → Browser SpeechSynthesis (TTS)

Real-time Transcript
  └── Server-Sent Events (SSE) — DB polled every 500ms, streamed to client
```

## Setup

### Prerequisites
- Node.js 20+
- npm

### Local Development

```bash
# 1. Clone and install
git clone <repo-url>
cd sessionops-studio
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env — at minimum set AUTH_SECRET to a random string

# 3. Run migrations and seed
npm run db:migrate
npm run db:seed

# 4. Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

**Default credentials (from seed):**
- Admin: `admin@sessionops.local` / `admin123`
- Viewer: `viewer@sessionops.local` / `viewer123`

### Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `AUTH_SECRET` | Yes | — | Random secret for session signing |
| `NEXTAUTH_URL` | Yes | `http://localhost:3000` | App base URL |
| `DATABASE_URL` | No | `./sessionops.db` | SQLite file path |
| `OPENAI_API_KEY` | Yes | — | OpenAI key for GPT-4o-mini |

## Deployment

### Docker

```bash
# Build and run with docker-compose
cp .env.example .env
# Edit .env with production values
docker-compose up -d
```

The SQLite database is persisted in a named Docker volume (`db_data`).

After first run, seed the database:
```bash
docker-compose exec app node -e "require('./src/lib/db/seed')"
```

### Ubuntu VM (PM2)

```bash
# Set REPO_URL before running
export REPO_URL=https://github.com/your-org/sessionops-studio.git
bash deploy.sh
```

The script installs Node 20, clones the repo, runs migrations, seeds, builds, and starts with PM2 on port 3000.

## Commands

| Command | Description |
|---|---|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run db:generate` | Generate Drizzle migrations |
| `npm run db:migrate` | Run pending migrations |
| `npm run db:seed` | Seed sample data |
| `npm run lint` | Run ESLint |

## Design Decisions

- **SQLite over Postgres** — zero-ops for a single-VM internal tool; Drizzle makes migration to Postgres trivial if needed
- **OpenAI-only voice pipeline** — `OPENAI_API_KEY` is required; there is no mock fallback. Browser Web Speech API handles STT/TTS, eliminating audio streaming infrastructure entirely
- **SSE over WebSocket** — one-way server→client transcript streaming is all that's needed; SSE is simpler and HTTP/2 compatible
- **Server Actions for mutations** — co-located with pages, automatic CSRF protection, no separate REST layer to maintain
- **Role enforcement in Server Actions** — UI hides controls from viewers, but the backend enforces it independently

## Known Limitations

- SQLite has no connection pooling — not suitable for high-concurrency production workloads
- SSE transcript polling is every 500ms — adds minor latency; replace with DB triggers or Redis pub/sub for lower latency
- **Chrome-only voice capture** — the Web Speech API (`SpeechRecognition`) is not supported in Firefox or Safari; operators must use Chrome/Chromium
- Browser SpeechSynthesis TTS is voice/quality limited by browser and OS support
- No session reconnect — if the browser tab closes during a live session, the session is orphaned in `active` state; requires manual intervention to mark it failed
- In-memory voice provider state — a server restart during an active session will lose the session context; the session will be stuck in `active` status
- **STT and TTS timing not captured in observability** — Web Speech API and Browser SpeechSynthesis run entirely in-browser with no server-side instrumentation; `session_traces` records `llmMs` and `toolMs` but cannot measure speech recognition or playback latency
- **Error count not tracked per turn** — turn-level errors are not counted as a discrete metric in `session_traces`; failures surface as session status changes (`failed` / `needs_review`) rather than per-turn error counts

## What's Next (Given More Time)

- Postgres migration for multi-instance deployments
- WebRTC for lower-latency audio capture vs. MediaRecorder chunks
- Redis pub/sub for real-time transcript push instead of polling
- End-to-end test suite (Playwright) covering login → launch → review flow
- Role-based column-level visibility for sensitive transcript content
- Export sessions to PDF / CSV for downstream clinical workflows
