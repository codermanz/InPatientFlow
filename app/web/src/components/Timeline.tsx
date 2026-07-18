// Vertical timeline (screen 8) — left status dot [red / pending-hollow / green]
// + label + time, with the right-aligned note (value / status) from
// TimelineEvent.note. Makes the closed loop visible: initial result → repeat
// (pending) → completed steps → agent re-assessment.
import { clsx } from 'clsx';
import { AlertCircle, Check } from 'lucide-react';
import type { TimelineEvent } from '../types';

type Tone = 'critical' | 'pending' | 'done' | 'neutral';

function toneFor(e: TimelineEvent): Tone {
  const n = (e.note ?? '').toLowerCase();
  if (n.includes('ng/l') || (e.type === 'result' && n && n !== 'pending')) return 'critical';
  if (n === 'pending') return 'pending';
  if (n === 'completed') return 'done';
  return 'neutral';
}

function fmt(ts: string) {
  const m = ts.match(/T(\d{2}:\d{2})/);
  return m ? m[1] : ts;
}

const NOTE_CLS: Record<Tone, string> = {
  critical: 'text-critical font-bold',
  pending: 'text-ink2 font-semibold',
  done: 'text-dot-green font-semibold',
  neutral: 'text-ink2 font-semibold',
};

export function Timeline({ events }: { events: TimelineEvent[] }) {
  return (
    <ol className="relative">
      {events.map((e, i) => {
        const tone = toneFor(e);
        return (
          <li key={e.id} className="flex gap-3">
            {/* rail + dot */}
            <div className="relative flex flex-col items-center">
              <Dot tone={tone} />
              {i < events.length - 1 && <span className="w-px flex-1 bg-neutral-200" />}
            </div>
            {/* label + note */}
            <div className="flex flex-1 items-start justify-between gap-2 pb-5">
              <div>
                <p className="text-[14px] font-semibold leading-tight text-ink">{e.label}</p>
                <p className="mt-0.5 text-[12px] tabular-nums text-ink2">{fmt(e.ts)}</p>
              </div>
              {e.note && (
                <span className={clsx('shrink-0 pt-0.5 text-[13px]', NOTE_CLS[tone])}>
                  {e.note}
                </span>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function Dot({ tone }: { tone: Tone }) {
  if (tone === 'pending') {
    return <span className="mt-0.5 h-5 w-5 rounded-full border-2 border-neutral-300 bg-white" />;
  }
  if (tone === 'critical') {
    return (
      <span className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-dot-red">
        <AlertCircle className="h-3.5 w-3.5 text-white" strokeWidth={2.5} />
      </span>
    );
  }
  if (tone === 'done') {
    return (
      <span className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-dot-green">
        <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />
      </span>
    );
  }
  return <span className="mt-0.5 h-5 w-5 rounded-full bg-neutral-300" />;
}
