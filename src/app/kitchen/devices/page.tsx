"use client";

import useSWR from "swr";
import { AppHeader } from "@/components/AppHeader";
import { DevicesCard } from "@/components/kitchen/DevicesCard";
import { KitchenTabs } from "@/components/kitchen/KitchenTabs";
import type { Device } from "@/components/kitchen/types";
import { useT } from "@/i18n/client";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

// «Құрылғылар» қойындысы: қосылған термометр мен датчиктер, жаңа құрылғының кілті.
export default function KitchenDevicesPage() {
  const t = useT();
  const { data, mutate } = useSWR<{ devices?: Device[] }>("/api/kitchen/devices", fetcher, { refreshInterval: 10000 });

  return (
    <main className="min-h-screen pb-24">
      <AppHeader subtitle={`${t.kitchen.subtitle} · ${t.kitchen.tabs.devices}`} roleLabel={t.roles.kitchen} />
      <div className="mx-auto max-w-2xl space-y-4 p-4">
        <KitchenTabs />
        {data ? <DevicesCard devices={data.devices ?? []} onChange={() => mutate()} /> : <p className="p-6 text-center text-muted">{t.common.loading}</p>}
      </div>
    </main>
  );
}
