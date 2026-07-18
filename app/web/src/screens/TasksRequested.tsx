// Screen 3 — Tasks. WardFlow formulated these by matching the patient's
// presentation to the workflow catalog; each task maps to a workflow. The
// clinician SELECTS which to execute, then Confirm & Execute kicks off those
// workflows and we start waiting (→ lock screen → notification).
import { useState } from 'react';
import { Check, Clock } from 'lucide-react';
import { clsx } from 'clsx';
import { useNav } from '../nav';
import { useData, usePatientDetail } from '../data';
import { HERO_ID } from '../fixtures';
import { BackBar, Card, PatientHeader, PrimaryButton } from '../components/ui';
import type { Task } from '../types';

export default function TasksRequested() {
  const { params, go, back } = useNav();
  const id = (params.patientId as string) ?? HERO_ID;
  const { patient, tasks } = usePatientDetail(id);
  const { triggerWorkflow } = useData();

  // Default: every formulated task selected.
  const [selected, setSelected] = useState<Set<string>>(() => new Set(tasks.map((t) => t.id)));
  const [busy, setBusy] = useState(false);

  // Keep selection in sync if tasks arrive after first render.
  const known = tasks.map((t) => t.id).join(',');
  const [seen, setSeen] = useState(known);
  if (known !== seen) {
    setSeen(known);
    setSelected(new Set(tasks.map((t) => t.id)));
  }

  const toggle = (tid: string) =>
    setSelected((s) => {
      const n = new Set(s);
      n.has(tid) ? n.delete(tid) : n.add(tid);
      return n;
    });

  const count = selected.size;

  const execute = async () => {
    setBusy(true);
    try {
      const chosen = tasks.filter((t) => selected.has(t.id) && t.workflowId);
      await Promise.all(chosen.map((t) => triggerWorkflow(t.workflowId!, t.id, id).catch(() => null)));
    } finally {
      setBusy(false);
      go('alert'); // start waiting → lock screen → notification
    }
  };

  return (
    <div className="min-h-full pb-6">
      <BackBar onBack={back} />
      <PatientHeader hospitalNo={patient.hospitalNo} bed={patient.bed} initials={patient.initials} />

      <div className="px-5 pb-1">
        <p className="text-[15px] font-bold text-ink">Tasks</p>
        <p className="text-[12px] text-ink2">
          Formulated by WardFlow from this presentation. Select which to execute.
        </p>
      </div>

      <div className="space-y-2.5 px-4 pt-1">
        {tasks.map((t) => (
          <TaskRow key={t.id} task={t} checked={selected.has(t.id)} onToggle={() => toggle(t.id)} />
        ))}
      </div>

      {/* Next update */}
      <div className="px-4 pt-4">
        <Card className="flex items-center gap-3 bg-chased px-4 py-3.5">
          <Clock className="h-5 w-5 text-brand" />
          <div>
            <p className="text-[13px] text-ink2">Next update</p>
            <p className="text-[15px] font-semibold text-ink">~10 min</p>
          </div>
        </Card>
      </div>

      {/* Confirm & Execute the selected workflows → start waiting */}
      <div className="px-4 pt-5">
        <PrimaryButton onClick={execute} disabled={busy || count === 0}>
          {busy ? 'Starting…' : `Confirm & Execute (${count})`}
        </PrimaryButton>
        <p className="px-1 pt-2 text-center text-[12px] text-ink2">
          WardFlow runs the selected workflows and alerts you only if a result needs attention.
        </p>
      </div>
    </div>
  );
}

function TaskRow({
  task,
  checked,
  onToggle,
}: {
  task: Task;
  checked: boolean;
  onToggle: () => void;
}) {
  const chased = task.status === 'chased';
  return (
    <Card
      onClick={onToggle}
      className={clsx('flex items-center gap-3 px-3.5 py-3', chased && 'border-transparent bg-chased')}
    >
      <span
        className={clsx(
          'flex h-6 w-6 shrink-0 items-center justify-center rounded-md border',
          checked ? 'border-brand bg-brand' : 'border-neutral-300 bg-white',
        )}
      >
        {checked && <Check className="h-4 w-4 text-white" strokeWidth={3} />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-semibold text-ink">{task.title}</p>
        {task.workflowLabel && (
          <p className="text-[12px] text-brand">↳ {task.workflowLabel}</p>
        )}
        {task.reason && <p className="text-[12px] text-ink2">Reason: {task.reason}</p>}
      </div>
      <span
        className={clsx(
          'shrink-0 text-[13px] font-semibold',
          chased ? 'text-dot-green' : 'text-ink2',
        )}
      >
        {chased ? 'Chased' : 'Requested'}
      </span>
    </Card>
  );
}
