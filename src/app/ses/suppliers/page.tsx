"use client";

import useSWR from "swr";
import { AppHeader } from "@/components/AppHeader";
import { SuppliersCard } from "@/components/ses/SuppliersCard";
import { fetcher, type SupplierRow } from "@/components/ses/types";

export default function SuppliersPage() {
  const { data, mutate } = useSWR<{ suppliers: SupplierRow[] }>("/api/ses/suppliers", fetcher, { refreshInterval: 30000 });

  return (
    <div className="min-h-screen pb-12">
      <AppHeader subtitle="Жеткізушілер · Маңғыстау облысы" roleLabel="Инспектор · ДСЭК" sesNav live />
      <main className="max-w-[1440px] mx-auto px-4 lg:px-8 py-6">
        {data ? <SuppliersCard suppliers={data.suppliers} onChanged={() => mutate()} /> : <div className="card h-96 animate-pulse" />}
      </main>
    </div>
  );
}
