export function LogoMark({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <path d="M16 2 4 6.5v8.2c0 7.3 5.1 13.3 12 15.3 6.9-2 12-8 12-15.3V6.5L16 2Z" fill="#1d9d74" />
      <path d="M9.5 15.5h13a6.5 6.5 0 0 1-13 0Z" fill="#ffffff" />
      <path
        d="M13 12.5c0-1.2 1-1.6 1-2.8M16 12.5c0-1.2 1-1.6 1-2.8M19 12.5c0-1.2 1-1.6 1-2.8"
        stroke="#c8ecdf"
        strokeWidth="1.4"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

export function Logo({ subtitle }: { subtitle?: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <LogoMark />
      <div className="leading-tight">
        <p className="font-bold text-ink">Адал Ас</p>
        {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
      </div>
    </div>
  );
}
