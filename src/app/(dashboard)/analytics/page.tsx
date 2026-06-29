'use client';
import { useState, useEffect, useCallback } from 'react';
import { appointmentApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';

interface ConditionStat { condition: string; count: number; percentage: number; }
interface MedicineStat  { medicine: string; count: number; }
interface VitalTrends   {
  condition: string; patientCount: number; consultationCount: number;
  averageVitals: { bpSystolic?: number | null; bpDiastolic?: number | null; pulseRate?: number | null; spo2?: number | null; rbsMgDl?: number | null; bmi?: number | null };
}
interface DoctorStats { totalConsultations: number; totalPrescriptions: number; uniquePatients: number; }

const PALETTE = [
  '#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6',
  '#06b6d4','#f97316','#84cc16','#ec4899','#6366f1',
];

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
    </div>
  );
}

function StatCard({ label, value, sub, color = 'blue' }: { label: string; value: string | number; sub?: string; color?: string }) {
  const colors: Record<string, string> = {
    blue:   'bg-blue-50 text-blue-700 border-blue-200',
    green:  'bg-green-50 text-green-700 border-green-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
    amber:  'bg-amber-50 text-amber-700 border-amber-200',
    teal:   'bg-teal-50 text-teal-700 border-teal-200',
  };
  return (
    <div className={`rounded-2xl border p-5 ${colors[color] ?? colors.blue}`}>
      <p className="text-xs font-medium uppercase tracking-wide opacity-70">{label}</p>
      <p className="text-3xl font-bold mt-1">{value}</p>
      {sub && <p className="text-xs mt-1 opacity-60">{sub}</p>}
    </div>
  );
}

