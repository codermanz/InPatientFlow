// More tab — a real page: clinician, ward, synthetic-data notice and the
// INTEL/data-source indicator. Reachable from the tab bar.
import { User, Building2, ShieldCheck, Database } from 'lucide-react';
import { useData } from '../data';
import { USE_FIXTURES } from '../api';
import { Card } from '../components/ui';
import { BottomTabs } from '../components/BottomTabs';

export default function MoreTab() {
  const { ward } = useData();

  const rows = [
    { icon: User, label: 'Clinician', value: ward.clinician ?? 'Dr. Who' },
    { icon: Building2, label: 'Ward', value: ward.ward },
    {
      icon: Database,
      label: 'Data source',
      value: USE_FIXTURES ? 'Fixtures (offline)' : 'Live API · cached intel',
    },
  ];

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto no-scrollbar">
        <h1 className="px-5 pb-3 pt-4 text-[24px] font-extrabold text-ink">More</h1>

        <div className="px-4">
          <Card className="divide-y divide-line">
            {rows.map((r) => (
              <div key={r.label} className="flex items-center gap-3 px-4 py-3.5">
                <r.icon className="h-5 w-5 text-brand" />
                <span className="flex-1 text-[14px] text-ink2">{r.label}</span>
                <span className="text-[14px] font-semibold text-ink">{r.value}</span>
              </div>
            ))}
          </Card>
        </div>

        <div className="px-4 pt-3">
          <Card className="flex items-start gap-3 bg-brand-tint px-4 py-4">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
            <p className="text-[13px] leading-relaxed text-ink">
              All patient data shown is <span className="font-semibold">synthetic</span> and for
              demonstration only. WardFlow is clinician-confirmed decision support — it never
              prescribes or acts autonomously.
            </p>
          </Card>
        </div>
      </div>

      <BottomTabs />
    </div>
  );
}
