// Screen 7 — Confirm Next Steps. Checklist of the suggested actions.
// "Confirm & Execute" triggers each selected action's workflow (POST
// /workflows/run), fires the closed-loop reassess-recheck, then routes to
// Monitoring (screen 8).
import { useState } from 'react';
import { Check } from 'lucide-react';
import { clsx } from 'clsx';
import { useNav } from '../nav';
import { useData } from '../data';
import { HERO_ID } from '../fixtures';
import { BackBar, Card, PatientHeader, PrimaryButton } from '../components/ui';

export default function ConfirmNextSteps() {
  const { back, go, params } = useNav();
  const { patient, suggestion, triggerWorkflow, completeWorkflow } = useData();
  const id = (params.patientId as string) ?? HERO_ID;
  const [checked, setChecked] = useState<Record<string, boolean>>(
    Object.fromEntries(suggestion.proposedActions.map((a) => [a.id, a.selectedByDefault])),
  );
  const [busy, setBusy] = useState(false);

  const toggle = (aid: string) => setChecked((s) => ({ ...s, [aid]: !s[aid] }));

  const execute = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const selected = suggestion.proposedActions.filter((a) => checked[a.id] && a.workflowId);
      await Promise.all(
        selected.map((a) => triggerWorkflow(a.workflowId!, a.id, id)),
      );
      // Closed loop — repeat troponin / reassessment.
      const reassessRun = await triggerWorkflow('reassess-recheck', undefined, id);
      await completeWorkflow(reassessRun.runId);
    } catch {
      /* fixtures cover offline */
    }
    go('monitoring', { patientId: id });
  };

  return (
    <div className="min-h-full pb-6">
      <BackBar onBack={back} />
      <PatientHeader hospitalNo={patient.hospitalNo} bed={patient.bed} initials={patient.initials} />

      <p className="px-5 pb-2 text-[15px] font-bold text-ink">Confirm Actions</p>
      <div className="px-4">
        <Card className="divide-y divide-line">
          {suggestion.proposedActions.map((a) => {
            const on = checked[a.id];
            return (
              <button
                key={a.id}
                onClick={() => toggle(a.id)}
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
              >
                <span
                  className={clsx(
                    'flex h-6 w-6 shrink-0 items-center justify-center rounded-md border',
                    on ? 'border-brand bg-brand' : 'border-neutral-300 bg-white',
                  )}
                >
                  {on && <Check className="h-4 w-4 text-white" strokeWidth={3} />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-semibold text-ink">{a.title}</p>
                  {a.detail && <p className="text-[12px] text-ink2">{a.detail}</p>}
                </div>
              </button>
            );
          })}
        </Card>
      </div>

      <div className="px-4 pt-5">
        <PrimaryButton onClick={execute} disabled={busy}>
          {busy ? 'Executing…' : 'Confirm & Execute'}
        </PrimaryButton>
      </div>

      <p className="px-5 pt-4 text-center text-[11px] text-ink2">
        Clinician-confirmed · decision support · synthetic
      </p>
    </div>
  );
}
