// Screen 6 — AI Suggestions. Each proposed action is a tappable icon row that
// opens its OWN detail. Evidence opens the agent's ReAct trace ("What the agent
// checked") as a bottom sheet; Modify opens a dummy modify screen. "Add to Plan"
// advances to Confirm (screen 7).
import { useState } from 'react';
import { FileText, Pencil, X, ChevronRight, AlertTriangle } from 'lucide-react';
import { useNav } from '../nav';
import { useData } from '../data';
import { HERO_ID } from '../fixtures';
import { BackBar, Card, OutlineButton, PatientHeader, PrimaryButton } from '../components/ui';
import { actionIcon } from '../components/actionIcons';
import { AgentTrace } from '../components/AgentTrace';

export default function AISuggestions() {
  const { back, go, params } = useNav();
  const { patient, suggestion } = useData();
  const id = (params.patientId as string) ?? HERO_ID;
  const [showTrace, setShowTrace] = useState(false);

  return (
    <div className="relative min-h-full pb-6">
      <BackBar onBack={back} />
      <PatientHeader hospitalNo={patient.hospitalNo} bed={patient.bed} initials={patient.initials} />

      <p className="px-5 pb-2 text-[15px] font-bold text-ink">Suggested Next Steps</p>
      <div className="px-4">
        <Card className="divide-y divide-line">
          {suggestion.proposedActions.map((a) => {
            const Icon = actionIcon(a);
            return (
              <button
                key={a.id}
                onClick={() => go('actiondetail', { actionId: a.id, patientId: id })}
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-tint">
                  <Icon className="h-5 w-5 text-brand" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-semibold text-ink">{a.title}</p>
                  {a.detail && <p className="text-[12px] text-ink2">{a.detail}</p>}
                </div>
                <ChevronRight className="h-4 w-4 text-neutral-300" />
              </button>
            );
          })}
        </Card>
      </div>

      {/* Evidence | Modify */}
      <div className="grid grid-cols-2 gap-3 px-4 pt-4">
        <OutlineButton onClick={() => setShowTrace(true)}>
          <FileText className="h-4 w-4" /> Evidence
        </OutlineButton>
        <OutlineButton onClick={() => go('modify', { patientId: id })}>
          <Pencil className="h-4 w-4" /> Modify
        </OutlineButton>
      </div>

      {/* Add to Plan */}
      <div className="px-4 pt-3">
        <PrimaryButton onClick={() => go('confirm', { patientId: id })}>Add to Plan</PrimaryButton>
      </div>

      <p className="px-6 pt-4 text-center text-[12px] leading-snug text-ink2">
        Suggestions are based on trust guidelines and clinical context.
      </p>

      {showTrace && <TraceSheet onClose={() => setShowTrace(false)} />}
    </div>
  );
}

function TraceSheet({ onClose }: { onClose: () => void }) {
  const { suggestion } = useData();
  return (
    <div className="absolute inset-0 z-40 flex flex-col justify-end">
      <div className="absolute inset-0 animate-fade-in bg-black/30" onClick={onClose} />
      <div className="animate-sheet-up relative max-h-[85%] overflow-y-auto rounded-t-3xl bg-white p-5 pb-8 shadow-2xl no-scrollbar">
        <div className="mx-auto mb-4 h-1 w-9 rounded-full bg-neutral-300" />
        <div className="mb-3 flex items-start justify-between">
          <p className="text-[16px] font-bold text-ink">Evidence</p>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        {suggestion.anomaly?.detected && (
          <div className="mb-4 flex gap-2 rounded-xl bg-pink px-3 py-2.5">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-critical" />
            <p className="text-[12px] leading-snug text-ink">{suggestion.anomaly.description}</p>
          </div>
        )}

        {suggestion.trace && <AgentTrace trace={suggestion.trace} />}

        <p className="mt-4 text-center text-[11px] text-ink2">
          Clinician-confirmed · decision support · synthetic
        </p>
      </div>
    </div>
  );
}
