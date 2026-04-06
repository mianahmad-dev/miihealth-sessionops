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

<!-- code-review-graph MCP tools -->
## MCP Tools: code-review-graph

**IMPORTANT: This project has a knowledge graph. ALWAYS use the
code-review-graph MCP tools BEFORE using Grep/Glob/Read to explore
the codebase.** The graph is faster, cheaper (fewer tokens), and gives
you structural context (callers, dependents, test coverage) that file
scanning cannot.

### When to use graph tools FIRST

- **Exploring code**: `semantic_search_nodes` or `query_graph` instead of Grep
- **Understanding impact**: `get_impact_radius` instead of manually tracing imports
- **Code review**: `detect_changes` + `get_review_context` instead of reading entire files
- **Finding relationships**: `query_graph` with callers_of/callees_of/imports_of/tests_for
- **Architecture questions**: `get_architecture_overview` + `list_communities`

Fall back to Grep/Glob/Read **only** when the graph doesn't cover what you need.

### Key Tools

| Tool | Use when |
|------|----------|
| `detect_changes` | Reviewing code changes — gives risk-scored analysis |
| `get_review_context` | Need source snippets for review — token-efficient |
| `get_impact_radius` | Understanding blast radius of a change |
| `get_affected_flows` | Finding which execution paths are impacted |
| `query_graph` | Tracing callers, callees, imports, tests, dependencies |
| `semantic_search_nodes` | Finding functions/classes by name or keyword |
| `get_architecture_overview` | Understanding high-level codebase structure |
| `refactor_tool` | Planning renames, finding dead code |

### Workflow

1. The graph auto-updates on file changes (via hooks).
2. Use `detect_changes` for code review.
3. Use `get_affected_flows` to understand impact.
4. Use `query_graph` pattern="tests_for" to check coverage.
