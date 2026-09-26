export function LogoMark({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <path
        d="M16 2.5 5 6.7v7.7c0 6.9 4.7 12.5 11 14.4 6.3-1.9 11-7.5 11-14.4V6.7L16 2.5Z"
        fill="none"
        stroke="#1463d8"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <path d="M10.5 15.5h11a5.5 5.5 0 0 1-11 0Z" fill="#1463d8" />
      <path d="M13.5 12.6c0-1 .9-1.4.9-2.4M16.5 12.6c0-1 .9-1.4.9-2.4" stroke="#2e8b57" strokeWidth="1.5" strokeLinecap="round" fill="none" />
    </svg>
  );
}

export function Logo({ subtitle }: { subtitle?: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <LogoMark />
      <div className="leading-tight">
        <p className="font-bold text-ink">Adal As</p>
        {subtitle && <p className="text-xs text-muted">{subtitle}</p>}
      </div>
    </div>
  );
}
