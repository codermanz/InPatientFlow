// Screen 5 — Raised Troponin Result. Pink card with the big red value + High
// badge + reference + time, an Interpretation card, and "View Full Results".
import { useNav } from '../nav';
import { useData } from '../data';
import { BackBar, Card, PatientHeader, PrimaryButton, OutlineButton } from '../components/ui';

export default function TroponinResult() {
  const { back, go, params } = useNav();
  const { patient, result } = useData();
  const high = result.status === 'high' || result.status === 'critical' || result.status === 'abnormal';

  return (
    <div className="min-h-full pb-6">
      <BackBar onBack={back} />
      <PatientHeader hospitalNo={patient.hospitalNo} bed={patient.bed} initials={patient.initials} />

      <div className="space-y-3 px-4">
        {/* Pink result card */}
        <Card className="border-transparent bg-pink px-5 py-5">
          <p className="text-[16px] font-bold text-ink">{result.name}</p>
          <div className="mt-2 flex items-end justify-between">
            <p className="text-[40px] font-extrabold leading-none text-critical">
              {result.value} <span className="text-[20px] font-bold">{result.unit}</span>
            </p>
            {high && (
              <span className="rounded-full border border-critical/40 px-3 py-1 text-[13px] font-bold text-critical">
                High
              </span>
            )}
          </div>
          <p className="mt-3 text-[13px] text-ink2">Reference: {result.refRange}</p>
          <p className="text-[13px] text-ink2">{result.returnedAt}</p>
        </Card>

        {/* Interpretation */}
        {result.interpretation && (
          <Card className="px-5 py-4">
            <p className="text-[15px] font-bold text-ink">Interpretation</p>
            <p className="mt-1 text-[14px] leading-relaxed text-ink2">{result.interpretation}</p>
          </Card>
        )}
      </div>

      <div className="space-y-2.5 px-4 pt-5">
        <PrimaryButton onClick={() => go('suggestions', { patientId: params.patientId })}>
          View Suggested Next Steps
        </PrimaryButton>
        <OutlineButton onClick={() => go('fullresults', { patientId: params.patientId })}>
          View Full Results
        </OutlineButton>
      </div>

      <p className="px-5 pt-4 text-center text-[11px] text-ink2">
        Clinician-confirmed · decision support · synthetic
      </p>
    </div>
  );
}
