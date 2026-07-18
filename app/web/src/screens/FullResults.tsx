// Full Results — dummy detailed result panel opened from screen 5's
// "View Full Results". Its primary CTA continues to the AI Suggestions (screen 6).
import { useNav } from '../nav';
import { useData } from '../data';
import { HERO_ID } from '../fixtures';
import { BackBar, Card, PatientHeader, PrimaryButton } from '../components/ui';

export default function FullResults() {
  const { back, go, params } = useNav();
  const { patient, result } = useData();
  const id = (params.patientId as string) ?? HERO_ID;

  const rows = [
    { label: result.name, value: `${result.value} ${result.unit ?? ''}`, ref: result.refRange, flag: 'High' },
    { label: 'CK-MB', value: '38 ng/mL', ref: '< 5 ng/mL', flag: 'High' },
    { label: 'Creatinine', value: '84 µmol/L', ref: '59–104 µmol/L', flag: '' },
    { label: 'Haemoglobin', value: '141 g/L', ref: '130–170 g/L', flag: '' },
    { label: 'Potassium', value: '4.2 mmol/L', ref: '3.5–5.1 mmol/L', flag: '' },
  ];

  return (
    <div className="min-h-full pb-6">
      <BackBar onBack={back} />
      <PatientHeader hospitalNo={patient.hospitalNo} bed={patient.bed} initials={patient.initials} />

      <p className="px-5 pb-2 text-[15px] font-bold text-ink">Full Results</p>
      <div className="px-4">
        <Card className="divide-y divide-line">
          {rows.map((r) => (
            <div key={r.label} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-[14px] font-semibold text-ink">{r.label}</p>
                <p className="text-[12px] text-ink2">Ref {r.ref}</p>
              </div>
              <span className={`text-[15px] font-bold ${r.flag === 'High' ? 'text-critical' : 'text-ink'}`}>
                {r.value}
              </span>
            </div>
          ))}
        </Card>
      </div>

      <div className="px-4 pt-5">
        <PrimaryButton onClick={() => go('suggestions', { patientId: id })}>
          Suggested Next Steps
        </PrimaryButton>
      </div>

      <p className="px-5 pt-4 text-center text-[11px] text-ink2">
        Synthetic panel — for demonstration only
      </p>
    </div>
  );
}
