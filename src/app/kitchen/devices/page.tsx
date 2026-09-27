"use client";

import useSWR from "swr";
import { AppHeader } from "@/components/AppHeader";
import { DevicesCard } from "@/components/kitchen/DevicesCard";
import { KitchenTabs } from "@/components/kitchen/KitchenTabs";
import type { Device } from "@/components/kitchen/types";
import { useT } from "@/i18n/client";

const GUIDE_URL = "https://github.com/serzhikmerzhik-svg/adal-as/tree/master/hardware";
const fetcher = (url: string) => fetch(url).then((r) => r.json());

// «Құрылғылар» қойындысы: қосылған термометр мен датчиктер, жаңа кілт және құрылғыны жинау нұсқаулығы.
export default function KitchenDevicesPage() {
  const t = useT();
  const d = t.devices;
  const { data, mutate } = useSWR<{ devices?: Device[] }>("/api/kitchen/devices", fetcher, { refreshInterval: 10000 });

  return (
    <main className="min-h-screen pb-24">
      <AppHeader subtitle={`${t.kitchen.subtitle} · ${t.kitchen.tabs.devices}`} roleLabel={t.roles.kitchen} />
      <div className="mx-auto max-w-2xl space-y-4 p-4">
        <KitchenTabs />

        {data ? <DevicesCard devices={data.devices ?? []} onChange={() => mutate()} /> : <p className="p-6 text-center text-muted">{t.common.loading}</p>}

        <section className="card space-y-3 p-4" aria-labelledby="guide-title">
          <h2 id="guide-title" className="font-bold text-ink">
            {d.guideTitle}
          </h2>
          <p className="text-sm text-ink-2">{d.guideParts}</p>
          <ol className="space-y-2">
            {d.guideSteps.map((step, i) => (
              <li key={step} className="flex gap-3 text-sm text-ink">
                <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary">
                  {i + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
          <a href={GUIDE_URL} target="_blank" rel="noreferrer" className="btn btn-outline w-full">
            {d.guideFull}
          </a>
        </section>
      </div>
    </main>
  );
}
