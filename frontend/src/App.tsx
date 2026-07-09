import { Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import GamemasterPage from './pages/gm/GamemasterPage';
import DataManagementPage from './pages/host/DataManagementPage';
import HostPage from './pages/host/HostPage';
import HostSettingsPage from './pages/host/HostSettingsPage';
import LaunchPage from './pages/launch/LaunchPage';
import LoginPage from './pages/login/LoginPage';
import PlayerPage from './pages/player/PlayerPage';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<LaunchPage />} />
        <Route
          path="host"
          element={
            <ProtectedRoute roles={['host']}>
              <HostPage />
            </ProtectedRoute>
          }
        >
          <Route path="settings" element={<HostSettingsPage />} />
          <Route path="data" element={<DataManagementPage />} />
        </Route>
        <Route
          path="gm"
          element={
            <ProtectedRoute roles={['gm']}>
              <GamemasterPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="player"
          element={
            <ProtectedRoute roles={['player']}>
              <PlayerPage />
            </ProtectedRoute>
          }
        />
        <Route path="login" element={<LoginPage />} />
      </Route>
    </Routes>
  );
}
