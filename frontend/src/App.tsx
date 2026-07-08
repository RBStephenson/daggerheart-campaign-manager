import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import GamemasterPage from './pages/gm/GamemasterPage';
import HostPage from './pages/host/HostPage';
import HostSettingsPage from './pages/host/HostSettingsPage';
import LoginPage from './pages/login/LoginPage';
import PlayerPage from './pages/player/PlayerPage';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/host" replace />} />
        <Route path="host" element={<HostPage />}>
          <Route path="settings" element={<HostSettingsPage />} />
        </Route>
        <Route path="gm" element={<GamemasterPage />} />
        <Route path="player" element={<PlayerPage />} />
        <Route path="login" element={<LoginPage />} />
      </Route>
    </Routes>
  );
}
