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

- Backend: http://localhost:8002 (OpenAPI docs at `/docs`) — mapped off the
  default 8000 to avoid clashing with other local projects
- Frontend: http://localhost:5173 (proxies `/api` and `/ws` to the backend
  container)

Vite's dev server watches with polling (`vite.config.ts`) — plain filesystem
events aren't reliable across the Docker bind mount on Windows/macOS, so
HMR would otherwise silently serve stale code after an edit.

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
`player`, enforced server-side on every protected router. `host` is a
superuser — it satisfies any role check, so a host account can also open the
GM and Player areas. In the GM area a host acts as its own GM (campaigns are
still scoped to that literal account id), not as an admin over every GM's
data.

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

## Chat

Behind the `chat_enabled` feature flag (default off, toggle on
`/host/settings`). Chat is a `type: "chat"` message on the same `/ws/{room}`
connection from [Realtime](#realtime) — not a separate endpoint. Sending
`{type: "chat", payload: {body}}` persists the message and broadcasts it
(including back to the sender) to everyone in the room; the flag being off
makes the server silently drop chat-type messages rather than closing the
connection, since realtime and chat are independent flags. History is a
regular REST endpoint for the initial load and pagination.

`ChatPanel` (`frontend/src/components/ChatPanel.tsx`) is a collapsible panel
with an unread badge; it's wired into the Gamemaster area next to a
campaign's active session.

| Endpoint | Description |
| --- | --- |
| `GET /api/chat/{room}/messages` | History, oldest to newest. `?limit=` (default/max 50), `?before=<id>` for older pages |

## Gamemaster: campaigns & sessions

Behind the `campaigns_enabled` feature flag (default off, toggle on
`/host/settings`). Endpoints return `404` when the flag is off, so the
feature is invisible rather than erroring. GM-only, scoped to the owning GM
(other GMs' campaigns 404, not 403 — avoids revealing they exist). A
campaign has at most one active session at a time; a session's WebSocket
room key is `session-{id}` (see [Realtime](#realtime)).

| Endpoint | Description |
| --- | --- |
| `GET /api/campaigns` | List the current GM's campaigns |
| `POST /api/campaigns` | Create a campaign |
| `GET /api/campaigns/{id}` | Get a campaign |
| `PUT /api/campaigns/{id}` | Update name/description |
| `DELETE /api/campaigns/{id}` | Delete a campaign |
| `GET /api/campaigns/{id}/sessions` | List a campaign's sessions |
| `POST /api/campaigns/{id}/sessions` | Start a session (409 if one is already active) |
| `POST /api/campaigns/{id}/sessions/{session_id}/end` | End a session |
| `GET /api/campaigns/{id}/members` | List a campaign's players |
| `POST /api/campaigns/{id}/members` | Add a player by username (404 if not a `player` account) |
| `DELETE /api/campaigns/{id}/members/{user_id}` | Remove a player |

## Player: characters, campaigns, notes

Behind the `player_area_enabled` feature flag (default off, toggle on
`/host/settings`). A player only sees campaigns they've been added to by a
GM (via the membership endpoints above) — everything here 404s for a
campaign they're not a member of, same invisible-rather-than-erroring
pattern as the rest of the app. Characters are owned by the creating player;
ownership isolation is enforced the same way as campaigns (404, not 403).
Notes are one free-text note per player per campaign, private to that
player — upserted on save.

| Endpoint | Description |
| --- | --- |
| `GET /api/player/campaigns` | Campaigns the current player is a member of |
| `GET /api/player/characters` | The player's own characters (`?campaign_id=` to filter) |
| `POST /api/player/characters` | Create a character (requires membership in `campaign_id`) |
| `PUT /api/player/characters/{id}` | Update a character (partial) |
| `DELETE /api/player/characters/{id}` | Delete a character |
| `GET /api/player/campaigns/{id}/note` | Get the player's own note for a campaign |
| `PUT /api/player/campaigns/{id}/note` | Save (upsert) the player's own note |

## Host: data management

Behind the `data_management_enabled` feature flag (default off, toggle on
`/host/settings`, tab appears at `/host/data` once enabled). Host-only.
Operates on the SQLite database file directly and never touches uploaded
model/asset files. Backup and pre-destructive-op snapshots use SQLite's
online backup API for a consistent copy (folds in WAL contents); restore
validates an upload (`PRAGMA integrity_check` + an `alembic_version` table)
before swapping it in, and keeps a pre-restore snapshot. Restore and reset
run `alembic upgrade head` / `downgrade base` + `upgrade head` afterward so
the `alembic_version` table stays consistent with the `alembic upgrade head`
the container runs on every start. Destructive operations (repair/restore/
reset) are serialized by an in-process lock and require the frontend's
type-`ACKNOWLEDGED`-to-confirm dialog.

| Endpoint | Description |
| --- | --- |
| `GET /api/database/backup` | Download a consistent snapshot of the database |
| `GET /api/database/health` | Run a SQLite integrity check |
| `POST /api/database/repair` | Snapshot, then `REINDEX` if unhealthy |
| `POST /api/database/restore` | Upload and swap in a validated backup file |
| `POST /api/database/reset` | Snapshot, then wipe and recreate an empty schema |

## Character creation (Daggerheart SRD)

Behind the `character_creation_enabled` feature flag (default off, toggle on
`/host/settings`). Provides SRD-driven, guided Level 1 character creation for the
Player area.

The canonical SRD reference data (classes, subclasses, ancestries, communities,
domains, level-1 domain cards, Tier-1 weapons/armor, and the trait array) lives in
`backend/app/data/srd/character_creation.json` and is served read-only to the
frontend, so the wizard and the server share a single source of truth. When a
character's `extra` field is populated, it must validate as a `CharacterSheet`
(`app/schemas/character_sheet.py`) — cross-checked against the SRD data — or the
create/update returns 422. An empty `extra` (`"{}"`) stays valid, so the simple
flat character form is unaffected.

Scope: structured mechanical data + names. Full feature-card prose (subclass /
ancestry / domain-card rules text) and the dedicated secondary-weapon table are
deferred to a later ticket.

| Endpoint | Description |
| --- | --- |
| `GET /api/srd/character-creation` | The SRD character-creation reference dataset (auth required) |
