import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api/client';
import * as libraryApi from '../api/library';
import * as sessionPlansApi from '../api/sessionPlans';
import SessionPlansPanel from '../pages/gm/SessionPlansPanel';

vi.mock('../api/sessionPlans');
vi.mock('../api/library');
const mocked = vi.mocked(sessionPlansApi);
const mockedLibrary = vi.mocked(libraryApi);

describe('SessionPlansPanel', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockedLibrary.listWorlds.mockResolvedValue([
      { id: 1, name: 'Aetheris', created_at: '2026-01-01T00:00:00Z' },
    ]);
    mockedLibrary.listEntities.mockResolvedValue([]);
    mocked.listLinks.mockResolvedValue([]);
  });

  it('shows a disabled message when the backend 404s', async () => {
    mocked.listSessionPlans.mockRejectedValue(new ApiError(404, 'not found'));
    render(<SessionPlansPanel campaignId={1} />);
    await waitFor(() =>
      expect(screen.getByText(/session planning is currently disabled/i)).toBeInTheDocument(),
    );
  });

  it('shows an empty state with no plans', async () => {
    mocked.listSessionPlans.mockResolvedValue([]);
    render(<SessionPlansPanel campaignId={1} />);
    await waitFor(() => expect(screen.getByText(/No session plans yet/)).toBeInTheDocument());
  });

  it('creates a session plan via the form', async () => {
    mocked.listSessionPlans.mockResolvedValue([]);
    mocked.createSessionPlan.mockResolvedValue({
      id: 2,
      campaign_id: 1,
      title: 'Raid on Hillford, Session 1',
      summary: '',
      order: 0,
      content: {},
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    });

    render(<SessionPlansPanel campaignId={1} />);
    await waitFor(() => expect(screen.getByText(/No session plans yet/)).toBeInTheDocument());

    await userEvent.type(
      screen.getByPlaceholderText('Session title'),
      'Raid on Hillford, Session 1',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Create session plan' }));

    await waitFor(() =>
      expect(mocked.createSessionPlan).toHaveBeenCalledWith(1, {
        title: 'Raid on Hillford, Session 1',
        summary: '',
        order: 0,
        content: {},
      }),
    );
  });

  it('rejects invalid JSON content instead of submitting', async () => {
    mocked.listSessionPlans.mockResolvedValue([]);

    render(<SessionPlansPanel campaignId={1} />);
    await waitFor(() => expect(screen.getByText(/No session plans yet/)).toBeInTheDocument());

    await userEvent.type(screen.getByPlaceholderText('Session title'), 'Session 1');
    fireEvent.change(screen.getByPlaceholderText(/Planned content as JSON/), {
      target: { value: '{not valid json' },
    });
    await userEvent.click(screen.getByRole('button', { name: 'Create session plan' }));

    await waitFor(() => expect(screen.getByText(/must be valid JSON/i)).toBeInTheDocument());
    expect(mocked.createSessionPlan).not.toHaveBeenCalled();
  });

  it('lists existing plans and supports delete', async () => {
    mocked.listSessionPlans.mockResolvedValue([
      {
        id: 2,
        campaign_id: 1,
        title: 'Raid on Hillford, Session 1',
        summary: 'The party arrives.',
        order: 1,
        content: {},
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
    ]);
    mocked.deleteSessionPlan.mockResolvedValue(undefined);

    render(<SessionPlansPanel campaignId={1} />);
    await waitFor(() =>
      expect(screen.getByText('Raid on Hillford, Session 1')).toBeInTheDocument(),
    );

    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(mocked.deleteSessionPlan).toHaveBeenCalledWith(1, 2));
  });

  it('attaches a Library entity link to a plan', async () => {
    mocked.listSessionPlans.mockResolvedValue([
      {
        id: 2,
        campaign_id: 1,
        title: 'Session 1',
        summary: '',
        order: 0,
        content: {},
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
    ]);
    mockedLibrary.listEntities.mockResolvedValue([
      {
        id: 5,
        world_id: 1,
        name: 'Hillford',
        summary: '',
        extra: '{}',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
    ]);
    mocked.createLink.mockResolvedValue({
      id: 9,
      session_plan_id: 2,
      entity_type: 'region',
      entity_id: 5,
      created_at: '2026-01-01T00:00:00Z',
    });

    render(<SessionPlansPanel campaignId={1} />);
    await waitFor(() => expect(screen.getByText('Session 1')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText('Hillford')).toBeInTheDocument());

    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Library entity' }), '5');
    await userEvent.click(screen.getByRole('button', { name: 'Attach' }));

    await waitFor(() =>
      expect(mocked.createLink).toHaveBeenCalledWith(1, 2, { entity_type: 'region', entity_id: 5 }),
    );
  });

  it('resolves an attached link to its entity name instead of a raw id', async () => {
    mocked.listSessionPlans.mockResolvedValue([
      {
        id: 2,
        campaign_id: 1,
        title: 'Session 1',
        summary: '',
        order: 0,
        content: {},
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
    ]);
    mocked.listLinks.mockResolvedValue([
      { id: 9, session_plan_id: 2, entity_type: 'region', entity_id: 5, created_at: '2026-01-01T00:00:00Z' },
    ]);
    mockedLibrary.listEntities.mockImplementation((_worldId, segment) =>
      Promise.resolve(
        segment === 'regions'
          ? [
              {
                id: 5,
                world_id: 1,
                name: 'Hillford',
                summary: '',
                extra: '{}',
                created_at: '2026-01-01T00:00:00Z',
                updated_at: '2026-01-01T00:00:00Z',
              },
            ]
          : [],
      ),
    );

    render(<SessionPlansPanel campaignId={1} />);
    await waitFor(() => expect(screen.getByText('Session 1')).toBeInTheDocument());

    await waitFor(() => expect(screen.getByText('Region: Hillford')).toBeInTheDocument());
    expect(screen.queryByText('region #5')).not.toBeInTheDocument();
  });

  it('falls back to a type/id label when the linked entity is missing', async () => {
    mocked.listSessionPlans.mockResolvedValue([
      {
        id: 2,
        campaign_id: 1,
        title: 'Session 1',
        summary: '',
        order: 0,
        content: {},
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
    ]);
    mocked.listLinks.mockResolvedValue([
      { id: 9, session_plan_id: 2, entity_type: 'npc', entity_id: 999, created_at: '2026-01-01T00:00:00Z' },
    ]);

    render(<SessionPlansPanel campaignId={1} />);
    await waitFor(() => expect(screen.getByText('Session 1')).toBeInTheDocument());

    await waitFor(() => expect(screen.getByText('NPC #999')).toBeInTheDocument());
  });
});
