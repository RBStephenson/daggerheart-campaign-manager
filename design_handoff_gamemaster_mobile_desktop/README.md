# Handoff: Gamemaster Area — Responsive Redesign

## Overview
Redesign of the Gamemaster area (`frontend/src/pages/gm/`) to fix usability problems on both mobile and desktop. The current implementation (`CampaignsPage.tsx`) stacks up to 7 toggleable panels (Party, Session Plans, Members, Countdowns, Adversary Notes, Encounter Builder, Quick Generate) underneath each campaign card, all expanding in place — this becomes unusable on small screens and cluttered on desktop. This redesign replaces that with a **drill-down navigation on mobile** and a **persistent master-detail (sidebar + pane) layout on desktop**, both using a single horizontal sub-nav to switch between panel types instead of stacking them.

The existing dark-fantasy visual theme (`design/README.md` in the app repo — Cinzel + Inter, near-black background, amber/violet accents) is unchanged; only layout and navigation patterns are new.

## About the Design Files
`Gamemaster Mobile.dc.html` and `Gamemaster Desktop.dc.html` are **design references built in HTML** — clickable prototypes with mock data and inline styles, not production code to copy directly. The task is to **recreate this interaction pattern inside the existing React + TypeScript + Tailwind codebase**, replacing `CampaignsPage.tsx` (and wiring it into `GmPage.tsx`'s existing tab/routing structure), reusing existing data-fetching logic (`api/campaigns.ts`, the panel components in `pages/gm/*Panel.tsx`) — only the layout/navigation and visual polish should change, not the underlying data logic. Use a CSS breakpoint (e.g. Tailwind `lg:`) to switch between the mobile and desktop layouts described below — this should be one responsive page, not two separate builds.

## Fidelity
**High-fidelity for layout and interaction pattern.** Colors/typography/spacing follow the existing app's established Tailwind theme (see `design/README.md` tokens) rather than the inline styles in the prototype, which exist only because of the prototyping tool used to build them.

## Core interaction change
Today, tapping "Party", "Countdowns", etc. on a campaign card toggles that panel open **inline, stacked with any other open panels**, on the same page as the campaign list. The redesign instead treats each campaign as having its own **detail view** with one panel visible at a time, switched via a pill-style sub-nav (Overview / Party / Plans / Members / Countdowns / Adversaries / Encounter / Generate).

- **Mobile (< lg breakpoint):** tapping a campaign card navigates to a full-screen detail view with a back button in the header. This is a genuine drill-down (route change or view-state push), matching a native-app feel.
- **Desktop (≥ lg breakpoint):** no drill-down. A two-pane layout keeps the campaign list visible at all times in a left sidebar (~320px); selecting a campaign swaps the content of a persistent right-hand detail pane. This avoids a full navigation away from the list, which is the specific complaint that motivated this redesign ("I don't like the drilldown nature of how it works today").

## Screens / Views

### Mobile (`Gamemaster Mobile.dc.html`)
- **Bottom tab bar** (fixed, 4 tabs: Campaigns / Library / Bestiary / Help) — replaces `GmPage.tsx`'s current top underline-tab nav on small screens. Active tab: amber dot + amber label text; inactive: muted.
- **Campaigns list screen:** header shows count; a "+" button (top right) opens a bottom sheet for creating a campaign. Each campaign is a compact card: name, status badge, one-line description, a row of 12 small Fear dots (filled amber up to current Fear value), and a trailing chevron. Tapping the card (not a sub-control) opens the detail screen.
- **Campaign detail screen:** header has a back chevron + campaign name (truncated) + an overflow "⋮" menu (Edit / Delete). Below the header: a session card containing the active/inactive badge, inline Fear +/- stepper, a full-width Start/End Session button, and — only when a session is active — a "Table Chat" toggle that reveals a compact message log + composer inline (not a separate screen).
- **Sub-nav:** a horizontal-scrolling row of pill buttons (Overview, Party, Plans, Members, Countdowns, Adversaries, Encounter, Generate). Exactly one panel's content renders below at a time. This pill row must scroll horizontally without clipping its last item — allocate `overflow-x: auto` with padding matching the outer container's gutter (the prototype had a clipping bug here that was fixed by giving the scroll container negative-margin/padding matching the page gutter and `flex: none` on each pill).
- **New Campaign sheet:** bottom sheet (slides up from bottom, dark scrim, drag handle affordance, form fields, primary submit button) — used for both create and edit.

### Desktop (`Gamemaster Desktop.dc.html`)
- **Top bar:** wordmark + horizontal tab nav (Campaigns / Library / Bestiary / Help), replacing the current underline tabs 1:1 but restyled as pill buttons.
- **Campaigns tab — two-pane grid** (`grid-template-columns: 320px 1fr`):
  - **Left pane:** the same compact campaign cards as mobile (minus the chevron), in a scrollable list; a "+ New" button sits above the list. The selected campaign's card is visually distinguished (amber border/background tint).
  - **Right pane:** a single persistent detail card containing: header row (campaign name + description, Edit/Delete buttons top-right), a session/Fear/chat control bar, the same pill sub-nav as mobile (wraps instead of scrolling, since there's more width), and the active panel's content laid out in a responsive grid (`repeat(auto-fill, minmax(...))`) instead of a single mobile column — e.g. Party cards and Countdown cards lay out 2–3 per row.
- **Library / Bestiary / Help tabs:** simple grid layouts of the same content shown on mobile, just wider.
- **New/Edit Campaign:** a centered modal dialog (not a bottom sheet, since there's no "bottom" affordance on desktop) with the same form fields.

## Panels (content per sub-nav tab)
Reuse existing components/logic; only the wrapping layout changes.
- **Overview:** campaign description + session room id. Maps to data already on the `Campaign`/`GameSession` objects.
- **Party:** `PartyPanel.tsx` data — per-character name, player username, class/ancestry/community subtitle, HP and Stress as horizontal progress bars (green for HP, violet for Stress).
- **Plans:** `SessionPlansPanel.tsx` — list of plan title + summary; inline add form (title + summary) at the bottom, no separate modal needed.
- **Members:** `MembersPanel.tsx` — list of usernames with a Remove button each; inline "add by username" form.
- **Countdowns:** `CountdownsPanel.tsx` — name, current/starting shown as a progress bar, Tick +/- buttons (large tap targets — min 44px height on mobile).
- **Adversaries:** `AdversaryNotesPanel.tsx` — name + freeform notes text, read display (editing can stay as it exists today).
- **Encounter:** `EncounterBuilderPanel.tsx` — Battle Points budget-vs-used shown prominently (color shifts to the danger red when used > budget), list of picked adversaries with cost, "+ Add adversary" action.
- **Generate:** `QuickGeneratePanel.tsx` — Name/NPC/Loot buttons, result card with Reroll/Dismiss (and Keep for NPC results, per existing behavior).

## Interactions & Behavior Summary
- Fear stepper: clamp 0–12, matches existing `PATCH /api/campaigns/{id}/fear` behavior.
- Start/End Session: same as existing `startSession`/`endSession` calls; button swaps between amber solid (Start) and red-outline (End).
- Table Chat: reuses `ChatPanel`'s existing data/behavior, just restyled to fit inline under the session bar instead of below the whole panel stack.
- Countdown ticks: same `PATCH .../countdowns/{id}` delta semantics as today.
- All interactive controls need visible focus rings (the prototype omits them for brevity — production must not, same requirement as the earlier visual-theme handoff in `design/README.md`).
- Tap targets on mobile must stay ≥44px tall (pill buttons, tick buttons, remove buttons).
- Loading/Empty/Error states for the campaign list should carry over unchanged from the current implementation (skeleton rows / dashed empty panel / red error banner with Retry).

## Design Tokens
Reuse the tokens already documented in the app repo's `design/README.md` (dark-fantasy theme): background `#0b0810`, card `rgba(22,17,31,0.55–0.75)`, hairline border `rgba(245,208,150,0.12–0.2)`, primary text `#f3e9d8`, amber accent `#d9a54e`/bright `#f2c265`, violet accent `#8b6cf0`, success `#34d399`, danger border `#c96a5c`/text `#e08a7a`. Fonts: Cinzel (headings/labels), Inter (body/UI).

## Assets
No new image assets. Icons are text glyphs only (‹, ⋮, ›, +, –) — no icon font, matching the existing app convention.

## Files
- `Gamemaster Mobile.dc.html` — mobile prototype (drill-down navigation, bottom tab bar, bottom sheets).
- `Gamemaster Desktop.dc.html` — desktop prototype (master-detail two-pane layout, top tab bar, modal dialogs).

Both files are self-contained and open directly in a browser to view/interact with the intended behavior.
