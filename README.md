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

### Live state sync (character sheets, Fear, countdowns)

The GM party view (DHCM-58) and player Fear/countdown views (DHCM-59) push
live updates over the same `/ws/{room}` connection instead of requiring a
refresh — this is what actually makes Epic 7 "real-time" rather than just
read-only. `app.services.realtime.broadcast_to_campaign(campaign_id, db,
message)` is the shared helper: it looks up the campaign's active
`GameSession` and broadcasts to that session's room, or silently no-ops if
there isn't one (nothing to sync to). Called from the mutating endpoints
after `db.commit()`:

- `PATCH /api/player/characters/{id}/state` and `POST .../rest` → `{type:
  "character_state", payload: <CharacterOut>}`
- `PATCH /api/campaigns/{id}/fear` → `{type: "fear", payload: <FearOut>}`
- `POST/PATCH/DELETE /api/campaigns/{id}/countdowns...` → `{type:
  "countdown_created"|"countdown_updated"|"countdown_deleted", payload:
  <CountdownOut> | {id}}`

Frontend: `PartyPanel` and `CampaignStatusPanel` both take an optional
`room` prop and call `useWebSocket(room, { onMessage })` to merge incoming
messages into their existing state (matching by id) — passed down as
`activeSession?.room` (GM side, from `CampaignsPage`'s existing session
lookup) or the new `active_session_room` field on `GET /api/player/campaigns`
(player side, since players had no prior way to know which room to join).
`room` defaults to `null` (no session active), which makes `useWebSocket`
a no-op — the views still work as plain read-only data without a session,
same as DHCM-58/59 shipped them.

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

### Party view

