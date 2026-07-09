import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import Badge from '../components/ui/Badge';
import Skeleton from '../components/ui/Skeleton';
import ToggleSwitch from '../components/ui/ToggleSwitch';

describe('ToggleSwitch', () => {
  it('renders an accessible checkbox and reflects checked state', () => {
    render(<ToggleSwitch checked readOnly aria-label="Realtime" />);
    const checkbox = screen.getByRole('checkbox', { name: 'Realtime' });
    expect(checkbox).toBeChecked();
  });

  it('calls onChange when toggled', async () => {
    const onChange = vi.fn();
    render(<ToggleSwitch checked={false} onChange={onChange} aria-label="Chat" />);
    await userEvent.click(screen.getByRole('checkbox', { name: 'Chat' }));
    expect(onChange).toHaveBeenCalled();
  });

  it('toggles when clicking the visible track, not just the hidden input directly', async () => {
    // The real <input> is visually hidden (sr-only); clicks land on the
    // decorative track/thumb spans. Only a <label> wrapper forwards those
    // clicks to the input natively — regression test for that wiring.
    const onChange = vi.fn();
    const { container } = render(
      <ToggleSwitch checked={false} onChange={onChange} aria-label="Realtime" />,
    );
    const track = container.querySelector('span[aria-hidden]') as HTMLElement;
    await userEvent.click(track);
    expect(onChange).toHaveBeenCalled();
  });
});

describe('Skeleton', () => {
  it('renders a pulsing placeholder hidden from the accessibility tree', () => {
    const { container } = render(<Skeleton className="h-4 w-full" />);
    const el = container.firstChild as HTMLElement;
    expect(el).toHaveAttribute('aria-hidden', 'true');
    expect(el.className).toContain('animate-pulse');
  });
});

describe('Badge', () => {
  it('renders its children', () => {
    render(<Badge variant="success">Session active</Badge>);
    expect(screen.getByText('Session active')).toBeInTheDocument();
  });

  it('defaults to the neutral variant', () => {
    render(<Badge>No active session</Badge>);
    expect(screen.getByText('No active session').className).toContain('text-parchment/70');
  });
});
