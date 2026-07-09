import type { ReactNode } from 'react';

type BadgeVariant = 'neutral' | 'success' | 'violet' | 'danger';

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  neutral: 'bg-white/10 text-parchment/70',
  success: 'bg-emerald-400/15 text-emerald-300',
  violet: 'bg-arcane/15 text-arcane',
  danger: 'bg-danger-bg/10 text-danger-text',
};

interface BadgeProps {
  variant?: BadgeVariant;
  children: ReactNode;
}

export default function Badge({ variant = 'neutral', children }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${VARIANT_CLASSES[variant]}`}
    >
      {children}
    </span>
  );
}
