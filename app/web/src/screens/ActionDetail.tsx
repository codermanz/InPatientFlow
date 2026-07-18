// Action Detail — each suggested action (screen 6) opens its OWN detail: title,
// detail, the workflow the agent discovered for it, and the trace-as-evidence.
import { useNav } from '../nav';
import { useData } from '../data';
import { workflows as WORKFLOWS } from '../fixtures';
import { BackBar, Card } from '../components/ui';
import { actionIcon } from '../components/actionIcons';
import { AgentTrace } from '../components/AgentTrace';

export default function ActionDetail() {
  const { back, params } = useNav();
  const { suggestion } = useData();
  const actionId = params.actionId as string;
  const action =
    suggestion.proposedActions.find((a) => a.id === actionId) ?? suggestion.proposedActions[0];

  if (!action) {
    return (
      <div className="min-h-full">
        <BackBar onBack={back} />
        <p className="px-5 pt-4 text-[14px] text-ink2">Action not found.</p>
      </div>
    );
  }

  const Icon = actionIcon(action);
  const wf = WORKFLOWS.find((w) => w.id === action.workflowId);

  return (
    <div className="min-h-full pb-6">
      <BackBar onBack={back} />

      <div className="flex items-start gap-3 px-5 pb-3 pt-1">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-tint">
          <Icon className="h-6 w-6 text-brand" />
        </span>
        <div>
          <h1 className="text-[22px] font-extrabold leading-tight text-ink">{action.title}</h1>
          {action.detail && <p className="text-[13px] text-ink2">{action.detail}</p>}
        </div>
      </div>

      <div className="space-y-2.5 px-4">
        {/* Workflow */}
        <Card className="px-4 py-3.5">
          <p className="text-[13px] text-ink2">Workflow</p>
          <p className="mt-0.5 text-[15px] font-semibold text-ink">
            {wf?.name ?? action.workflowLabel ?? '—'}
          </p>
          {wf?.description && (
            <p className="mt-1 text-[13px] leading-snug text-ink2">{wf.description}</p>
          )}
          {action.workflowId === 'medication-administer' && (
            <p className="mt-2 rounded-lg bg-pink px-3 py-2 text-[12px] font-medium text-critical">
              Clinician-gated — no drug or dose is given until you confirm.
            </p>
          )}
        </Card>

        {/* Trace as evidence */}
        {suggestion.trace && (
          <Card className="px-4 py-3.5">
            <AgentTrace trace={suggestion.trace} />
          </Card>
        )}
      </div>

      <p className="px-5 pt-4 text-center text-[11px] text-ink2">
        Clinician-confirmed · decision support · synthetic
      </p>
    </div>
  );
}
