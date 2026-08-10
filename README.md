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

### End-to-end tests (Playwright)

E2E specs run against an isolated Docker stack (`docker-compose.e2e.yml`),
never the live dev stack — separate ports, separate Compose project, a
throwaway DB volume seeded with its own bootstrapped GM account
(`e2e-gm` / `e2e-only-password`). The frontend's existing Vite proxy for
`/api` and `/ws` means the browser only ever talks to one origin, so no
extra reverse-proxy container is needed.

```bash
docker compose -f docker-compose.yml -f docker-compose.e2e.yml -p dhcm-e2e up -d --build
npm run test:e2e --prefix frontend
docker compose -p dhcm-e2e down -v   # -v drops the throwaway DB volume
```

Specs live in `frontend/e2e/`, numbered (`NN-name.spec.ts`) since the suite
runs fully serial against one shared DB for the run — Playwright executes
files in alphabetical order, so the number makes required run order
explicit instead of accidental.

## Settings & feature flags

Settings live in the `app_settings` key/value table (JSON values — adding a
setting needs no migration). Defaults are defined in
`backend/app/routers/settings.py` (`DEFAULTS`) and mirrored in
`frontend/src/context/AppSettingsContext.tsx`. New user-facing features ship
behind a `<feature>_enabled` flag (default off) toggled from the Settings page.

| Endpoint | Description |
| --- | --- |
| `GET /api/health` | Liveness check |
| `GET /api/settings` | All settings (defaults overlaid with stored values) — gm only |
| `PUT /api/settings` | Partial update; unknown keys rejected (422) — gm only |

## Auth

Lightweight self-hosted auth — no OAuth. Sessions are a signed, httpOnly cookie
(`dhcm_session`); passwords are hashed with argon2. Roles are `gm` and
`player`, enforced server-side on every protected router. There's no separate
"host" account: these are self-hosted, one-GM-per-instance installs (Docker
Compose or otherwise), so the GM running the deployment is also its admin —
`gm` covers campaigns/sessions/Library *and* server settings/data management.
"Host" now refers only to the server/infra itself and the `/host` settings
area, not to an account role. `gm` and `player` stay walled off from each
other — a GM has no automatic access to the Player area (and vice versa); the
GM will see character sheets through the GM interface instead.

The first GM account is bootstrapped at startup from `DHCM_GM_USERNAME` /
`DHCM_GM_PASSWORD` env vars (skipped, with a warning, if unset). From there,
GMs can invite other GMs or players. Invite tokens are single-use.

Set `DHCM_SECRET_KEY` in production — without it, sessions are signed with a
random per-process key and are invalidated on every restart.

| Endpoint | Description |
| --- | --- |
| `POST /api/auth/login` | `{username, password}` → sets session cookie |
| `POST /api/auth/logout` | Clears session cookie |
| `GET /api/auth/me` | Current user, or `null` if unauthenticated |
| `POST /api/auth/invites` | Create an invite token — gm only |
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
| `PATCH /api/player/characters/{id}/state` | Mark/clear HP, Stress, Hope, Armor Slots (see below) |

### Character sheet mechanics (play state)

