// Modify Plan — dummy modify screen reached from screen 6's "Modify". Lets the
// clinician toggle which suggested actions stay in the plan, then go Back.
import { useState } from 'react';
import { Check } from 'lucide-react';
import { clsx } from 'clsx';
import { useNav } from '../nav';
import { useData } from '../data';
import { BackBar, Card, PrimaryButton } from '../components/ui';

export default function ModifyPlan() {
  const { back } = useNav();
  const { suggestion } = useData();
  const [selected, setSelected] = useState<Record<string, boolean>>(
    Object.fromEntries(suggestion.proposedActions.map((a) => [a.id, a.selectedByDefault])),
  );

  const toggle = (id: string) => setSelected((s) => ({ ...s, [id]: !s[id] }));

  return (
    <div className="min-h-full pb-6">
      <BackBar onBack={back} />
      <p className="px-5 pb-2 pt-1 text-[22px] font-extrabold text-ink">Modify Plan</p>
      <p className="px-5 pb-3 text-[13px] text-ink2">Choose which suggested actions to keep.</p>

      <div className="px-4">
        <Card className="divide-y divide-line">
          {suggestion.proposedActions.map((a) => {
            const on = selected[a.id];
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
                <span className="flex-1 text-[15px] font-semibold text-ink">{a.title}</span>
              </button>
            );
          })}
        </Card>
      </div>

      <div className="px-4 pt-5">
        <PrimaryButton onClick={back}>Save changes</PrimaryButton>
      </div>
    </div>
  );
}
