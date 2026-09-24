import Link from "next/link";
import { Logo } from "./Logo";
import { LogoutButton } from "./LogoutButton";

export function AppHeader({ subtitle, backHref }: { subtitle: string; backHref?: string }) {
  return (
    <header className="sticky top-0 z-50 bg-white">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {backHref && (
            <Link href={backHref} className="text-slate-400 hover:text-ink text-xl leading-none" aria-label="Артқа">
              ←
            </Link>
          )}
          <Logo subtitle={subtitle} />
        </div>
        <LogoutButton />
      </div>
    </header>
  );
}
