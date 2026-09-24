import { LEVEL_LABEL } from "@/lib/risk/labels";

const PILL: Record<string, string> = {
  RED: "bg-bad-600 text-white",
  YELLOW: "bg-warn-100 text-warn-700",
  GREEN: "bg-ok-100 text-ok-700",
};

export function LevelPill({ level }: { level: string }) {
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${PILL[level] ?? ""}`}>
      {LEVEL_LABEL[level] ?? level}
    </span>
  );
}

const DOT: Record<string, string> = {
  RED: "bg-bad-600",
  YELLOW: "bg-warn-500",
  GREEN: "bg-ok-600",
};

export function LevelDot({ level, className = "" }: { level: string; className?: string }) {
  return <i className={`inline-block w-2.5 h-2.5 rounded-full ${DOT[level] ?? "bg-slate-400"} ${className}`} />;
}

export function CardTitle({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
      <h2 className="text-[17px] font-semibold text-ink">{children}</h2>
      {aside && <div className="text-xs text-muted">{aside}</div>}
    </div>
  );
}
