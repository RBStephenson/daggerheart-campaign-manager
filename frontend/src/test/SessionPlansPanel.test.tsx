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
        content: { opening: '', hooks: [], beats: [], reward: '', notes: '' },
      }),
    );
  });

  it('sends opening/reward/notes/hooks as dedicated fields, separate from the countdowns JSON', async () => {
    mocked.listSessionPlans.mockResolvedValue([]);
    mocked.createSessionPlan.mockResolvedValue({
      id: 2,
      campaign_id: 1,
      title: 'Session 1',
      summary: '',
      order: 0,
      content: {},
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    });

    render(<SessionPlansPanel campaignId={1} />);
    await waitFor(() => expect(screen.getByText(/No session plans yet/)).toBeInTheDocument());

    await userEvent.type(screen.getByPlaceholderText('Session title'), 'Session 1');
    await userEvent.type(screen.getByPlaceholderText(/Opening/), 'Smoke on the horizon.');
    await userEvent.type(screen.getByPlaceholderText('Hook'), 'Where was the Baron?');
    await userEvent.type(screen.getByPlaceholderText(/Reward/), 'A signet ring.');
    await userEvent.type(screen.getByPlaceholderText('Notes (optional)'), 'Sandbox, not scripted.');
    await userEvent.click(screen.getByRole('button', { name: 'Create session plan' }));

    await waitFor(() =>
      expect(mocked.createSessionPlan).toHaveBeenCalledWith(1, {
        title: 'Session 1',
        summary: '',
        order: 0,
        content: {
          hooks: ['Where was the Baron?'],
          beats: [],
          opening: 'Smoke on the horizon.',
          reward: 'A signet ring.',
          notes: 'Sandbox, not scripted.',
        },
      }),
    );
  });

  it('rejects invalid JSON in the countdowns field instead of submitting', async () => {
    mocked.listSessionPlans.mockResolvedValue([]);

    render(<SessionPlansPanel campaignId={1} />);
    await waitFor(() => expect(screen.getByText(/No session plans yet/)).toBeInTheDocument());

    await userEvent.type(screen.getByPlaceholderText('Session title'), 'Session 1');
    fireEvent.change(screen.getByPlaceholderText(/Countdowns/), {
      target: { value: '{not valid json' },
    });
    await userEvent.click(screen.getByRole('button', { name: 'Create session plan' }));

    await waitFor(() => expect(screen.getByText(/must be valid JSON/i)).toBeInTheDocument());
    expect(mocked.createSessionPlan).not.toHaveBeenCalled();
  });

  it('supports adding and removing hooks in the create form', async () => {
    mocked.listSessionPlans.mockResolvedValue([]);
    mocked.createSessionPlan.mockResolvedValue({
      id: 2,
      campaign_id: 1,
      title: 'Session 1',
      summary: '',
      order: 0,
      content: {},
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    });

    render(<SessionPlansPanel campaignId={1} />);
    await waitFor(() => expect(screen.getByText(/No session plans yet/)).toBeInTheDocument());

    await userEvent.type(screen.getByPlaceholderText('Session title'), 'Session 1');
    await userEvent.click(screen.getByRole('button', { name: 'Add hook' }));
    const hookInputs = screen.getAllByPlaceholderText('Hook');
    await userEvent.type(hookInputs[0], 'Where was the Baron?');
    await userEvent.type(hookInputs[1], 'Who burned the granary?');
    await userEvent.click(screen.getByRole('button', { name: 'Remove hook 1' }));
    await userEvent.click(screen.getByRole('button', { name: 'Create session plan' }));

    await waitFor(() =>
      expect(mocked.createSessionPlan).toHaveBeenCalledWith(1, {
        title: 'Session 1',
        summary: '',
        order: 0,
        content: {
          opening: '',
          hooks: ['Who burned the granary?'],
          beats: [],
          reward: '',
          notes: '',
        },
      }),
    );
  });

  it('supports adding and removing beats in the create form', async () => {
    mocked.listSessionPlans.mockResolvedValue([]);
    mocked.createSessionPlan.mockResolvedValue({
      id: 2,
      campaign_id: 1,
      title: 'Session 1',
      summary: '',
      order: 0,
      content: {},
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    });

    render(<SessionPlansPanel campaignId={1} />);
    await waitFor(() => expect(screen.getByText(/No session plans yet/)).toBeInTheDocument());

    await userEvent.type(screen.getByPlaceholderText('Session title'), 'Session 1');
    await userEvent.click(screen.getByRole('button', { name: 'Add beat' }));
    const nameInputs = screen.getAllByPlaceholderText('Beat name');
    const descriptionInputs = screen.getAllByPlaceholderText('Beat description (optional)');
    await userEvent.type(nameInputs[0], 'The Baron arrives');
    await userEvent.type(descriptionInputs[0], 'He is not who he claims.');
    await userEvent.type(nameInputs[1], 'The granary burns');
    await userEvent.click(screen.getByRole('button', { name: 'Remove beat 1' }));
    await userEvent.click(screen.getByRole('button', { name: 'Create session plan' }));

    await waitFor(() =>
      expect(mocked.createSessionPlan).toHaveBeenCalledWith(1, {
        title: 'Session 1',
        summary: '',
        order: 0,
        content: {
          opening: '',
          hooks: [],
          beats: [{ name: 'The granary burns' }],
          reward: '',
          notes: '',
        },
      }),
    );
  });

  it('preserves an existing beat npc_ids through an edit-and-save, unmodified by the UI', async () => {
    mocked.listSessionPlans.mockResolvedValue([
      {
        id: 2,
        campaign_id: 1,
        title: 'Session 1',
        summary: '',
        order: 0,
        content: {
          beats: [{ name: 'The Baron arrives', description: 'A twist.', npc_ids: [7, 12] }],
        },
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
    ]);
    mocked.updateSessionPlan.mockResolvedValue({
      id: 2,
      campaign_id: 1,
      title: 'Session 1',
      summary: '',
      order: 0,
      content: {},
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    });

    render(<SessionPlansPanel campaignId={1} />);
    await waitFor(() => expect(screen.getByText('Session 1')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: 'Edit' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(mocked.updateSessionPlan).toHaveBeenCalledWith(
        1,
        2,
        expect.objectContaining({
          content: expect.objectContaining({
            beats: [{ name: 'The Baron arrives', description: 'A twist.', npc_ids: [7, 12] }],
          }),
        }),
      ),
    );
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
      entity_type: 'continent',
      entity_id: 5,
      created_at: '2026-01-01T00:00:00Z',
    });

    render(<SessionPlansPanel campaignId={1} />);
    await waitFor(() => expect(screen.getByText('Session 1')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText('Hillford')).toBeInTheDocument());

    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Library entity' }), '5');
    await userEvent.click(screen.getByRole('button', { name: 'Attach' }));

    await waitFor(() =>
      expect(mocked.createLink).toHaveBeenCalledWith(1, 2, {
        entity_type: 'continent',
        entity_id: 5,
      }),
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
    // Region isn't listable directly off a world anymore — the panel walks
    // Continent -> Region to build the picker, so the mock has to honor that
    // same chain (continent 10 under world 1, region 5 under continent 10).
    mockedLibrary.listEntities.mockImplementation((segment, parentId) => {
      if (segment === 'continents' && parentId === 1) {
        return Promise.resolve([
          {
            id: 10,
            world_id: 1,
            name: 'Tharivor',
            summary: '',
            extra: '{}',
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-01-01T00:00:00Z',
          },
        ]);
      }
      if (segment === 'regions' && parentId === 10) {
        return Promise.resolve([
          {
            id: 5,
            continent_id: 10,
            name: 'Hillford',
            summary: '',
            extra: '{}',
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-01-01T00:00:00Z',
          },
        ]);
      }
      return Promise.resolve([]);
    });

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
