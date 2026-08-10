import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import BestiaryPage from './pages/gm/BestiaryPage';
import CampaignsPage from './pages/gm/CampaignsPage';
import GmPage from './pages/gm/GmPage';
import LibraryPage from './pages/gm/LibraryPage';
import HelpPage from './pages/help/HelpPage';
import DataManagementPage from './pages/host/DataManagementPage';
import HostPage from './pages/host/HostPage';
import HostSettingsPage from './pages/host/HostSettingsPage';
import LoginPage from './pages/login/LoginPage';
import PlayerPage from './pages/player/PlayerPage';
import RegisterPage from './pages/register/RegisterPage';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/login" replace />} />
        <Route
          path="host"
          element={
            <ProtectedRoute roles={['gm']}>
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
              <GmPage />
            </ProtectedRoute>
          }
        >
          <Route index element={<CampaignsPage />} />
          <Route path="library" element={<LibraryPage />} />
          <Route path="bestiary" element={<BestiaryPage />} />
        </Route>
        <Route
          path="player"
          element={
            <ProtectedRoute roles={['player']}>
              <PlayerPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="help"
          element={
            <ProtectedRoute roles={['gm', 'player']}>
              <HelpPage />
            </ProtectedRoute>
          }
        />
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
      </Route>
    </Routes>
  );
}
