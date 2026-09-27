import Link from "next/link";
import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";
import { qrPayload } from "@/lib/capture";
import { shortName } from "@/lib/format";
import { AppHeader } from "@/components/AppHeader";
import { PrintButton } from "@/components/PrintButton";
import { getLocale, getT } from "@/i18n/server";

// Тағам беру сөресіне қойылатын QR-тұғыр: порция фотосы тек осы код кадрда тұрғанда түсіріледі.
export default async function KitchenQrPage() {
  const session = await getSession();
  if (!session?.schoolId) redirect("/login");
  const [t, locale, school] = await Promise.all([
    getT(),
    getLocale(),
    prisma.school.findUniqueOrThrow({ where: { id: session.schoolId }, select: { code: true, name: true, kind: true } }),
  ]);
  const code = school.code ?? school.name;
  // Кітапхана тек өз кодымыздан SVG жасайды, сондықтан оны тікелей енгізу қауіпсіз.
  const svg = await QRCode.toString(qrPayload(code), { type: "svg", margin: 1, errorCorrectionLevel: "M" });

  return (
    <main className="min-h-screen pb-16 print:pb-0">
      <div className="print:hidden">
        <AppHeader subtitle={`${t.kitchen.subtitle} · ${t.capture.qrTitle}`} roleLabel={t.roles.kitchen} />
      </div>
      <div className="mx-auto max-w-md space-y-4 p-4">
        <Link href="/kitchen" className="inline-block text-sm text-ink-2 hover:text-ink print:hidden">
          ← {t.common.back}
        </Link>
        <section className="rounded-2xl bg-white p-6 text-center text-black shadow-lg print:shadow-none">
          <p className="text-sm font-semibold uppercase tracking-widest text-neutral-500">Adal As · {t.capture.qrTitle}</p>
          <p className="mt-1 text-5xl font-extrabold tracking-tight">{code}</p>
          <p className="mt-1 text-sm text-neutral-600">{shortName(school.name, school.kind, locale)}</p>
          <div className="mx-auto mt-5 aspect-square w-full max-w-72 [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />
          <p className="mt-5 text-sm text-neutral-700">{t.capture.qrText}</p>
        </section>
        <PrintButton label={t.capture.qrPrint} />
      </div>
    </main>
  );
}
