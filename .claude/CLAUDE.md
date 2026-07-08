# Daggerheart Campaign Manager — Project Rules

Campaign management tool for the Daggerheart TTRPG. Monorepo: FastAPI backend
(`backend/`), React + TypeScript frontend (`frontend/`).

My global baseline applies (see STL Inventory `.claude/CLAUDE.md` for the full
text: code quality, autonomy policy, pre-change plan, pre-commit review,
testing philosophy, documentation currency). Project-specific rules below.

## Issue Tracking

Work is tracked in **Jira project DHCM** (site rbrentstephenson.atlassian.net),
not GitHub Issues.

- Commit subjects: `type(DHCM-XXX): summary`; bracket the key `[DHCM-XXX]` in
  the body/PR description.
- Keep ticket status in sync at each milestone: In Progress when work starts,
  In Review when the PR opens, Done only when CI is green and the PR merges.

## PR & Merge Workflow

- Never push directly to `main`: branch → commit → push → PR.
- Branch names: `type/DHCM-XXX-short-description`.
- Arm auto-merge after opening (`gh pr merge --squash --auto`); CI is the gate,
  no human reviewers.
- Monitor CI at 5-minute intervals only.

## Architecture & Conventions

- **Settings/feature flags:** `app_settings` key/value table (JSON-encoded
  values, no migration for new settings). Backend source of truth:
  `DEFAULTS` in `backend/app/routers/settings.py`; frontend mirror:
  `DEFAULTS` in `frontend/src/context/AppSettingsContext.tsx`. Every new
  user-facing feature ships behind a `<feature>_enabled` flag, default off,
  with a toggle on the Settings page. Gate server-side, not just in UI.
- **Backend:** Python 3.12, FastAPI, SQLAlchemy 2.0 typed ORM, Alembic
  migrations (SQLite). Lint/type: `ruff check .` + `mypy app`. Tests: pytest
  (`backend/tests/`), TestClient + in-memory SQLite via `get_db` override.
- **Frontend:** Vite + React 18 + TS strict. Lint/type/test:
  `npm run lint` / `npm run typecheck` / `npm test` (vitest). API calls go
  through `src/api/client.ts`.
- **Dev:** `docker-compose up` runs both; backend on :8000, frontend on :5173
  (proxying `/api`).

## Testing

Unit tests are required for every PR, both flag states for gated features.
Backend has no local Python runtime on this machine — run backend checks in
Docker (`docker run --rm -v ${PWD}/backend:/app -w /app python:3.12-slim ...`)
before pushing.
