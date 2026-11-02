import type { ServiceIcon } from "@shared/defaults";

const PATHS: Record<ServiceIcon | "check", string> = {
  plane:
    '<path d="M10.5 3.6c0-.8.7-1.6 1.5-1.6s1.5.8 1.5 1.6V9l7.5 4.6V16l-7.5-2.3v4.5l2.3 1.7V22L12 21l-3.8 1v-2.1l2.3-1.7v-4.5L3 16v-2.4L10.5 9z"/>',
  bag: '<path d="M5 8h14l-1.1 12.4a1.7 1.7 0 0 1-1.7 1.6H7.8a1.7 1.7 0 0 1-1.7-1.6z"/><path d="M9 10V6.8a3 3 0 0 1 6 0V10"/>',
  glass: '<path d="M4.5 4h15L12 12.5z"/><path d="M12 12.5V20M8 20.5h8M7.5 7.5h9"/>',
  road: '<path d="M4 21L10 3M20 21L14 3M12 5v2M12 10.5v2.5M12 16.5v4"/>',
  star: '<path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6-4.5-4.2 6.1-.7z"/>',
  check: '<circle cx="12" cy="12" r="9.2"/><path d="M8 12.3l2.7 2.7L16.2 9.5"/>',
};

export function Glyph({ name }: { name: ServiceIcon | "check" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" dangerouslySetInnerHTML={{ __html: PATHS[name] }} />
  );
}

export function Wheel({ label = "Steering wheel and road emblem" }: { label?: string }) {
  return (
    <svg className="logo" viewBox="0 0 120 120" role="img" aria-label={label}>
      <defs>
        <linearGradient id="lg-gold" gradientUnits="userSpaceOnUse" x1="14" y1="8" x2="106" y2="114">
          <stop offset="0" stopColor="var(--gold-2)" className="s-hi" />
          <stop offset=".45" stopColor="var(--gold)" className="s-mid" />
          <stop offset=".75" stopColor="var(--gold-lo)" className="s-lo" />
          <stop offset="1" stopColor="var(--gold-2)" className="s-hi" />
        </linearGradient>
      </defs>
      <circle cx="60" cy="60" r="50" fill="none" stroke="url(#lg-gold)" strokeWidth="6" />
      <circle cx="60" cy="60" r="41.5" fill="none" stroke="url(#lg-gold)" strokeWidth="1.25" opacity=".55" />
      <path d="M10.5 58c13-4 26-4.5 39.5-1.5M109.5 58c-13-4-26-4.5-39.5-1.5" fill="none" stroke="url(#lg-gold)" strokeWidth="6" strokeLinecap="round" />
      <circle cx="60" cy="60" r="10" fill="none" stroke="url(#lg-gold)" strokeWidth="4" />
      <circle cx="60" cy="60" r="3.2" fill="url(#lg-gold)" />
      <path d="M56 70.5L45.5 108M64 70.5L74.5 108" fill="none" stroke="url(#lg-gold)" strokeWidth="3.2" strokeLinecap="round" />
      <line className="logo-dash" x1="60" y1="76" x2="60" y2="105" stroke="url(#lg-gold)" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

export function Arrow() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}
