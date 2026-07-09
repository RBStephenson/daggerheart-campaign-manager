interface SkeletonProps {
  className?: string;
}

/** A single pulsing placeholder block. Compose several for a skeleton row/card. */
export default function Skeleton({ className = '' }: SkeletonProps) {
  return <div aria-hidden className={`animate-pulse rounded-md bg-white/10 ${className}`} />;
}
