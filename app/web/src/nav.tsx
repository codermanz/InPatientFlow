// Real navigation stack for WardFlow v2. Keeps a history of routes so Back
// always returns to the *actual* previous screen. Each route carries optional
// params (patient id, a tapped Task / SuggestedAction, a result id) so list
// rows open their OWN detail — nothing is hardcoded to the hero.
//
// A rehearsal "demo walk" (→ next / ← back) + a hidden ` jump menu ride on top
// of the stack, but Back is a genuine pop.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { HERO_ID } from './fixtures';

export type ScreenId =
  | 'overview' // 1
  | 'patient' // 2
  | 'tasks' // 3
  | 'taskdetail'
  | 'alert' // 4
  | 'result' // 5
  | 'fullresults'
  | 'suggestions' // 6
  | 'actiondetail'
  | 'modify'
  | 'confirm' // 7
  | 'monitoring' // 8
  | 'alerts' // Alerts tab
  | 'more'; // More tab

export interface ScreenMeta {
  id: ScreenId;
  step: number;
  title: string;
  caption: string;
}

// The canonical 8-screen demo (jump menu + rehearsal walk), plus the
// interactive detail destinations.
export const SCREENS: ScreenMeta[] = [
  { id: 'overview', step: 1, title: 'Overview', caption: 'All patients and tasks' },
  { id: 'patient', step: 2, title: 'Patient Summary', caption: 'Key patient information' },
  { id: 'tasks', step: 3, title: 'Tasks Requested', caption: 'All tasks requested' },
  { id: 'alert', step: 4, title: 'Critical Alert', caption: 'Important alert appears' },
  { id: 'result', step: 5, title: 'Raised Troponin Result', caption: 'Abnormal result received' },
  { id: 'suggestions', step: 6, title: 'AI Suggestions', caption: 'Suggested next steps' },
  { id: 'confirm', step: 7, title: 'Confirm Next Steps', caption: 'Review and approve' },
  { id: 'monitoring', step: 8, title: 'Monitoring', caption: 'Ongoing updates and follow-up' },
  { id: 'taskdetail', step: 9, title: 'Task Detail', caption: 'A single task + its evidence' },
  { id: 'actiondetail', step: 10, title: 'Action Detail', caption: 'A suggested action + evidence' },
  { id: 'fullresults', step: 11, title: 'Full Results', caption: 'Detailed result panel' },
  { id: 'modify', step: 12, title: 'Modify Plan', caption: 'Adjust the proposed plan' },
  { id: 'alerts', step: 13, title: 'Alerts', caption: 'Urgent items' },
  { id: 'more', step: 14, title: 'More', caption: 'Clinician & app info' },
];

export type NavParams = Record<string, unknown>;
export interface Route {
  screen: ScreenId;
  params?: NavParams;
}

// Ordered routes for the rehearsal "next" walk (hero: Hospital No. 1234567).
const DEMO_WALK: Route[] = [
  { screen: 'overview' },
  { screen: 'patient', params: { patientId: HERO_ID } },
  { screen: 'tasks', params: { patientId: HERO_ID } },
  { screen: 'alert' },
  { screen: 'result', params: { patientId: HERO_ID } },
  { screen: 'suggestions', params: { patientId: HERO_ID } },
  { screen: 'confirm', params: { patientId: HERO_ID } },
  { screen: 'monitoring', params: { patientId: HERO_ID } },
];

interface NavCtx {
  screen: ScreenId;
  params: NavParams;
  meta: ScreenMeta;
  canBack: boolean;
  go: (id: ScreenId, params?: NavParams) => void;
  replace: (id: ScreenId, params?: NavParams) => void;
  back: () => void;
  reset: (id: ScreenId, params?: NavParams) => void;
  next: () => void;
  prev: () => void;
}

const Ctx = createContext<NavCtx | null>(null);

export function NavProvider({ children }: { children: ReactNode }) {
  const [stack, setStack] = useState<Route[]>([{ screen: 'overview' }]);
  const [debugOpen, setDebugOpen] = useState(false);

  const top = stack[stack.length - 1];

  const go = useCallback((id: ScreenId, params?: NavParams) => {
    setStack((s) => {
      const cur = s[s.length - 1];
      if (cur.screen === id && !params) return s;
      return [...s, { screen: id, params }];
    });
  }, []);

  const replace = useCallback((id: ScreenId, params?: NavParams) => {
    setStack((s) => [...s.slice(0, -1), { screen: id, params }]);
  }, []);

  const back = useCallback(() => {
    setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));
  }, []);

  const reset = useCallback((id: ScreenId, params?: NavParams) => {
    setStack([{ screen: id, params }]);
  }, []);

  const next = useCallback(() => {
    setStack((s) => {
      const cur = s[s.length - 1];
      const i = DEMO_WALK.findIndex((r) => r.screen === cur.screen);
      const nextRoute = DEMO_WALK[Math.min((i < 0 ? -1 : i) + 1, DEMO_WALK.length - 1)];
      return [...s, nextRoute];
    });
  }, []);

  const prev = back;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '`') setDebugOpen((v) => !v);
      else if (e.key === 'ArrowRight') next();
      else if (e.key === 'ArrowLeft') back();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, back]);

  const meta = useMemo(() => SCREENS.find((s) => s.id === top.screen)!, [top.screen]);

  const value = useMemo<NavCtx>(
    () => ({
      screen: top.screen,
      params: top.params ?? {},
      meta,
      canBack: stack.length > 1,
      go,
      replace,
      back,
      reset,
      next,
      prev,
    }),
    [top.screen, top.params, meta, stack.length, go, replace, back, reset, next, prev],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      {debugOpen && (
        <DebugMenu
          current={top.screen}
          onPick={(id) => {
            const route = DEMO_WALK.find((r) => r.screen === id);
            go(id, route?.params ?? { patientId: HERO_ID });
            setDebugOpen(false);
          }}
          onClose={() => setDebugOpen(false)}
        />
      )}
    </Ctx.Provider>
  );
}

export function useNav() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useNav must be used inside NavProvider');
  return c;
}

// Hidden rehearsal control — press ` (backtick) to toggle.
function DebugMenu({
  current,
  onPick,
  onClose,
}: {
  current: ScreenId;
  onPick: (id: ScreenId) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed right-4 top-4 z-50 w-56 rounded-2xl border border-neutral-200 bg-white/95 p-2 text-sm shadow-2xl backdrop-blur">
      <div className="flex items-center justify-between px-2 py-1">
        <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Jump to screen
        </span>
        <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700" aria-label="Close">
          ×
        </button>
      </div>
      <div className="max-h-[70vh] overflow-y-auto">
        {SCREENS.map((s) => (
          <button
            key={s.id}
            onClick={() => onPick(s.id)}
            className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left ${
              s.id === current ? 'bg-brand text-white' : 'text-neutral-700 hover:bg-neutral-100'
            }`}
          >
            <span
              className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                s.id === current ? 'bg-white/25 text-white' : 'bg-neutral-100 text-neutral-500'
              }`}
            >
              {s.step}
            </span>
            <span className="truncate">{s.title}</span>
          </button>
        ))}
      </div>
      <p className="px-2 pt-1 text-[10px] leading-tight text-neutral-400">
        ` toggle · → next · ← back
      </p>
    </div>
  );
}
