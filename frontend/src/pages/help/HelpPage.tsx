import { useAuth } from '../../context/AuthContext';
import GmGuide from './GmGuide';
import PlayerGuide from './PlayerGuide';

export default function HelpPage() {
  const { user } = useAuth();

  return (
    <section aria-label="Help">
      <h1 className="mb-1 font-display text-2xl text-parchment">Help</h1>
      <p className="mb-6 text-sm text-parchment/50">
        {user?.role === 'gm'
          ? "A walkthrough of running a campaign, in the order you'll actually use it."
          : "A walkthrough of getting set up and playing, in the order you'll actually use it."}
      </p>
      {user?.role === 'gm' ? <GmGuide /> : <PlayerGuide />}
    </section>
  );
}
