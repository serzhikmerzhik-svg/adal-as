"use client";

import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();
  return (
    <button
      onClick={async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        router.push("/login");
        router.refresh();
      }}
      className="border border-ink px-4 py-1.5 text-sm text-ink hover:bg-ink hover:text-white transition-colors"
    >
      Шығу
    </button>
  );
}
