type P = { className?: string };

const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.4,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function BellIcon({ className }: P) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M5 17h14l-1.4-2.2V11a5.6 5.6 0 0 0-11.2 0v3.8L5 17Z" />
      <path d="M10.4 20h3.2" />
      <path d="M12 5.4V4" />
    </svg>
  );
}

export function ClockIcon({ className }: P) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4.4l3 1.8" />
    </svg>
  );
}

export function StarIcon({ className }: P) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M12 4.5l2.3 4.8 5.2.7-3.8 3.6.9 5.1-4.6-2.5-4.6 2.5.9-5.1L4.5 10l5.2-.7L12 4.5Z" />
    </svg>
  );
}

export function CopyIcon({ className }: P) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <rect x="9" y="9" width="10" height="10" rx="1.6" />
      <path d="M15 6.5A1.5 1.5 0 0 0 13.5 5H6.5A1.5 1.5 0 0 0 5 6.5v7A1.5 1.5 0 0 0 6.5 15" />
    </svg>
  );
}

export function LedgerIcon({ className }: P) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <rect x="6" y="4" width="12" height="16" rx="1.6" />
      <path d="M9 9h6M9 12.5h6M9 16h3.5" />
    </svg>
  );
}

export function MarketIcon({ className }: P) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M6 19V13M11 19V6M16 19v-8M21 19H4" />
    </svg>
  );
}

export function ArrowUpIcon({ className }: P) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M12 19V6M7 11l5-5 5 5" />
    </svg>
  );
}

export function ArrowDownIcon({ className }: P) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M12 5v13M17 13l-5 5-5-5" />
    </svg>
  );
}

export function ArrowRightIcon({ className }: P) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M5 12h13M13 7l5 5-5 5" />
    </svg>
  );
}

export function KeyIcon({ className }: P) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <rect x="4.5" y="6" width="9" height="12" rx="2" />
      <circle cx="17.5" cy="8" r="2.2" />
    </svg>
  );
}

export function CrownIcon({ className }: P) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M4 17h16l-1.2-8-4 3.2L12 6l-2.8 6.2-4-3.2L4 17Z" />
    </svg>
  );
}

export function DoorIcon({ className }: P) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M7 20V5.5A1.5 1.5 0 0 1 8.5 4h7A1.5 1.5 0 0 1 17 5.5V20" />
      <path d="M5 20h14M13.6 12h.01" />
    </svg>
  );
}