`GET /api/campaigns/{id}/party` — a read-only list of every campaign member's
characters (`PartyMemberOut`: `player_username` + the same `CharacterOut` shape
player.py returns). Before this, the GM had no visibility into player
characters at all — no endpoint, no UI. `PartyPanel`
(`frontend/src/pages/gm/PartyPanel.tsx`) is a toggleable panel per campaign
card, gated on `player_area_enabled` in the UI (the endpoint itself only needs
`campaigns_enabled`, but there's nothing to show without characters). A member
can have more than one character — `Character` has no uniqueness constraint on
`(campaign_id, player_user_id)` — so the list is per-character, not per-member.

| Endpoint | Description |
| --- | --- |
| `GET /api/campaigns/{id}/party` | Every member's characters, read-only — gm only |

### Session planning

Behind the `session_planning_enabled` feature flag (default off, toggle on
`/host/settings`), layered on top of `campaigns_enabled`. `SessionPlan`
(`backend/app/schemas/session_plans.py`) models the shape Brent already plans
sessions in by hand: a title, summary, and ordered `content` — an `opening`
beat, a sequence of story `beats` (name/description, each optionally linked to
specific NPCs via `npc_ids`), parallel `countdowns` (Daggerheart's countdown
mechanic — segments, what ticks them, what happens on completion vs. early
intervention), a flat list of seeded `hooks`, a `reward`, and a freeform
`notes` bucket. Every field is optional. `SessionPlansPanel`
(`frontend/src/pages/gm/SessionPlansPanel.tsx`) gives each repeatable field
(hooks, beats, countdowns) its own add/remove list editor rather than a raw
JSON textarea — `HooksListEditor`, `BeatsListEditor`, `CountdownsListEditor`.
A beat's `npc_ids` isn't editable from this UI yet (DHCM-70's explicit scope);
it survives a save unchanged via a hidden per-row field carrying the original
value forward. The schema's `extra="allow"` means an unanticipated future
planning shape isn't rejected outright — since DHCM-71 retired the JSON
textarea, any such as-yet-unmodeled content key is likewise carried forward
unedited via a hidden `content-extra` field, rather than silently dropped.

A session plan can link to Library entities (Continents, Regions, Locations,
Factions, NPCs, Adversaries, Environments) it expects to use —
`SessionPlanLibraryLink` — surfaced in `SessionPlansPanel` as a "Library
links" section per plan.

| Endpoint | Description |
| --- | --- |
| `GET /api/campaigns/{id}/session-plans` | List a campaign's session plans |
| `POST /api/campaigns/{id}/session-plans` | Create a session plan |
| `GET /api/campaigns/{id}/session-plans/{plan_id}` | Get a session plan |
| `PUT /api/campaigns/{id}/session-plans/{plan_id}` | Update a session plan |
| `DELETE /api/campaigns/{id}/session-plans/{plan_id}` | Delete a session plan |
| `GET .../session-plans/{plan_id}/links` | List a plan's Library links |
| `POST .../session-plans/{plan_id}/links` | Attach a Library entity |
| `DELETE .../session-plans/{plan_id}/links/{link_id}` | Remove a link |

### Quick generate

Behind the `generators_enabled` feature flag (default off, toggle on
`/host/settings`), layered on top of `campaigns_enabled`. A mid-session assist
for when a GM invents something on the fly and doesn't want to leave the app:
`app.services.generators` composes a random name, a minimal NPC sketch
(role/motivation/quirk), or a loot/consumable pick drawn from the existing SRD
tables already loaded by `app.services.srd` — no new dataset. These are
starting suggestions, not a fixed table replicating any one source's content
(loosely inspired by LGMRD's generator toolkit, per this project's
source-material-is-a-guideline convention). `party_tier` is accepted on the
loot endpoint but not currently used to filter — the SRD's own loot/consumable
tables aren't tier-differentiated.

`QuickGeneratePanel` (`frontend/src/pages/gm/QuickGeneratePanel.tsx`) is a
toggleable panel per campaign card with Name/NPC/Loot buttons, a Reroll that
re-generates the active kind, and a Dismiss that clears it — nothing
persists automatically. For NPC suggestions only, a **Keep** button spawns
the sketch as a real `Npc` Library entity via the existing Library create
endpoint (same spawn-to-Library pattern as the Bestiary's "Add to Library").
Name and Loot suggestions stay copy-only — there's no natural Library entity
for a bare name or a loot roll.

| Endpoint | Description |
| --- | --- |
| `GET /api/gm/generate/{kind}` | `kind` is `name`, `npc`, or `loot`; `name` takes an optional `ancestry` query param, `loot` an optional `party_tier` — gm only |

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

## Host: custom content (DHCM-20/27-30)

Behind the `custom_content_enabled` feature flag (default off, toggle on
`/host/settings`, tab appears at `/host/custom-content` once enabled). GM-only.
Lets a GM author their own classes, ancestries, communities, domains, domain
cards, weapons, and armor — global/instance-wide entities, not scoped to a
campaign — alongside the SRD's fixed static datasets. Each of the 7 types has
its own shape (no shared name/summary/extra pattern), so both the backend CRUD
(`backend/app/routers/custom_content.py`) and the frontend admin UI
(`frontend/src/pages/host/CustomContentPage.tsx`) are built from a per-type
config rather than 7 hand-copied implementations.

Custom entries merge with the SRD's static data at the accessor layer
(`app/services/srd.py`'s `merged_*` functions), tagged `"source": "custom"` in
the merged dataset, so `CharacterSheet` validation and the character-creation
wizard accept them transparently — a GM never has to distinguish SRD vs.
custom content when building a character.

Known gap: unique-constraint violations (e.g. a duplicate name) surface as a
raw 500 instead of a clean 4xx, matching `library.py`'s existing CRUD — tracked
as [DHCM-99](https://rbrentstephenson.atlassian.net/browse/DHCM-99), not fixed
yet.

| Endpoint | Description |
| --- | --- |
| `GET/POST /api/custom-content/{segment}` | List / create entries for one of the 7 segments |
| `GET/PUT/DELETE /api/custom-content/{segment}/{id}` | Get / update / delete a single entry |

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

Note: custom GM-authored content (classes, ancestries, communities, domains,
domain cards, weapons, armor) merges with this dataset transparently at the
accessor layer — see "Host: custom content" below.

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
Library" on an adversary or environment card spawns it as a real Library
`Adversary`/`Environment` entity (the GM worldbuilding feature behind
`library_enabled` — worlds, Continents, Regions, Locations, Factions, NPCs,
Adversaries, Environments, and Clues, see `backend/app/routers/library.py`) via the
existing generic entity-create endpoint — no dedicated spawn endpoint exists,
the stat block is just serialized into that entity's `extra` field. (Clues aren't
Bestiary-spawnable — there's no stat block to spawn from — they're created
directly in the Library's Clues tab; see "Investigation prep: Clues" below.)

| Endpoint | Description |
| --- | --- |
| `GET /api/bestiary/` | The full adversary + environment dataset — gm only |

**Adversary notes & live-play recall (DHCM-65/-90/-91)** — a Library
`Adversary` carries a dedicated `notes` field (separate from `extra`, which
holds the spawned stat block JSON) for freeform GM-only recall text —
signature moves, table reminders, anything worth remembering mid-fight.
Written from the Library's Adversary tab (`LibraryPage`'s `EntityPanel`,
gated by `SEGMENT_HAS_NOTES` alongside the existing `SEGMENT_HAS_KIND`
pattern). Surfaced read-only during live play in `AdversaryNotesPanel`
(`frontend/src/pages/gm/AdversaryNotesPanel.tsx`), a toggleable panel per
campaign card alongside the party view, gated by `combat_tools_enabled` and
searchable by name. No enforced structure or timing template — entirely the
GM's own notes, entirely optional to use.

### Investigation prep: Clues

Behind `library_enabled`, alongside the rest of the Library. A `Clue` is a
lightweight, world-scoped note: `text`, a free-text `revelation` label (not
its own entity — just a grouping string), and an optional attachment to any
other Library entity or place (`entity_type`/`entity_id`, the same 7 types
`SessionPlanLibraryLink` accepts). A clue doesn't need an attachment at all.

**Visibility only, never an enforced rule** — loosely inspired by the
clue-redundancy prep technique (multiple clues pointing at the same
revelation, so a scenario survives players missing any one of them), but the
app never enforces a minimum or warns about "not enough" clues. `LibraryPage`
(`frontend/src/pages/gm/LibraryPage.tsx`)'s **Clues** tab groups the list by
`revelation` and shows a plain count per group (clues with no revelation fall
into an "Ungrouped" bucket, sorted last) — the GM decides what's sufficient.

Clue's shape doesn't match the generic name/summary/extra CRUD every other
Library entity shares, so both the backend (`backend/app/routers/library.py`)
and frontend (`CluesPanel` in `LibraryPage.tsx`) give it its own small
dedicated code path rather than forcing it into the shared entity-route
factory / `LibrarySegment` union.

| Endpoint | Description |
| --- | --- |
| `GET /api/library/worlds/{world_id}/clues` | List a world's clues |
| `POST /api/library/worlds/{world_id}/clues` | Create a clue |
| `GET /api/library/worlds/{world_id}/clues/{clue_id}` | Get a clue |
| `PUT /api/library/worlds/{world_id}/clues/{clue_id}` | Update a clue |
| `DELETE /api/library/worlds/{world_id}/clues/{clue_id}` | Delete a clue |

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

**GM-moves reference (DHCM-65/-92/-93)** — a "?" button next to `FearTracker`'s
spend-Fear control opens a reference-only popover of the SRD's example GM
moves, the "when to make a move" trigger conditions, and the soft-vs-hard
move framing (`backend/app/data/srd/gm_moves.json`, served via
`GET /api/gm-moves/`, gated by `combat_tools_enabled`). Purely a lookup aid —
spending Fear never opens it automatically, nothing is chosen or applied for
the GM, and there's no enforced workflow. Fetched once when the popover opens
rather than tied to the +/- buttons, since the data is static.

| Endpoint | Description |
| --- | --- |
| `GET /api/gm-moves/` | The SRD GM-moves reference dataset — gm only |

**Player visibility** — players previously had no way to see the Fear pool or
countdowns at all. Read-only mirrors live under `/api/player`, scoped to the
requesting player's own campaign membership (404 for a campaign they're not in,
same pattern as the rest of the player area) and gated by both
`player_area_enabled` and `combat_tools_enabled`. `CampaignStatusPanel`
(`frontend/src/pages/player/CampaignStatusPanel.tsx`) renders under each
campaign in the Player area's campaign list; since `/api/settings` is gm-only,
it probes availability the same way every other player-area feature does —
a 404 from either endpoint means render nothing.

| Endpoint | Description |
| --- | --- |
| `GET /api/player/campaigns/{id}/fear` | The campaign's current Fear value |
| `GET /api/player/campaigns/{id}/countdowns` | The campaign's countdowns |

### Encounter budget

Also behind `combat_tools_enabled`. `app.services.encounter_budget` implements
the SRD's "Building Balanced Encounters" Battle Points formula verbatim
(pulled from the SRD PDF via PyMuPDF): base budget `(3 × party size) + 2`,
adjusted by up to six GM-chosen factors (easier/harder fight, 2+ Solo
adversaries, bonus damage to all adversaries, including a lower-tier
adversary, skipping Bruisers/Hordes/Leaders/Solos entirely). Party size is a
live count of the campaign's characters, not a stored field.

`EncounterBuilderPanel` (`frontend/src/pages/gm/EncounterBuilderPanel.tsx`) is
a toggleable panel per campaign card: the budget and its adjustment checkboxes
up top, a bestiary search-and-add picker below. Each added adversary's cost is
a client-side lookup (`COST_BY_TYPE` in `frontend/src/api/campaigns.ts`,
mirroring the backend's table exactly) by its SRD `type` — Minions/Social/
Support cost 1, Horde/Ranged/Skulk/Standard cost 2, Leader 3, Bruiser 4, Solo
5. The running total shows against the budget with an over-budget indicator
when it's exceeded, but this is **advisory only** — nothing stops a GM from
adding more. The picked list is local component state, not persisted; live
mid-session tuning is a possible future enhancement, not built here.

| Endpoint | Description |
| --- | --- |
| `GET /api/campaigns/{id}/encounter-budget` | Query params per adjustment (booleans) → `{party_size, budget}` |

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
