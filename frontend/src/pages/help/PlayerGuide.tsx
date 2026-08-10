import HelpSection from './HelpSection';

/** Full Player walkthrough, in the order you'd actually use it. Keep this in
 * sync with new player-facing features — a stale guide is worse than none. */
export default function PlayerGuide() {
  return (
    <ul className="flex flex-col gap-3">
      <HelpSection title="1. Get an account">
        <p>
          Your GM sends you an invite link. Open it, pick a username and password, and you're
          logged in automatically — no separate registration step.
        </p>
      </HelpSection>

      <HelpSection title="2. Find your campaigns">
        <p>
          The Player area lists every campaign your GM has added you to. If you don't see the one
          you're expecting, ask your GM to add you via their Members panel.
        </p>
      </HelpSection>

      <HelpSection title="3. Create a character">
        <p>
          If your GM has turned on guided creation, you'll see a{' '}
          <strong>Create Character (Guided)</strong> button — this walks you through the full
          Level 1 Daggerheart process: class and subclass, ancestry and community, assigning your
          trait array, equipment, experiences, domain cards, and background questions. Everything
          is pulled from the official SRD text, including full feature descriptions at each step.
        </p>
        <p>
          If guided creation isn't on yet, there's a simple flat form (name, class, ancestry,
          community) as a fallback.
        </p>
      </HelpSection>

      <HelpSection title="Your character sheet">
        <p>
          Once your character has a completed sheet, you'll see trackers for HP, Stress, Hope, and
          Armor Slots with +/- buttons — mark them as things happen in play, clear them as you
          recover. Your GM has to turn this on for it to appear.
        </p>
      </HelpSection>

      <HelpSection title="Resting">
        <p>
          When your GM has downtime turned on, rest controls appear on your character sheet.
          Choose <strong>Short Rest</strong> or <strong>Long Rest</strong>, then pick a move:
        </p>
        <p>
          <strong>Tend to Wounds</strong> / <strong>Clear Stress</strong> /{' '}
          <strong>Repair Armor</strong> roll dice and clear that much (a short rest clears some, a
          long rest clears it all). <strong>Prepare</strong> gives you Hope instead, capped at 6.
        </p>
      </HelpSection>

      <HelpSection title="Notes">
        <p>
          Each campaign has one private notes box just for you — your GM and other players can't
          see it. Type your notes and click <strong>Save note</strong>; it's there whenever you
          come back.
        </p>
      </HelpSection>

      <HelpSection title="Chat">
        <p>
          When your GM has an active session running and chat is turned on, a chat panel appears
          for talking with the table in real time.
        </p>
      </HelpSection>
    </ul>
  );
}
