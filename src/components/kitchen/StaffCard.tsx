"use client";

import { hm } from "@/lib/format";
import { issueLabels } from "@/lib/photo/verdict";
import { useT } from "@/i18n/client";
import type { StaffMember } from "./types";

/** Смена алдындағы тексеру: әр қызметкердің бүгінгі нәтижесі және форманы тексеру батырмасы. */
export function StaffCard({ staff, busyId, onCheck }: { staff: StaffMember[]; busyId: string | null; onCheck: (member: StaffMember) => void }) {
  const t = useT();
  const s = t.staff;
  const cleared = staff.filter((m) => m.checks[0]?.aiStatus === "OK").length;

  return (
    <section className="card space-y-3 p-4" aria-labelledby="staff-title">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="staff-title" className="font-bold text-ink">
          {s.title}
        </h2>
        <span className={`text-sm font-semibold ${cleared === staff.length ? "text-ok-700" : "text-warn-700"}`}>
          {s.summary(cleared, staff.length)}
        </span>
      </div>
      <p className="text-xs text-muted">{s.hint}</p>
      <ul className="space-y-2">
        {staff.map((member) => {
          const check = member.checks[0];
          const status = !check
            ? { text: s.notChecked, cls: "text-muted" }
            : check.aiStatus === "OK"
              ? { text: s.admitted(hm(check.createdAt)), cls: "text-ok-700" }
              : check.aiStatus === "PENDING"
                ? { text: s.pending, cls: "text-primary" }
                : check.aiStatus === "FLAGGED"
                  ? { text: s.notAdmitted, cls: "text-bad-700" }
                  : check.aiStatus === "DISABLED"
                    ? { text: s.disabled, cls: "text-muted" }
                    : { text: s.error, cls: "text-warn-700" };
          return (
            <li key={member.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line px-3 py-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink">{member.label}</p>
                <p className={`text-xs font-medium ${status.cls}`} aria-live="polite">
                  {status.text}
                  {check?.aiStatus === "FLAGGED" && check.aiIssues.length > 0 && ` · ${issueLabels(check.aiIssues, t.photoIssues).join(", ")}`}
                </p>
              </div>
              <button
                type="button"
                className={`btn btn-sm shrink-0 ${check?.aiStatus === "OK" ? "btn-outline" : "btn-primary"}`}
                disabled={busyId === member.id || check?.aiStatus === "PENDING"}
                onClick={() => onCheck(member)}
              >
                {check ? s.recheck : s.check}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
