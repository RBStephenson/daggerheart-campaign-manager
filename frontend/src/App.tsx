import { Link, Route, Routes } from 'react-router-dom';
import SettingsPage from './pages/settings/SettingsPage';

function Home() {
  return <h1>Daggerheart Campaign Manager</h1>;
}

export default function App() {
  return (
    <div>
      <nav aria-label="Main navigation">
        <Link to="/">Home</Link> | <Link to="/settings">Settings</Link>
      </nav>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
    </div>
  );
}
