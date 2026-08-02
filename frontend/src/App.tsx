import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import CampaignsPage from './pages/gm/CampaignsPage';
import GmPage from './pages/gm/GmPage';
import LibraryPage from './pages/gm/LibraryPage';
import DataManagementPage from './pages/host/DataManagementPage';
import HostPage from './pages/host/HostPage';
import HostSettingsPage from './pages/host/HostSettingsPage';
import LoginPage from './pages/login/LoginPage';
import PlayerPage from './pages/player/PlayerPage';

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
        </Route>
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
