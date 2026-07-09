# Daggerheart Campaign Manager

Campaign management tool for the [Daggerheart](https://www.daggerheart.com/) TTRPG.

## Stack

- **Backend:** Python 3.12, FastAPI, SQLAlchemy 2.0, Alembic, SQLite
- **Frontend:** React 18, TypeScript (strict), Vite, Vitest
- **Dev:** Docker Compose; CI via GitHub Actions

## Development

```bash
docker-compose up
```

- Backend: http://localhost:8000 (OpenAPI docs at `/docs`)
- Frontend: http://localhost:5173 (proxies `/api` to backend)

### Running checks locally

Backend (from `backend/`):

```bash
pip install -e ".[dev]"
ruff check . && mypy app && pytest
```

Frontend (from `frontend/`):

```bash
npm install
npm run lint && npm run typecheck && npm test
```

## Settings & feature flags

Settings live in the `app_settings` key/value table (JSON values — adding a
setting needs no migration). Defaults are defined in
`backend/app/routers/settings.py` (`DEFAULTS`) and mirrored in
`frontend/src/context/AppSettingsContext.tsx`. New user-facing features ship
behind a `<feature>_enabled` flag (default off) toggled from the Settings page.

| Endpoint | Description |
| --- | --- |
| `GET /api/health` | Liveness check |
| `GET /api/settings` | All settings (defaults overlaid with stored values) — host only |
| `PUT /api/settings` | Partial update; unknown keys rejected (422) — host only |

## Auth

Lightweight self-hosted auth — no OAuth. Sessions are a signed, httpOnly cookie
(`dhcm_session`); passwords are hashed with argon2. Roles are `host`, `gm`,
`player`, enforced server-side on every protected router.

The first host account is bootstrapped at startup from `DHCM_HOST_USERNAME` /
`DHCM_HOST_PASSWORD` env vars (skipped, with a warning, if unset). From there,
hosts can invite GMs or players; GMs can only invite players. Invite tokens
are single-use.

Set `DHCM_SECRET_KEY` in production — without it, sessions are signed with a
random per-process key and are invalidated on every restart.

| Endpoint | Description |
| --- | --- |
| `POST /api/auth/login` | `{username, password}` → sets session cookie |
| `POST /api/auth/logout` | Clears session cookie |
| `GET /api/auth/me` | Current user, or `null` if unauthenticated |
| `POST /api/auth/invites` | Create an invite token — host or gm only |
| `POST /api/auth/register` | `{token, username, password}` → consumes an invite |

## Realtime

Native FastAPI WebSockets (no socket.io) — behind the `realtime_enabled`
feature flag (default off, toggle on `/host/settings`). A single endpoint,
`WS /ws/{room}`, requires an authenticated session cookie and closes the
connection (code `1008`) if the flag is off or the user isn't logged in.

Rooms are opaque string keys with no built-in access control beyond
authentication — the feature that assigns a room id (e.g. a campaign
session) is responsible for keeping room ids unguessable/scoped. Messages
are a JSON envelope `{type, payload}`; the server handles `type: "ping"`
internally (replies `{type: "pong", payload: {}}`) and broadcasts anything
else to the rest of the room. Frontend: `useWebSocket(room, { onMessage })`
in `frontend/src/hooks/useWebSocket.ts`, with automatic exponential-backoff
reconnect.
