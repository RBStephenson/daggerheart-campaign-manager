import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as appSettings from '../context/AppSettingsContext';
import GmPage from '../pages/gm/GmPage';

vi.mock('../context/AppSettingsContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../context/AppSettingsContext')>();
  return { ...actual, useAppSettings: vi.fn() };
});
const mockedSettings = vi.mocked(appSettings.useAppSettings);

function renderGmPage() {
  return render(
    <MemoryRouter initialEntries={['/gm']}>
      <Routes>
        <Route path="/gm" element={<GmPage />}>
          <Route index element={<div>campaigns content</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('GmPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('hides the Bestiary tab when combat_tools_enabled is off', () => {
    mockedSettings.mockReturnValue({
      settings: appSettings.DEFAULTS,
      loading: false,
      updateSettings: vi.fn(),
    });
    renderGmPage();
    expect(screen.queryByRole('link', { name: 'Bestiary' })).not.toBeInTheDocument();
  });

  it('shows the Bestiary tab when combat_tools_enabled is on', () => {
    mockedSettings.mockReturnValue({
      settings: { ...appSettings.DEFAULTS, combat_tools_enabled: true },
      loading: false,
      updateSettings: vi.fn(),
    });
    renderGmPage();
    expect(screen.getByRole('link', { name: 'Bestiary' })).toBeInTheDocument();
  });
});