Behind the `character_sheet_enabled` feature flag (default off, toggle on
`/host/settings`), layered on top of `player_area_enabled`. `Character.extra`
(when populated) is an immutable Level 1 creation snapshot — see
"Character creation" below. `hp_marked`/`stress_marked`/`hope`/
`armor_slots_marked` are separate mutable columns for state that changes
during play, bounds-checked against that snapshot (`hp_max`, `stress_max`,
the equipped armor's Armor Score, and a fixed 0–6 for Hope) rather than
against `CharacterSheet`'s fixed Level 1 creation invariants — a player can
mark HP up to `hp_max` at any time, not just exactly the creation value.
`PATCH .../state` is a partial update (only the fields present are
validated and applied) and 422s if the character has no completed sheet to
validate against.

Not yet built: loadout-vs-vault domain card tracking. A Level 1 character
only ever has 2 domain cards against a 5-card loadout max, so the mechanic
has no practical effect until a future leveling feature lets a character
accumulate more than 5 — revisit then.

## Host: data management

Behind the `data_management_enabled` feature flag (default off, toggle on
`/host/settings`, tab appears at `/host/data` once enabled). GM-only.
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

This dataset is derived from the Daggerheart SRD, used as Public Game Content
under the Darrington Press Community Gaming License — see
[`NOTICE.md`](./NOTICE.md) for attribution and license terms.

**Frontend**: `CharacterWizard` (`frontend/src/pages/player/CharacterWizard.tsx`)
walks the 9 SRD steps (class+subclass, heritage, trait-array assignment, derived
stats, equipment, experiences, domain cards, background/connections, review) and
submits the assembled sheet as `extra`. `PlayerPage` shows a "Create Character
(Guided)" entry point when available, with the flat form as a fallback. Because
`/api/settings` is gm-only (403 for players), availability isn't read from
`AppSettingsContext` — the page instead probes `GET /api/srd/character-creation`
directly and treats a 404 as "disabled," the same invisible-rather-than-erroring
pattern used everywhere else in the player area.

Note: custom GM-authored content (classes, heritages, etc., beyond the fixed SRD
set) is tracked as a separate future epic — this dataset is currently read-only.

| Endpoint | Description |
| --- | --- |
| `GET /api/srd/character-creation` | The SRD character-creation reference dataset (auth required) |

## Bestiary (Daggerheart SRD)

Read-only reference data, gated by `combat_tools_enabled` (default off, toggle on
`/host/settings`). `backend/app/data/srd/bestiary.json` holds all 129 SRD adversary
stat blocks and 19 environment stat blocks, transcribed verbatim (see
[`NOTICE.md`](./NOTICE.md) for SRD attribution).

`BestiaryPage` (`frontend/src/pages/gm/BestiaryPage.tsx`, `/gm/bestiary`) lets the GM
search and tier-filter both, and expand a card for the full stat block. "Add to
Library" on an adversary card spawns it as a real Library `Adversary` entity
(the GM worldbuilding feature behind `library_enabled` — worlds, Continents,
Regions, Locations, Factions, NPCs, and Adversaries, see
`backend/app/routers/library.py`) via the existing generic entity-create
endpoint — no dedicated spawn endpoint exists, the stat block is just serialized
into that entity's `extra` field. Environments have no Library equivalent yet, so
they're browse-only.

| Endpoint | Description |
| --- | --- |
| `GET /api/bestiary/` | The full adversary + environment dataset — gm only |

## Combat tools: Fear pool & countdowns

Behind the `combat_tools_enabled` feature flag (default off, toggle on
`/host/settings`). GM-only, scoped to the owning GM (same 404-not-403 pattern as
campaigns).

**Fear pool** — `fear` is a column on `Campaign` (not `GameSession`), since the SRD
specifies Fear carries over between sessions rather than resetting. Clamped to
0–12. `FearTracker` (`frontend/src/pages/gm/FearTracker.tsx`) renders a +/- counter
on each campaign card in `CampaignsPage`.

**Countdowns** — a new `Countdown` model (migration 0013) scoped to a campaign:
`starting_value`, `current_value`, and a `loop` flag. Advancing ticks
`current_value` down by the given delta; when it reaches 0, a loop countdown
resets to `starting_value` and a non-loop one sticks at 0 (both set
`triggered_at`). The SRD's dynamic-countdown advancement chart (how many ticks a
given roll result is worth) is GM judgment, not enforced by the API — the GM
calls the advance endpoint as many times as the table decides. `CountdownsPanel`
(`frontend/src/pages/gm/CountdownsPanel.tsx`) is a toggleable panel per campaign
card, mirroring `MembersPanel`'s CRUD layout.

| Endpoint | Description |
| --- | --- |
| `PATCH /api/campaigns/{id}/fear` | `{delta}` → adjust Fear, clamped 0–12 |
| `GET /api/campaigns/{id}/countdowns` | List a campaign's countdowns |
| `POST /api/campaigns/{id}/countdowns` | `{name, starting_value, loop}` → create |
| `PATCH /api/campaigns/{id}/countdowns/{cid}` | `{delta}` → advance (ticks down) |
| `DELETE /api/campaigns/{id}/countdowns/{cid}` | Remove a countdown |

## Help pages

`/help` (`frontend/src/pages/help/HelpPage.tsx`), linked from the top nav whenever
a user is logged in. No feature flag — always available, and covers every
feature regardless of what's currently enabled (each section notes the flag it
needs). Shows `GmGuide.tsx` or `PlayerGuide.tsx` depending on the logged-in
user's role; both are static content, structured as collapsible sections
(`HelpSection.tsx`) in the order a GM or player would actually use the app.

**Update the relevant guide in the same PR whenever a GM- or player-facing
feature changes** — same doc-currency expectation as this README, just aimed at
end users instead of developers.
