import { useEffect, useMemo, useState } from 'react';
import { createCharacter } from '../../api/player';
import { getCharacterCreationData, type SrdCharacterCreationData } from '../../api/srd';

interface CharacterWizardProps {
  campaignId: number;
  onCreated: () => void;
  onCancel: () => void;
}

type Traits = Record<string, number | null>;

const STEP_LABELS = [
  'Class & Subclass',
  'Heritage',
  'Traits',
  'Equipment',
  'Experiences',
  'Domain Cards',
  'Background',
  'Review',
];

function remainingPool(traitArray: number[], assignments: Traits, excludeTrait: string): number[] {
  const pool = [...traitArray];
  for (const [trait, value] of Object.entries(assignments)) {
    if (trait === excludeTrait || value === null) continue;
    const idx = pool.indexOf(value);
    if (idx !== -1) pool.splice(idx, 1);
  }
  return pool;
}

export default function CharacterWizard({ campaignId, onCreated, onCancel }: CharacterWizardProps) {
  const [data, setData] = useState<SrdCharacterCreationData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState('');
  const [className, setClassName] = useState('');
  const [subclass, setSubclass] = useState('');
  const [ancestry, setAncestry] = useState('');
  const [community, setCommunity] = useState('');
  const [traits, setTraits] = useState<Traits>({});
  const [primaryWeapon, setPrimaryWeapon] = useState('');
  const [secondaryWeapon, setSecondaryWeapon] = useState('');
  const [armor, setArmor] = useState('');
  const [experience1, setExperience1] = useState('');
  const [experience2, setExperience2] = useState('');
  const [domainCard1, setDomainCard1] = useState('');
  const [domainCard2, setDomainCard2] = useState('');
  const [background, setBackground] = useState('');
  const [connections, setConnections] = useState('');

  useEffect(() => {
    getCharacterCreationData()
      .then((d) => {
        setData(d);
        setTraits(Object.fromEntries(d.traits.map((t) => [t, null])));
      })
      .catch(() => setLoadError('Failed to load character creation data.'));
  }, []);

  const selectedClass = useMemo(
    () => data?.classes.find((c) => c.name === className) ?? null,
    [data, className],
  );

  const primary = useMemo(
    () => data?.weapons_tier1.find((w) => w.name === primaryWeapon) ?? null,
    [data, primaryWeapon],
  );

  const candidateDomainCards = useMemo(
    () => data?.domain_cards_l1.filter((c) => selectedClass?.domains.includes(c.domain)) ?? [],
    [data, selectedClass],
  );

  if (loadError) return <p className="text-danger-text">{loadError}</p>;
  if (!data) return <p className="text-parchment/60">Loading character creation data…</p>;

  const traitsComplete = data.traits.every((t) => traits[t] !== null && traits[t] !== undefined);
  const canSubmit =
    className !== '' &&
    subclass !== '' &&
    ancestry !== '' &&
    community !== '' &&
    traitsComplete &&
    primaryWeapon !== '' &&
    armor !== '' &&
    experience1.trim() !== '' &&
    experience2.trim() !== '' &&
    domainCard1 !== '' &&
    domainCard2 !== '' &&
    domainCard1 !== domainCard2 &&
    name.trim() !== '';

  async function handleSubmit() {
    if (!data || !selectedClass || !canSubmit) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const [card1Domain, card1Name] = domainCard1.split('::');
      const [card2Domain, card2Name] = domainCard2.split('::');
      const sheet = {
        char_class: selectedClass.name,
        subclass,
        heritage: { ancestry, community },
        traits,
        evasion: selectedClass.starting_evasion,
        hp_max: selectedClass.starting_hp,
        stress_max: data.starting.stress,
        hope: data.starting.hope,
        proficiency: data.starting.proficiency,
        level: data.starting.level,
        experiences: [
          { name: experience1.trim(), modifier: 2 },
          { name: experience2.trim(), modifier: 2 },
        ],
        domain_cards: [
          { domain: card1Domain, name: card1Name },
          { domain: card2Domain, name: card2Name },
        ],
        equipment: {
          primary_weapon: primaryWeapon,
          secondary_weapon: secondaryWeapon || null,
          armor,
        },
        ...(background.trim() ? { background: { notes: background.trim() } } : {}),
        ...(connections.trim()
          ? { connections: connections.split('\n').map((l) => l.trim()).filter(Boolean) }
          : {}),
      };
      await createCharacter({
        campaign_id: campaignId,
        name: name.trim(),
        char_class: selectedClass.name,
        ancestry,
        community,
        level: 1,
        extra: JSON.stringify(sheet),
      });
      onCreated();
    } catch {
      setSubmitError('Failed to create character. Check your selections and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl rounded-[12px] border border-hairline/15 bg-nightshade/70 p-4">
      <div className="mb-4 flex flex-wrap gap-2 text-xs">
        {STEP_LABELS.map((label, i) => (
          <button
            key={label}
            type="button"
            onClick={() => setStep(i)}
            className={`rounded px-2 py-1 transition-colors ${
              i === step ? 'bg-ember text-void' : 'bg-white/5 text-parchment/50 hover:bg-white/10'
            }`}
          >
            {i + 1}. {label}
          </button>
        ))}
      </div>

      {step === 0 && (
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm text-parchment/70">
            Character Name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-md border border-hairline/20 bg-input-dark px-3 py-2 text-parchment focus:outline-none focus-visible:ring-2 focus-visible:ring-ember"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-parchment/70">
            Class
            <select
              value={className}
              onChange={(e) => {
                setClassName(e.target.value);
                setSubclass('');
              }}
              className="rounded-md border border-hairline/20 bg-input-dark px-3 py-2 text-parchment focus:outline-none focus-visible:ring-2 focus-visible:ring-ember"
            >
              <option value="">Choose a class…</option>
              {data.classes.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name} ({c.domains.join(' & ')})
                </option>
              ))}
            </select>
          </label>
          {selectedClass && (
            <label className="flex flex-col gap-1 text-sm text-parchment/70">
              Subclass
              <select
                value={subclass}
                onChange={(e) => setSubclass(e.target.value)}
                className="rounded-md border border-hairline/20 bg-input-dark px-3 py-2 text-parchment focus:outline-none focus-visible:ring-2 focus-visible:ring-ember"
              >
                <option value="">Choose a subclass…</option>
                {selectedClass.subclasses.map((s) => (
                  <option key={s.name} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      )}

      {step === 1 && (
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm text-parchment/70">
            Ancestry
            <select
              value={ancestry}
              onChange={(e) => setAncestry(e.target.value)}
              className="rounded-md border border-hairline/20 bg-input-dark px-3 py-2 text-parchment focus:outline-none focus-visible:ring-2 focus-visible:ring-ember"
            >
              <option value="">Choose an ancestry…</option>
              {data.ancestries.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm text-parchment/70">
            Community
            <select
              value={community}
              onChange={(e) => setCommunity(e.target.value)}
              className="rounded-md border border-hairline/20 bg-input-dark px-3 py-2 text-parchment focus:outline-none focus-visible:ring-2 focus-visible:ring-ember"
            >
              <option value="">Choose a community…</option>
              {data.communities.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-parchment/50">
            Assign each modifier from {data.trait_array.join(', ')} to a trait.
          </p>
          {data.traits.map((trait) => {
            const options = remainingPool(data.trait_array, traits, trait);
            return (
              <label key={trait} className="flex items-center justify-between gap-2 text-sm text-parchment/70">
                {trait}
                <select
                  value={traits[trait] ?? ''}
                  onChange={(e) =>
                    setTraits((prev) => ({
                      ...prev,
                      [trait]: e.target.value === '' ? null : Number(e.target.value),
                    }))
                  }
                  className="w-24 rounded-md border border-hairline/20 bg-input-dark px-2 py-1 text-parchment focus:outline-none focus-visible:ring-2 focus-visible:ring-ember"
                >
                  <option value="">—</option>
                  {options.map((v, i) => (
                    <option key={`${v}-${i}`} value={v}>
                      {v > 0 ? `+${v}` : v}
                    </option>
                  ))}
                </select>
              </label>
            );
          })}
        </div>
      )}

      {step === 3 && (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-parchment/50">
            Evasion {selectedClass?.starting_evasion} · HP {selectedClass?.starting_hp} · Stress{' '}
            {data.starting.stress} · Hope {data.starting.hope} · Proficiency{' '}
            {data.starting.proficiency}
          </p>
          <label className="flex flex-col gap-1 text-sm text-parchment/70">
            Primary Weapon
            <select
              value={primaryWeapon}
              onChange={(e) => {
                setPrimaryWeapon(e.target.value);
                setSecondaryWeapon('');
              }}
              className="rounded-md border border-hairline/20 bg-input-dark px-3 py-2 text-parchment focus:outline-none focus-visible:ring-2 focus-visible:ring-ember"
            >
              <option value="">Choose a weapon…</option>
              {data.weapons_tier1.map((w) => (
                <option key={w.name} value={w.name}>
                  {w.name} — {w.trait}, {w.range}, {w.damage} ({w.burden})
                </option>
              ))}
            </select>
          </label>
          {primary?.burden === 'One-Handed' && (
            <label className="flex flex-col gap-1 text-sm text-parchment/70">
              Secondary Weapon (optional)
              <select
                value={secondaryWeapon}
                onChange={(e) => setSecondaryWeapon(e.target.value)}
                className="rounded-md border border-hairline/20 bg-input-dark px-3 py-2 text-parchment focus:outline-none focus-visible:ring-2 focus-visible:ring-ember"
              >
                <option value="">None</option>
                {data.weapons_tier1
                  .filter((w) => w.burden === 'One-Handed' && w.name !== primaryWeapon)
                  .map((w) => (
                    <option key={w.name} value={w.name}>
                      {w.name} — {w.trait}, {w.range}, {w.damage}
                    </option>
                  ))}
              </select>
            </label>
          )}
          <label className="flex flex-col gap-1 text-sm text-parchment/70">
            Armor
            <select
              value={armor}
              onChange={(e) => setArmor(e.target.value)}
              className="rounded-md border border-hairline/20 bg-input-dark px-3 py-2 text-parchment focus:outline-none focus-visible:ring-2 focus-visible:ring-ember"
            >
              <option value="">Choose armor…</option>
              {data.armor_tier1.map((a) => (
                <option key={a.name} value={a.name}>
                  {a.name} — thresholds {a.base_thresholds.join('/')}, score {a.base_score}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      {step === 4 && (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-parchment/50">Two Experiences, each with a +2 modifier.</p>
          <input
            value={experience1}
            onChange={(e) => setExperience1(e.target.value)}
            placeholder="Experience 1 (e.g. Bounty Hunter)"
            className="rounded-md border border-hairline/20 bg-input-dark px-3 py-2 text-sm text-parchment placeholder:text-parchment/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-ember"
          />
          <input
            value={experience2}
            onChange={(e) => setExperience2(e.target.value)}
            placeholder="Experience 2 (e.g. Silver Tongue)"
            className="rounded-md border border-hairline/20 bg-input-dark px-3 py-2 text-sm text-parchment placeholder:text-parchment/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-ember"
          />
        </div>
      )}

      {step === 5 && (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-parchment/50">
            Choose two Level 1 domain cards from {selectedClass?.domains.join(' or ')}.
          </p>
          <select
            value={domainCard1}
            onChange={(e) => setDomainCard1(e.target.value)}
            className="rounded-md border border-hairline/20 bg-input-dark px-3 py-2 text-sm text-parchment placeholder:text-parchment/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-ember"
          >
            <option value="">Choose a card…</option>
            {candidateDomainCards.map((c) => (
              <option key={`${c.domain}::${c.name}`} value={`${c.domain}::${c.name}`}>
                {c.domain} — {c.name}
              </option>
            ))}
          </select>
          <select
            value={domainCard2}
            onChange={(e) => setDomainCard2(e.target.value)}
            className="rounded-md border border-hairline/20 bg-input-dark px-3 py-2 text-sm text-parchment placeholder:text-parchment/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-ember"
          >
            <option value="">Choose a card…</option>
            {candidateDomainCards
              .filter((c) => `${c.domain}::${c.name}` !== domainCard1)
              .map((c) => (
                <option key={`${c.domain}::${c.name}`} value={`${c.domain}::${c.name}`}>
                  {c.domain} — {c.name}
                </option>
              ))}
          </select>
        </div>
      )}

      {step === 6 && (
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm text-parchment/70">
            Background
            <textarea
              value={background}
              onChange={(e) => setBackground(e.target.value)}
              rows={4}
              placeholder="Answer a background question, or leave blank to discover it through play."
              className="rounded-md border border-hairline/20 bg-input-dark px-3 py-2 text-parchment focus:outline-none focus-visible:ring-2 focus-visible:ring-ember"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-parchment/70">
            Connections (one per line)
            <textarea
              value={connections}
              onChange={(e) => setConnections(e.target.value)}
              rows={4}
              className="rounded-md border border-hairline/20 bg-input-dark px-3 py-2 text-parchment focus:outline-none focus-visible:ring-2 focus-visible:ring-ember"
            />
          </label>
        </div>
      )}

      {step === 7 && (
        <div className="flex flex-col gap-1 text-sm text-parchment/80">
          <p>
            <strong>{name}</strong> — {className} ({subclass})
          </p>
          <p>
            {ancestry} · {community}
          </p>
          <p>Traits: {data.traits.map((t) => `${t} ${traits[t]! > 0 ? '+' : ''}${traits[t]}`).join(', ')}</p>
          <p>
            Weapon: {primaryWeapon}
            {secondaryWeapon ? ` + ${secondaryWeapon}` : ''} · Armor: {armor}
          </p>
          <p>
            Experiences: {experience1} (+2), {experience2} (+2)
          </p>
          <p>
            Domain Cards: {domainCard1.replace('::', ' — ')}, {domainCard2.replace('::', ' — ')}
          </p>
          {submitError && <p className="text-danger-text">{submitError}</p>}
        </div>
      )}

      <div className="mt-4 flex justify-between">
        <button
          type="button"
          onClick={step === 0 ? onCancel : () => setStep((s) => s - 1)}
          className="rounded-md border border-hairline/20 px-4 py-2 text-sm text-parchment/70 hover:bg-white/5 hover:text-parchment"
        >
          {step === 0 ? 'Cancel' : 'Back'}
        </button>
        {step < STEP_LABELS.length - 1 ? (
          <button
            type="button"
            onClick={() => setStep((s) => s + 1)}
            className="rounded-md bg-ember px-4 py-2 text-sm font-semibold text-void hover:bg-ember-bright"
          >
            Next
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={!canSubmit || submitting}
            className="rounded-md bg-ember px-4 py-2 text-sm font-semibold text-void hover:bg-ember-bright disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? 'Creating…' : 'Create Character'}
          </button>
        )}
      </div>
    </div>
  );
}
