// Screen 1 — Overview. Ward header + two stat cards + patient list rows
// (initials avatar + Hospital No. + N tasks + status dot). Bottom tabs.
import { Bell, Users, ClipboardCheck } from 'lucide-react';
import { useNav } from '../nav';
import { useData } from '../data';
import { Avatar, Card, StatusDot } from '../components/ui';
import { BottomTabs } from '../components/BottomTabs';

export default function Overview() {
  const { go } = useNav();
  const { ward } = useData();

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto no-scrollbar">
        {/* Header */}
        <div className="flex items-center justify-between px-4 pb-1 pt-3">
          <span className="text-[22px] font-extrabold tracking-tight text-logo">WardFlow</span>
          <button
            onClick={() => go('alerts')}
            className="relative flex h-9 w-9 items-center justify-center rounded-full text-ink hover:bg-neutral-100"
            aria-label="Alerts"
          >
            <Bell className="h-5 w-5" />
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-dot-red" />
          </button>
        </div>

        <div className="px-4 pb-3">
          <h1 className="text-[26px] font-extrabold leading-tight text-ink">{ward.ward}</h1>
          <p className="text-[13px] text-ink2">{ward.date}</p>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 gap-3 px-4 pb-4">
          <Stat icon={<Users className="h-5 w-5 text-brand" />} value={ward.counts.patients} label="Patients" />
          <Stat icon={<ClipboardCheck className="h-5 w-5 text-brand" />} value={ward.counts.tasks} label="Tasks" />
        </div>

        {/* Patients */}
        <p className="px-5 pb-2 text-[15px] font-bold text-ink">Patients</p>
        <div className="space-y-2.5 px-4 pb-4">
          {ward.patients.map((p) => (
            <Card
              key={p.id}
              onClick={() => go('patient', { patientId: p.id })}
              className="flex items-center gap-3 px-3.5 py-3"
            >
              <Avatar initials={p.initials} />
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold text-ink">Hospital No. {p.hospitalNo}</p>
                <p className="text-[12px] text-ink2">{p.taskCount} tasks</p>
              </div>
              <StatusDot status={p.status} />
            </Card>
          ))}
        </div>
      </div>

      <BottomTabs />
    </div>
  );
}

function Stat({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return (
    <Card className="px-4 py-3.5">
      <div className="mb-1.5">{icon}</div>
      <p className="text-[26px] font-extrabold leading-none text-ink">{value}</p>
      <p className="mt-1 text-[13px] text-ink2">{label}</p>
    </Card>
  );
}
