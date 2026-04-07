# Skills

This project was developed using Claude Code (Anthropic) with a structured harness.

## Harness Files

| File | Purpose |
|---|---|
| `CLAUDE.md` | Top-level project instructions for Claude Code — stack, rules, response style, error handling policy |
| `AGENTS.md` | Coding conventions, DB rules, auth rules, business rules, don'ts |
| `AI_USAGE.md` | Full AI usage disclosure — tools used, what was accepted, rejected, corrected, and manual judgement calls |

## Skills Folder

Skills were invoked at development time via the Claude Code CLI's built-in skill system (e.g. `/commit`, `/simplify`). No separate `skills/` directory was created — the harness configuration in `CLAUDE.md` and `AGENTS.md` served as the persistent skill definition.
