// "What the agent checked" — renders the agent's actual ReAct tool-call trace
// (Suggestion.trace). This is the evidence the operator asked for: the clinical
// lookups AND the workflow-discovery steps, in the order the agent ran them.
import {
  Activity,
  Pill,
  FileText,
  BookOpen,
  Workflow,
  Search,
} from 'lucide-react';
import type { TraceStep } from '../types';

const TOOL: Record<string, { icon: typeof Activity; label: string }> = {
  search_observations: { icon: Activity, label: 'Checked observations' },
  get_medications: { icon: Pill, label: 'Reviewed medications' },
  get_note_section: { icon: FileText, label: 'Read note section' },
  get_local_guidance: { icon: BookOpen, label: 'Consulted protocol' },
  search_workflows: { icon: Workflow, label: 'Searched workflows' },
  get_workflow: { icon: Workflow, label: 'Inspected workflow' },
};

export function AgentTrace({ trace }: { trace: TraceStep[] }) {
  if (!trace?.length) return null;
  return (
    <div>
      <div className="mb-2 flex items-center gap-2 px-1">
        <Search className="h-4 w-4 text-brand" />
        <p className="text-[13px] font-semibold text-neutral-900">
          What the agent checked
        </p>
        <span className="ml-auto text-[11px] tabular-nums text-neutral-400">
          {trace.length} steps
        </span>
      </div>
      <ol className="space-y-2.5">
        {trace.map((s) => {
          const meta = TOOL[s.tool] ?? { icon: Search, label: s.tool };
          const Icon = meta.icon;
          return (
            <li
              key={s.order}
              className="flex gap-3 rounded-xl border border-neutral-200/70 bg-white px-3 py-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.03)]"
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-tint">
                <Icon className="h-4 w-4 text-brand" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold text-neutral-900">
                  {meta.label}
                  <span className="ml-1.5 font-normal text-neutral-400">
                    {s.input}
                  </span>
                </p>
                <p className="mt-0.5 line-clamp-3 text-[12px] leading-snug text-neutral-500">
                  {s.summary}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
