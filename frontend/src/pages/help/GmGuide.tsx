import HelpSection from './HelpSection';

/** Full GM walkthrough, in the order you'd actually use it. Keep this in
 * sync with new GM-facing features — a stale guide is worse than none. */
export default function GmGuide() {
  return (
    <ul className="flex flex-col gap-3">
      <HelpSection title="1. Turn on the features you want">
        <p>
          Every feature in this app ships off by default. Go to <strong>Host → Settings</strong>{' '}
          and flip on what you need. At minimum, turn on <code>campaigns_enabled</code> to get
          started — the sections below each note which other setting they need.
        </p>
      </HelpSection>

      <HelpSection title="2. Create a campaign" flag="campaigns_enabled">
        <p>
          On the <strong>Gamemaster</strong> tab, fill in the "New Campaign" form (name, optional
          description) and click <strong>Create campaign</strong>. Each campaign gets its own
          players, sessions, Fear pool, and countdowns.
        </p>
      </HelpSection>

      <HelpSection title="3. Invite players" flag="campaigns_enabled">
        <p>
          Two ways to get a player in, both on the Gamemaster tab:
        </p>
        <p>
          <strong>Someone new to the app:</strong> use the "Invite a Player" panel at the top —
          click <strong>Generate invite link</strong> and send them the link. They pick their own
          username and password when they open it, and land straight in the Player area.
        </p>
        <p>
          <strong>Someone who already has an account:</strong> on your campaign's card, click{' '}
          <strong>Members</strong>, then add them by their existing username.
        </p>
      </HelpSection>

      <HelpSection title="4. Run a session" flag="campaigns_enabled">
        <p>
          On a campaign's card, click <strong>Start session</strong>. A campaign has one active
          session at a time; end it with <strong>End session</strong> when you're done. While a
          session is active you'll see a chat panel if <code>chat_enabled</code> is on (needs{' '}
          <code>realtime_enabled</code> too).
        </p>
      </HelpSection>

      <HelpSection title="Watching the party" flag="player_area_enabled">
        <p>
          On a campaign's card, click <strong>Party</strong> to see every player's characters —
          name, class, and (once a player has a completed sheet) their current HP, Stress, and
          Hope. This is read-only; players still mark their own trackers from the Player area.
        </p>
        <p>
          While a session is active, this updates live — a player marking HP shows up here
          immediately, no refresh needed.
        </p>
      </HelpSection>

      <HelpSection title="Session planning" flag="session_planning_enabled">
        <p>
          On a campaign's card, click <strong>Session plans</strong> to draft what you expect to
          happen in an upcoming session: a title and summary, an opening beat for how it starts, a
          list of hooks to seed, a sequence of story beats, parallel countdowns (Daggerheart's
          countdown mechanic — segments, what ticks them, what happens on completion or early
          intervention), a reward, and freeform notes. Use the <strong>Add</strong> buttons to add
          as many hooks, beats, or countdowns as you need — every field is optional, so a plan for
          a pure roleplay session looks nothing like one for a raid.
        </p>
        <p>
          You can also link Library entities (see below) you plan to use, like the NPCs,
          adversaries, or environments that'll show up.
        </p>
      </HelpSection>

      <HelpSection title="Library: your world's worldbuilding" flag="library_enabled">
        <p>
          The <strong>Library</strong> tab holds everything about your world that isn't tied to a
          specific campaign: the place hierarchy (Continents → Regions → Locations), Factions,
          NPCs, Adversaries, Environments, and Clues you've authored yourself. The first time you
          visit, you'll be asked to name your world — one world holds everything.
        </p>
        <p>
          Adversaries and Environments you spawn from the Bestiary (below) show up here too,
          alongside anything you write from scratch.
        </p>
      </HelpSection>

      <HelpSection title="Clues: tracking what points to what" flag="library_enabled">
        <p>
          On the Library tab's <strong>Clues</strong> subtab, jot down anything you want players to
          be able to discover: a note of what it is, and (optionally) a <strong>revelation</strong>{' '}
          it points toward — a plain label like "the steward is the thief." You can also attach a
          clue to any other Library entry (an NPC, a location, an adversary, whatever it was found
          on), or leave it unattached.
        </p>
        <p>
          Clues pointing at the same revelation are grouped together with a plain count, so you can
          see at a glance how many ways players have to find something out. There's no enforced
          minimum and no warning if you think there aren't enough — that's your call as GM, not the
          app's.
        </p>
      </HelpSection>

      <HelpSection title="Letting players create characters" flag="character_creation_enabled">
        <p>
          Once you turn this on, players see a "Create Character (Guided)" option that walks them
          through the full Daggerheart Level 1 creation flow — class, subclass, heritage, traits,
          equipment, domain cards, background. You don't do anything here beyond flipping the
          setting; character creation is player-side.
        </p>
      </HelpSection>

      <HelpSection title="Character sheets during play" flag="character_sheet_enabled">
        <p>
          Once a player has a completed character sheet, they can mark and clear HP, Stress, Hope,
          and Armor Slots themselves from the Player area. You don't need to do anything as GM —
          this just needs to be turned on for it to appear.
        </p>
      </HelpSection>

      <HelpSection title="Downtime rests" flag="downtime_enabled">
        <p>
          Also player-side once enabled: short and long rest moves (Tend to Wounds, Clear Stress,
          Repair Armor, Prepare) become available on a player's character sheet between scenes.
        </p>
      </HelpSection>

      <HelpSection title="The Fear pool" flag="combat_tools_enabled">
        <p>
          Each campaign card shows a <strong>Fear</strong> counter with +/- buttons once this is
          on. Per the SRD, you start a campaign with roughly 1 Fear per player and can hold up to
          12 at once; Fear carries over between sessions rather than resetting. Use the + button
          when you gain Fear (a player rolls with Fear, takes a rest, etc.) and the - button when
          you spend it.
        </p>
        <p>
          Click the <strong>?</strong> button next to the Fear counter for a quick reference of
          the SRD's example GM moves — spending Fear is the SRD's own cue to make one. This is a
          lookup only: nothing opens automatically when you spend Fear, nothing is chosen for you,
          and you're free to ignore it entirely.
        </p>
      </HelpSection>

      <HelpSection title="Countdowns" flag="combat_tools_enabled">
        <p>
          On a campaign's card, click <strong>Countdowns</strong> to track SRD countdowns — give
          it a name and a starting value, and check "Loop" if it should reset to its starting
          value each time it triggers instead of just stopping at 0. Click the − button to advance
          it (tick it down); for a standard countdown that's usually once per relevant action
          roll, but for a dynamic countdown you decide how many ticks a given roll result is worth
          — the app doesn't enforce that part, it just tracks the number.
        </p>
      </HelpSection>

      <HelpSection title="Quick generate: names, NPCs, and loot on the fly" flag="generators_enabled">
        <p>
          On a campaign's card, click <strong>Quick generate</strong> when you need a starting
          suggestion mid-session instead of leaving the app: <strong>Generate Name</strong> gives
          a random name, <strong>Generate NPC</strong> gives a quick sketch (role, motivation,
          quirk), and <strong>Generate Loot</strong> gives an item roughly in line with a party's
          level. Not happy with what you got? Click <strong>Reroll</strong> for another, or{' '}
          <strong>Dismiss</strong> to clear it. These are starting points to riff on, not a fixed
          table — edit or ignore anything that doesn't fit.
        </p>
        <p>
          If you want to keep an NPC sketch around, click <strong>Keep</strong> to save it as a
          real entry on your Library's NPCs tab (needs <code>library_enabled</code> and a world
          created there first). Names and loot are copy-only — jot them down if you want to reuse
          them.
        </p>
      </HelpSection>

      <HelpSection title="Encounter builder: keeping fights balanced" flag="combat_tools_enabled">
        <p>
          On a campaign's card, click <strong>Encounter builder</strong> to see a Battle Points
          budget for your current party, per the SRD's encounter-difficulty rules. Check the boxes
          that apply — an easier or harder fight, running two or more Solo adversaries, giving
          everything bonus damage, and so on — and the budget updates live.
        </p>
        <p>
          Search the bestiary below to add adversaries; each one's cost comes off your budget as
          you add it, and you'll see a warning if you go over. This is a guideline, not a hard
          limit — the app never stops you from adding more, it just tells you when a fight is
          likely to run heavier than planned. Nothing here is saved; it's a scratch pad for
          planning, not a persisted encounter list.
        </p>
      </HelpSection>

      <HelpSection title="Bestiary: browsing and using SRD adversaries" flag="combat_tools_enabled">
        <p>
          The <strong>Bestiary</strong> tab is the full SRD reference — all adversary and
          environment stat blocks, searchable by name and filterable by tier. Click a card to see
          its full stat block (Difficulty, Thresholds, HP, Stress, attack, and every feature).
        </p>
        <p>
          To actually use an adversary or environment in your world, expand it and click{' '}
          <strong>Add to Library</strong> — this creates a real Library entry with the whole stat
          block attached, which you can then link into a session plan or just reference on the
          Library tab.
        </p>
      </HelpSection>

      <HelpSection title="Adversary notes: recall your own signature moves" flag="combat_tools_enabled">
        <p>
          Any Adversary on your Library tab has its own freeform <strong>notes</strong> field —
          jot down a signature move, a table-specific reminder, or anything you want to remember
          about it mid-fight. There's no template or required structure; write whatever's useful
          to you.
        </p>
        <p>
          On a campaign's card, click <strong>Adversary notes</strong> for a searchable, read-only
          list of every adversary in your Library and its notes — quick recall during a live
          session without leaving the fight to go dig through the Library tab.
        </p>
      </HelpSection>

      <HelpSection title="Data management" flag="data_management_enabled">
        <p>
          On <strong>Host → Data</strong>: download a backup, check database health, repair, or
          restore/reset. Reset and restore are destructive and require typing{' '}
          <code>ACKNOWLEDGED</code> to confirm.
        </p>
      </HelpSection>
    </ul>
  );
}
