// Screen 2 — Patient Summary. Flattened one-field cards for the patient the
// row opened (by id → GET /patients/:id). Tasks card → screen 3.
import { useNav } from '../nav';
import { usePatientDetail } from '../data';
import { HERO_ID } from '../fixtures';
import { BackBar, Card, Chevron, PatientHeader } from '../components/ui';

function Field({
  label,
  children,
  danger,
}: {
  label: string;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <Card className="px-4 py-3">
      <p className="text-[13px] text-ink2">{label}</p>
      <p className={`mt-0.5 text-[15px] font-semibold ${danger ? 'text-critical' : 'text-ink'}`}>
        {children}
      </p>
    </Card>
  );
}

export default function PatientSummary() {
  const { params, go, back } = useNav();
  const id = (params.patientId as string) ?? HERO_ID;
  const { patient, encounter, tasks } = usePatientDetail(id);

  const investigations =
    (encounter.investigations ?? [])
      .map((i) => `${i.label} – ${i.value}`)
      .join('   |   ') || '—';

  return (
    <div className="min-h-full pb-6">
      <BackBar onBack={back} />
      <PatientHeader hospitalNo={patient.hospitalNo} bed={patient.bed} initials={patient.initials} />

      <div className="space-y-2.5 px-4">
        <Field label="Presenting complaint">{encounter.presentingComplaint || '—'}</Field>
        <Field label="NEWS">{encounter.news ?? '—'}</Field>
        <Field label="Investigations">{investigations}</Field>
        <Field label="PMH">{encounter.pmh?.length ? encounter.pmh.join(', ') : '—'}</Field>
        <Field label="Allergies" danger>
          {encounter.allergies?.length ? encounter.allergies.join(', ') : 'None known'}
        </Field>
        <Field label="Medications">
          {encounter.medications?.length ? encounter.medications.join(', ') : '—'}
        </Field>

        <Card
          onClick={() => go('tasks', { patientId: id })}
          className="flex items-center justify-between px-4 py-3.5"
        >
          <div>
            <p className="text-[15px] font-semibold text-ink">Tasks</p>
            <p className="text-[12px] text-ink2">{tasks.length} tasks</p>
          </div>
          <Chevron />
        </Card>
      </div>
    </div>
  );
}
