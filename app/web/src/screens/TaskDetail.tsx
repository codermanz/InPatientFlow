// Task Detail — only reached for a CHASED task (a request that was followed up),
// so it shows the task's OUTPUT. A plain "Requested" task is not actionable and
// isn't drilled into. Tasks are extracted investigation requests — not workflows.
import { useNav } from '../nav';
import { usePatientDetail } from '../data';
import { HERO_ID, chasedOutput } from '../fixtures';
import { BackBar, Card } from '../components/ui';

export default function TaskDetail() {
  const { params, back } = useNav();
  const id = (params.patientId as string) ?? HERO_ID;
  const taskId = params.taskId as string;
  const { tasks } = usePatientDetail(id);
  const task = tasks.find((t) => t.id === taskId) ?? tasks[0];

  if (!task) {
    return (
      <div className="min-h-full">
        <BackBar onBack={back} />
        <p className="px-5 pt-4 text-[14px] text-ink2">Task not found.</p>
      </div>
    );
  }

  const chased = task.status === 'chased';

  return (
    <div className="min-h-full pb-6">
      <BackBar onBack={back} />
      <div className="px-5 pb-2">
        <p className="text-[13px] font-semibold uppercase tracking-wide text-ink2">Investigation</p>
        <h1 className="mt-1 text-[24px] font-extrabold leading-tight text-ink">{task.title}</h1>
        <span
          className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-[12px] font-semibold ${
            chased ? 'bg-chased text-dot-green' : 'bg-neutral-100 text-ink2'
          }`}
        >
          {chased ? 'Chased' : 'Requested'}
        </span>
      </div>

      <div className="space-y-2.5 px-4 pt-2">
        {task.reason && (
          <Card className="px-4 py-3">
            <p className="text-[13px] text-ink2">Reason</p>
            <p className="mt-0.5 text-[15px] font-semibold text-ink">{task.reason}</p>
          </Card>
        )}

        {chased ? (
          <Card className="px-4 py-3.5">
            <p className="text-[13px] text-ink2">Output</p>
            <p className="mt-1 text-[15px] leading-relaxed text-ink">{chasedOutput(task.title)}</p>
          </Card>
        ) : (
          <Card className="px-4 py-3.5">
            <p className="text-[14px] leading-relaxed text-ink2">
              Requested and awaiting result. No output yet — you'll be notified when it returns.
            </p>
          </Card>
        )}
      </div>

      <p className="px-5 pt-4 text-center text-[11px] text-ink2">
        Clinician-confirmed · decision support · synthetic
      </p>
    </div>
  );
}
