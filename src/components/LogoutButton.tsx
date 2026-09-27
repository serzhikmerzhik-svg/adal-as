"use client";

import { useRouter } from "next/navigation";
import { useT } from "@/i18n/client";

export function LogoutButton() {
  const router = useRouter();
  const t = useT();
  return (
    <button
      onClick={async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        router.push("/login");
        router.refresh();
      }}
      className="btn btn-outline"
    >
      {t.common.logout}
    </button>
  );
}