export default function AnalyticsPage() {
  const { user } = useAuthStore();
  const isDoctor = user?.role === 'DOCTOR';

  const [mineOnly, setMineOnly] = useState(false);
  const [conditionData, setConditionData] = useState<{ totalPatients: number; patientsTagged: number; distribution: ConditionStat[] } | null>(null);
  const [medicineData, setMedicineData]   = useState<{ condition: string; patientCount: number; medicines: MedicineStat[] } | null>(null);
  const [vitalData, setVitalData]         = useState<VitalTrends | null>(null);
  const [aiInsights, setAiInsights]       = useState<string | null>(null);
  const [aiLoading, setAiLoading]         = useState(false);
  const [doctorStats, setDoctorStats]     = useState<DoctorStats | null>(null);
  const [selectedCondition, setSelectedCondition] = useState<string>('');
  const [loadingConditions, setLoadingConditions] = useState(true);
  const [loadingMeds, setLoadingMeds]     = useState(false);
  const [loadingVitals, setLoadingVitals] = useState(false);
  const [chartType, setChartType]         = useState<'bar' | 'pie'>('bar');

  const mineParam = mineOnly ? '&mine=true' : '';

  const loadConditions = useCallback(() => {
    setLoadingConditions(true);
    setConditionData(null);
    setSelectedCondition('');
    setMedicineData(null);
    setVitalData(null);
    appointmentApi.get(`/analytics/conditions?v=1${mineParam}`)
      .then(r => setConditionData(r.data))
      .catch(() => {})
      .finally(() => setLoadingConditions(false));
  }, [mineParam]);

  useEffect(() => { loadConditions(); }, [loadConditions]);

  useEffect(() => {
    if (!isDoctor) return;
    appointmentApi.get('/analytics/my-stats')
      .then(r => setDoctorStats(r.data))
      .catch(() => {});
  }, [isDoctor]);

  const loadMedicinePatterns = useCallback((condition: string) => {
    setLoadingMeds(true);
    const q = condition ? `&condition=${encodeURIComponent(condition)}` : '';
    appointmentApi.get(`/analytics/medicine-patterns?v=1${q}${mineParam}`)
      .then(r => setMedicineData(r.data))
      .catch(() => {})
      .finally(() => setLoadingMeds(false));
  }, [mineParam]);

  const loadVitalTrends = useCallback((condition: string) => {
    if (!condition) return;
    setLoadingVitals(true);
    appointmentApi.get(`/analytics/vital-trends?condition=${encodeURIComponent(condition)}${mineParam}`)
      .then(r => setVitalData(r.data))
      .catch(() => {})
      .finally(() => setLoadingVitals(false));
  }, [mineParam]);

  function selectCondition(c: string) {
    setSelectedCondition(c);
    loadMedicinePatterns(c);
    loadVitalTrends(c);
  }

  function loadAiInsights() {
    setAiLoading(true);
    setAiInsights(null);
    appointmentApi.get(`/analytics/ai-insights?v=1${mineParam}`)
      .then(r => setAiInsights(r.data?.insights ?? 'No insights available.'))
      .catch((err: any) => {
        const msg = err?.response?.data?.message ?? err?.message ?? 'Unknown error';
        setAiInsights(`⚠️ ${msg}`);
      })
      .finally(() => setAiLoading(false));
  }

  const topConditions = conditionData?.distribution.slice(0, 10) ?? [];

  return (
    <div className="max-w-7xl mx-auto space-y-8">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Patient Analytics</h1>
          <p className="text-sm text-gray-500 mt-1">Disease grouping, prescription patterns & AI-powered population insights</p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {/* My Patients / All toggle — doctors only */}
          {isDoctor && (
            <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
              <button
                onClick={() => setMineOnly(false)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${!mineOnly ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                All Patients
              </button>
              <button
                onClick={() => setMineOnly(true)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${mineOnly ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                My Patients
              </button>
            </div>
          )}
          <button
            onClick={loadAiInsights}
            disabled={aiLoading}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-600 to-blue-600 text-white text-sm font-semibold rounded-xl shadow hover:opacity-90 disabled:opacity-60"
          >
            {aiLoading ? (
              <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />Generating…</>
            ) : <>✨ AI Insights</>}
          </button>
        </div>
      </div>

      {/* Doctor "My Stats" strip */}
      {isDoctor && doctorStats && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-5 text-white">
            <p className="text-xs font-medium uppercase tracking-wide opacity-75">My Consultations</p>
            <p className="text-3xl font-bold mt-1">{doctorStats.totalConsultations.toLocaleString()}</p>
            <p className="text-xs mt-1 opacity-60">total recorded</p>
          </div>
          <div className="bg-gradient-to-br from-teal-600 to-teal-700 rounded-2xl p-5 text-white">
            <p className="text-xs font-medium uppercase tracking-wide opacity-75">My Prescriptions</p>
            <p className="text-3xl font-bold mt-1">{doctorStats.totalPrescriptions.toLocaleString()}</p>
            <p className="text-xs mt-1 opacity-60">prescriptions written</p>
          </div>
          <div className="bg-gradient-to-br from-purple-600 to-purple-700 rounded-2xl p-5 text-white">
            <p className="text-xs font-medium uppercase tracking-wide opacity-75">My Unique Patients</p>
            <p className="text-3xl font-bold mt-1">{doctorStats.uniquePatients.toLocaleString()}</p>
            <p className="text-xs mt-1 opacity-60">patients seen</p>
          </div>
        </div>
      )}

      {/* Scope banner */}
      {mineOnly && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5 flex items-center gap-2 text-sm text-blue-700">
          <span className="font-semibold">My Patients view:</span>
          <span>Showing analytics for patients you have previously consulted.</span>
          <button onClick={() => setMineOnly(false)} className="ml-auto text-xs underline text-blue-500 hover:text-blue-700">Switch to all patients</button>
        </div>
      )}

      {/* Population stat cards */}
      {loadingConditions ? <LoadingSpinner /> : conditionData && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Total Patients" value={conditionData.totalPatients.toLocaleString()} color="blue" />
          <StatCard label="Patients Tagged" value={conditionData.patientsTagged.toLocaleString()}
            sub={`${Math.round(conditionData.patientsTagged / (conditionData.totalPatients || 1) * 100)}% of ${mineOnly ? 'my' : 'all'} patients`} color="green" />
          <StatCard label="Unique Conditions" value={conditionData.distribution.length} sub="recorded" color="purple" />
          <StatCard label="Top Condition" value={conditionData.distribution[0]?.condition ?? '—'}
            sub={conditionData.distribution[0] ? `${conditionData.distribution[0].count} patients` : ''} color="amber" />
        </div>
      )}

      {/* Condition distribution chart */}
      {topConditions.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Condition Distribution</h2>
              <p className="text-xs text-gray-500 mt-0.5">Click a bar / slice to filter prescription patterns below</p>
            </div>
            <div className="flex gap-2">
              {(['bar', 'pie'] as const).map(t => (
                <button key={t} onClick={() => setChartType(t)}
                  className={`px-3 py-1 text-xs rounded-lg font-medium transition-colors ${chartType === t ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  {t === 'bar' ? 'Bar' : 'Pie'}
                </button>
              ))}
            </div>
          </div>

          {chartType === 'bar' ? (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={topConditions} margin={{ top: 4, right: 16, bottom: 80, left: 0 }}
                onClick={(d) => d?.activePayload?.[0]?.payload?.condition && selectCondition(d.activePayload[0].payload.condition)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="condition" tick={{ fontSize: 11 }} angle={-35} textAnchor="end" interval={0} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number, _: string, item: any) => [`${v} patients (${item?.payload?.percentage ?? 0}%)`, 'Count']} />
                <Bar dataKey="count" radius={[6, 6, 0, 0]} cursor="pointer">
                  {topConditions.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <PieChart>
                <Pie data={topConditions} dataKey="count" nameKey="condition" cx="50%" cy="50%" outerRadius={120}
                  onClick={(d) => selectCondition(d.condition)} cursor="pointer" label={({ percentage }) => `${percentage}%`}>
                  {topConditions.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                </Pie>
                <Legend formatter={(v) => <span className="text-xs">{v}</span>} />
                <Tooltip formatter={(v: number, k: string, item: any) => [`${v} patients (${item?.payload?.percentage ?? 0}%)`, k]} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Prescription patterns */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Prescription Patterns</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {selectedCondition ? `Top medicines for: ${selectedCondition}` : 'All conditions — click chart to filter'}
              </p>
            </div>
            {selectedCondition && (
              <button onClick={() => { setSelectedCondition(''); loadMedicinePatterns(''); }}
                className="text-xs text-gray-400 hover:text-gray-700 underline">Clear filter</button>
            )}
          </div>
          {loadingMeds ? <LoadingSpinner /> : medicineData ? (
            medicineData.medicines.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">No prescription data for this condition yet</p>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {medicineData.medicines.map((m, i) => (
                  <div key={m.medicine} className="flex items-center gap-3">
                    <span className="w-5 text-xs text-gray-400 text-right flex-shrink-0">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-sm font-medium text-gray-800 truncate">{m.medicine}</span>
                        <span className="text-xs text-gray-500 flex-shrink-0 ml-2">{m.count}×</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5">
                        <div className="h-1.5 rounded-full" style={{ width: `${Math.round(m.count / (medicineData.medicines[0]?.count || 1) * 100)}%`, backgroundColor: PALETTE[i % PALETTE.length] }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            <p className="text-sm text-gray-400 text-center py-8">Select a condition from the chart above</p>
          )}
        </div>

        {/* Vital averages */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-1">Average Vitals</h2>
          <p className="text-xs text-gray-500 mb-4">
            {selectedCondition ? `Population averages for: ${selectedCondition}` : 'Select a condition to view average vitals'}
          </p>
          {loadingVitals ? <LoadingSpinner /> : vitalData ? (
            <div className="space-y-3">
              <p className="text-xs text-gray-500">{vitalData.patientCount} patients · {vitalData.consultationCount} consultations analysed</p>
              {[
                { label: 'Blood Pressure', value: vitalData.averageVitals.bpSystolic && vitalData.averageVitals.bpDiastolic ? `${vitalData.averageVitals.bpSystolic}/${vitalData.averageVitals.bpDiastolic} mmHg` : null },
                { label: 'Pulse Rate', value: vitalData.averageVitals.pulseRate ? `${vitalData.averageVitals.pulseRate} bpm` : null },
                { label: 'SpO₂', value: vitalData.averageVitals.spo2 ? `${vitalData.averageVitals.spo2}%` : null },
                { label: 'RBS', value: vitalData.averageVitals.rbsMgDl ? `${vitalData.averageVitals.rbsMgDl} mg/dL` : null },
                { label: 'BMI', value: vitalData.averageVitals.bmi ? `${vitalData.averageVitals.bmi}` : null },
              ].filter(v => v.value).map(v => (
                <div key={v.label} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <span className="text-sm text-gray-600">{v.label}</span>
                  <span className="text-sm font-semibold text-gray-900">{v.value}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-8">Select a condition from the chart</p>
          )}
        </div>
      </div>

      {/* AI Insights panel */}
      {(aiInsights || aiLoading) && (
        <div className="bg-gradient-to-br from-violet-50 to-blue-50 rounded-2xl border border-violet-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-lg">✨</span>
            <h2 className="text-base font-semibold text-violet-900">AI Population Insights</h2>
            {mineOnly && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">My Patients</span>}
            {aiLoading && <div className="w-4 h-4 border-2 border-violet-300 border-t-violet-600 rounded-full animate-spin ml-auto" />}
          </div>
          {aiInsights && (
            <div className="prose prose-sm max-w-none text-gray-800 space-y-1">
              {aiInsights.split('\n').map((line, i) => {
                if (line.startsWith('## ')) return <h3 key={i} className="text-sm font-semibold text-violet-800 mt-4 mb-1">{line.replace('## ', '')}</h3>;
                if (line.startsWith('- ') || line.startsWith('• ')) return <p key={i} className="text-sm text-gray-700 flex gap-2"><span className="text-violet-400 flex-shrink-0">•</span>{line.replace(/^[-•]\s*/, '')}</p>;
                if (line.startsWith('*') && line.endsWith('*')) return <p key={i} className="text-xs text-gray-400 italic mt-4 pt-4 border-t border-violet-200">{line.replace(/\*/g, '')}</p>;
                if (line.trim()) return <p key={i} className="text-sm text-gray-700">{line}</p>;
                return null;
              })}
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {!loadingConditions && conditionData && conditionData.distribution.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <p className="text-4xl mb-3">📊</p>
          <p className="text-base font-medium text-gray-700">No condition data yet</p>
          <p className="text-sm text-gray-400 mt-1">
            {mineOnly
              ? 'None of your patients have been tagged with conditions yet. Tag conditions during a consultation.'
              : 'Start tagging patient conditions during consultations or from the Patients list to see analytics here.'}
          </p>
        </div>
      )}
    </div>
  );
}
