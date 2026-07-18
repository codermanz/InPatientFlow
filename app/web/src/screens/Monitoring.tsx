// Screen 8 — Monitoring. Timeline (status dot + label + time + right note) from
// GET /patients/:id/timeline, an "Actions Taken" card, and — once the closed
// loop completes — the agent's re-assessment after the repeat troponin.
import { Check } from 'lucide-react';
import { useNav } from '../nav';
import { useData } from '../data';
import { BackBar, Card, PatientHeader } from '../components/ui';
import { Timeline } from '../components/Timeline';

export default function Monitoring() {
  const { back } = useNav();
  const { patient, timeline, actionsTaken, reassessment } = useData();

  return (
    <div className="min-h-full pb-8">
      <BackBar onBack={back} />
      <PatientHeader hospitalNo={patient.hospitalNo} bed={patient.bed} initials={patient.initials} />

      <p className="px-5 pb-3 text-[15px] font-bold text-ink">Timeline</p>
      <div className="px-5">
        <Timeline events={timeline} />
      </div>

      {/* Actions Taken */}
      {actionsTaken.length > 0 && (
        <div className="px-4 pt-2">
          <Card className="bg-brand-tint px-4 py-4">
            <p className="pb-2 text-[15px] font-bold text-ink">Actions Taken</p>
            <ul className="space-y-2">
              {actionsTaken.map((a, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-dot-green" strokeWidth={3} />
                  <span className="text-[14px] text-ink">{a}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}

      {/* Closed-loop agent re-assessment */}
      {reassessment && (
        <div className="px-4 pt-3">
          <Card className="px-4 py-4">
            <p className="text-[13px] font-semibold uppercase tracking-wide text-logo">
              Agent re-assessment
            </p>
            <p className="mt-1 text-[15px] font-semibold leading-snug text-ink">
              {reassessment.headline}
            </p>
            <p className="mt-1 text-[13px] leading-relaxed text-ink2">{reassessment.summary}</p>
          </Card>
        </div>
      )}

      <p className="px-5 pt-4 text-center text-[11px] text-ink2">
        Clinician-confirmed · decision support · synthetic
      </p>
    </div>
  );
}
