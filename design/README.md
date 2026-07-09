# Handoff: Daggerheart Campaign Manager — Visual Redesign

## Overview
A visual/interaction redesign of the existing Daggerheart Campaign Manager frontend
(React + TypeScript + Tailwind, in `frontend/`). The current app is functionally
complete but visually generic (plain slate Tailwind). This redesign introduces a
dark-fantasy theme for the in-game areas (Launch, Login, Gamemaster, Player) and a
clean warm-neutral admin theme for the Host area, matching the tone already hinted
at by the existing Launch screen's artwork.

## About the Design Files
The bundled file, `Daggerheart Campaign Manager.dc.html`, is a **design reference
built in HTML** — a clickable prototype with mock data and inline styles, not
production code to copy directly. It uses a tab strip at the very top (Launch /
Login / Gamemaster / Player / Host) purely so reviewers can jump between screens —
**do not build that switcher into the real app**; real navigation/auth already
exists in `frontend/src/App.tsx` and must stay as-is (role-gated routes via
`ProtectedRoute`).

The task is to **recreate this HTML design inside the existing React + TypeScript +
Tailwind codebase**, replacing the current plain styling in the listed page/component
files below, reusing existing data-fetching logic (`api/*`, contexts, hooks) — only
the visual layer and the states described here (loading/empty/error, validation,
responsiveness) should change.

## Fidelity
**High-fidelity.** Colors, typography, spacing, and component states below are final;
implement them as specified, using Tailwind utility classes or `tailwind.config`
theme extensions rather than the inline styles used in the prototype (inline styles
were only necessary for the prototyping tool this was built in).

## Design Tokens

### Fonts
- Display/headings: `Cinzel` (Google Font, weights 500/600/700), tracked-out
  letter-spacing (0.02em–0.25em depending on size).
- Body/UI: `Inter` (400/500/600/700).

### Dark fantasy theme (Launch, Login, Gamemaster, Player)
- Background: `#0b0810` (page), `rgba(22,17,31,0.6–0.75)` (cards, translucent)
- Card border: `rgba(245,208,150,0.14–0.2)` (warm amber-tinted hairline)
- Input background: `#0f0b17`
- Primary text: `#f3e9d8` (warm off-white)
- Secondary text: `rgba(243,233,216, 0.35–0.65)` depending on hierarchy
- Accent amber (primary actions): `#d9a54e`, hover/bright `#f2c265`
- Accent violet (secondary/player badges): `#8b6cf0`, chip bg `rgba(139,108,240,0.14)`
- Success/active: `#34d399` (emerald)
- Danger: `#c96a5c` border / `#e08a7a` text / `rgba(196,84,68,0.1-0.12)` bg
- Two soft radial glows per section (amber `rgba(217,165,78,0.08-0.15)` and violet
  `rgba(139,108,240,0.1-0.15)`, `blur(120-140px)`) positioned off-canvas corners —
  decorative only, `aria-hidden`.
- Card radius: 10–14px. Button radius: 7–8px.

### Clean admin theme (Host)
- Light mode: bg `#f7f5f1`, card `#fff`, border `#e2e0dc`, divider `#efece6`,
  heading `#211c14`, subtext `#6b6459`, accent `#a5691f` (muted amber-brown)
- Dark mode (toggle in top-right of Host header): bg `#171310`, card `#211c17`,
  border `#3a332b`, divider `#2c2620`, heading `#f1ece3`, subtext `#a89e8f`
- Danger (reset db): border `#c96a5c`, bg `rgba(196,84,68,0.1)` / `#fdf2f0` light,
  text `#7a3226` light / `#e0a89a` dark

## Screens / Views

### Launch (`frontend/src/pages/launch/LaunchPage.tsx`)
Already close to this look today — no major change needed beyond the existing
implementation, aside from responsive tile row: tiles use `flex: 0 1 180px;
max-width: 224px; min-width: 140px` so 3 tiles sit in one row when there's room and
wrap only when the container is too narrow. Watch for parent containers that
shrink-wrap to text width (`align-items: center` column) — give the row's ancestor
`width: 100%` explicitly or the flex row's `100%` basis resolves against the wrong
box and wraps prematurely.

