// Bottom tab bar — 3 REAL destinations (Overview / Alerts / More). Each tab
// resets to its root screen and the active tab is derived from the current
// screen. No dead tabs.
import { Home, Bell, MoreHorizontal } from 'lucide-react';
import { clsx } from 'clsx';
import { useNav, type ScreenId } from '../nav';

type TabId = 'overview' | 'alerts' | 'more';

const TABS: { id: TabId; label: string; icon: typeof Home; target: ScreenId }[] = [
  { id: 'overview', label: 'Overview', icon: Home, target: 'overview' },
  { id: 'alerts', label: 'Alerts', icon: Bell, target: 'alerts' },
  { id: 'more', label: 'More', icon: MoreHorizontal, target: 'more' },
];

// Which tab lights up for a given screen.
const SCREEN_TAB: Partial<Record<ScreenId, TabId>> = {
  overview: 'overview',
  patient: 'overview',
  tasks: 'overview',
  taskdetail: 'overview',
  result: 'overview',
  fullresults: 'overview',
  suggestions: 'overview',
  actiondetail: 'overview',
  modify: 'overview',
  confirm: 'overview',
  monitoring: 'overview',
  alerts: 'alerts',
  more: 'more',
};

export function BottomTabs() {
  const { reset, screen } = useNav();
  const current = SCREEN_TAB[screen] ?? 'overview';
  return (
    <div className="flex items-center justify-around border-t border-line bg-white/95 px-2 pb-6 pt-2 backdrop-blur">
      {TABS.map((t) => {
        const Icon = t.icon;
        const isActive = t.id === current;
        return (
          <button
            key={t.id}
            onClick={() => reset(t.target)}
            className={clsx(
              'flex flex-1 flex-col items-center gap-0.5 py-1',
              isActive ? 'text-brand' : 'text-ink2',
            )}
          >
            <Icon className="h-5 w-5" strokeWidth={isActive ? 2.4 : 2} />
            <span className="text-[10px] font-medium">{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}
