// Alerts tab — a real page listing urgent items (incl. the troponin alert).
// Each urgent item deep-links to its result. Reachable from the bell + tab bar.
import { useEffect, useState } from 'react';
import { AlertTriangle, Bell } from 'lucide-react';
import { useNav } from '../nav';
import * as api from '../api';
import * as fx from '../fixtures';
import { Card } from '../components/ui';
import { BottomTabs } from '../components/BottomTabs';
import type { Notification } from '../types';

export default function AlertsTab() {
  const { go } = useNav();
  const [items, setItems] = useState<Notification[]>([fx.notification]);

  useEffect(() => {
    let alive = true;
    api
      .getNotifications()
      .then(({ notifications }) => {
        if (alive && notifications.length) setItems(notifications);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto no-scrollbar">
        <div className="flex items-center gap-2 px-5 pb-3 pt-4">
          <Bell className="h-6 w-6 text-brand" />
          <h1 className="text-[24px] font-extrabold text-ink">Alerts</h1>
        </div>

        <div className="space-y-2.5 px-4">
          {items.map((n) => (
            <Card
              key={n.id}
              onClick={() => go('result', { patientId: n.patientId, resultId: n.resultEventId })}
              className={n.urgent ? 'border-transparent bg-critical px-4 py-3.5' : 'px-4 py-3.5'}
            >
              <div className="flex items-start gap-3">
                <AlertTriangle
                  className={`mt-0.5 h-6 w-6 shrink-0 ${n.urgent ? 'text-white' : 'text-critical'}`}
                />
                <div>
                  <p className={`text-[15px] font-bold ${n.urgent ? 'text-white' : 'text-ink'}`}>
                    {n.title}
                  </p>
                  <p className={`text-[13px] ${n.urgent ? 'text-white/90' : 'text-ink2'}`}>{n.body}</p>
                </div>
              </div>
            </Card>
          ))}
          {items.length === 0 && (
            <p className="px-1 pt-6 text-center text-[14px] text-ink2">No active alerts.</p>
          )}
        </div>
      </div>

      <BottomTabs />
    </div>
  );
}