### Login (`frontend/src/pages/login/LoginPage.tsx`)
- Centered card (max-width 380px) on the dark bg with the two glow blobs.
- "DAGGERHEART" Cinzel wordmark + "Campaign Manager" small tracked subhead above card.
- Card heading "Enter the Realm" (Cinzel, 18px).
- Inputs: label above field, uppercase 12px label, dark input, amber border on error.
- **Validation** (new): username/password required; errors shown inline below each
  field only after that field has been touched/edited (`"Username is required."` /
  `"Password is required."`), input border turns `#c96a5c` on error. Submit is
  always clickable but marks both fields touched on click if invalid. On valid
  submit, button reads "Logging in…" (disabled) then surfaces a server error
  paragraph above the button using the existing copy from `LoginPage.tsx`:
  `"Invalid username or password."` for a 401, `"Login failed."` otherwise.

### Gamemaster (`frontend/src/pages/gm/GamemasterPage.tsx`)
- Page header with campaign count, "New Campaign" card (name + description +
  submit), then a list of campaign cards.
- Campaign card: name (Cinzel), description, active/inactive badge (emerald vs.
  neutral), Start/End session button (amber solid vs. red-tinted outline), Edit/
  Delete ghost buttons. Active session reveals an inline Table Chat panel (existing
  `ChatPanel` component — restyle to match: dark message log, amber/violet sender
  name colors, inline composer).
- **Loading/Empty/Error states** (new): a small "Populated / Empty / Loading /
  Error" state affects the list — real implementation should replace this with
  actual query state (`isLoading`, `data.length === 0`, `isError`) from whatever
  data-fetching hook wraps `listCampaigns()`:
  - Loading: 3 pulsing skeleton rows (`opacity 0.5↔1` 1.4s ease-in-out loop),
    subtle card-shaped placeholders.
  - Empty: dashed-border panel, "No campaigns yet. Create one above."
  - Error: red-tinted banner, "Failed to load campaigns." + Retry button that
    re-triggers the fetch.

### Player (`frontend/src/pages/player/PlayerPage.tsx` + `CharacterWizard.tsx`)
- "My Campaigns" as violet pill chips.
- "My Characters" as a card grid (name, level badge, class/ancestry/community
  subtitle, campaign name).
- Loading/Empty/Error states mirror the GM screen, with copy matching the existing
  app strings ("You haven't been added to a campaign yet…", "No characters yet.",
  "Failed to load your data.").
- **Guided Character Wizard**: inline (not a separate route/tab) — "Create
  Character (Guided)" button toggles the 8-step wizard in place of the button
  (Cancel returns to the button). Steps: Class & Subclass → Heritage → Traits →
  Equipment → Experiences → Domain Cards → Background → Review, mirroring
  `CharacterWizard.tsx`'s existing step order and validation rules (trait-array
  values each usable once; domain cards must be two distinct cards from the
  class's domains; Next disabled until the current step is valid). Step chips
  are clickable to jump directly. On finish, appends the character to the list
  (in the real app: calls `createCharacter`).
- Notes: campaign select + textarea + Save button, matching existing behavior.

### Host (`frontend/src/pages/host/HostPage.tsx`, `HostSettingsPage.tsx`,
`DataManagementPage.tsx`)
- Clean admin theme (see tokens above). Light/dark toggle button top-right of the
  header (this is a **design-only** toggle for previewing the admin theme in both
  modes — decide with the team whether it should ship as a real user preference
  or just inform a single fixed theme choice).
- Settings/Data sub-tabs (underline-style, matches `border-bottom` active state).
- Settings tab: list of feature flags, each with a description and a toggle
  switch (amber track when on, track color per theme).
- Data tab: Download backup / Run health check (buttons show a one-line status
  message below on click) / Reset database (opens the type-`ACKNOWLEDGED`-to-
  confirm destructive-action dialog per the existing backend contract in
  `README.md` → Host: data management).

## Interactions & Behavior Summary
- All buttons/inputs use `cursor: pointer` / focus-visible styling — carry over
  standard accessible focus rings when implementing (the prototype omits them
  for brevity; production must not).
- Skeleton loading uses a simple opacity pulse keyframe, not shimmer.
- Destructive actions (Reset database) require literal `ACKNOWLEDGED` text match
  before the confirm button enables — mirrors backend requirement already
  documented in the project README.

## Assets
- `assets/launch/host.webp`, `gm.webp`, `players.webp` — the three Launch/area
  tiles, copied verbatim from `frontend/public/launch/`. Reuse the existing files
  already in the codebase; nothing new to source.
- No other imagery; icons are text/CSS only (no icon font used).

## Files
- `Daggerheart Campaign Manager.dc.html` — the full interactive prototype (all
  screens, mock data, and state toggles described above).
- `assets/launch/*.webp` — reference copies of the launch tile art (already in
  `frontend/public/launch/` in the app repo).
- `screenshots/01-launch.png` … `05-host.png` — static reference screenshots of
  each screen in its default (populated, light-mode-where-applicable) state.
