'use client';
import { useState } from 'react';
import { appointmentApi } from '@/lib/api';

export interface DismissTarget {
  id: string;
  tokenNumber: number;
  status: string;
  patient: { firstName: string; lastName: string; uhid: string };
  doctor: { firstName: string; lastName: string };
}

interface Props {
  appointment: DismissTarget;
  onClose: () => void;
  onDismissed: () => void;
}

const PRESETS = [
  'Patient left — long wait',
  'Doctor unavailable',
  'Patient declined treatment',
  'Referred elsewhere',
];

const PAID_STATUSES = ['CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS', 'COMPLETED', 'SENT_TO_PHARMACY'];

export function DismissModal({ appointment, onClose, onDismissed }: Props) {
  const isPaid = PAID_STATUSES.includes(appointment.status);

  const [disposition, setDisposition] = useState<'CANCELLED' | 'NO_SHOW'>(
    isPaid ? 'CANCELLED' : 'NO_SHOW',
  );
  const [preset, setPreset] = useState('');
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const reason = [preset, comment].filter(Boolean).join(' — ');

  const handleSubmit = async () => {
    if (!reason.trim()) { setError('Please select or enter a reason'); return; }
    setLoading(true);
    setError('');
    try {
      await appointmentApi.post(`/appointments/${appointment.id}/cancel`, {
        reason,
        cancelStatus: disposition,
      });
      onDismissed();
    } catch {
      setError('Failed to dismiss appointment. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Dismiss Appointment</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Patient info */}
        <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-sm font-bold flex-shrink-0">
              #{appointment.tokenNumber}
            </div>
            <div>
              <p className="font-medium text-gray-900 text-sm">
                {appointment.patient.firstName} {appointment.patient.lastName}
              </p>
              <p className="text-xs text-gray-400">
                {appointment.patient.uhid} · Dr. {appointment.doctor.firstName} {appointment.doctor.lastName}
              </p>
            </div>
          </div>
          {isPaid && (
            <p className="mt-2.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Payment already collected — consider issuing a refund if applicable.
            </p>
          )}
        </div>

        {/* Form */}
        <div className="p-5 space-y-4">
          {/* Disposition toggle */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Mark as</p>
            <div className="flex gap-2">
              {(['CANCELLED', 'NO_SHOW'] as const).map(d => (
                <button
                  key={d}
                  onClick={() => setDisposition(d)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
                    disposition === d
                      ? 'bg-gray-900 text-white border-gray-900'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                  }`}
                >
                  {d === 'CANCELLED' ? 'Cancelled' : 'No-show'}
                </button>
              ))}
            </div>
          </div>

          {/* Preset reasons */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Reason</p>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map(p => (
                <button
                  key={p}
                  onClick={() => setPreset(p === preset ? '' : p)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    preset === p
                      ? 'bg-red-50 text-red-700 border-red-300'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Free-text */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Additional comments
            </p>
            <textarea
              rows={2}
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="Optional notes for audit trail..."
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-red-400 placeholder:text-gray-400"
            />
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-5 pb-5">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:border-gray-400 transition-colors"
          >
            Back
          </button>
          <button
            onClick={handleSubmit}
            disabled={!reason.trim() || loading}
            className="flex-1 py-2.5 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Dismissing…' : 'Dismiss Patient'}
          </button>
        </div>
      </div>
    </div>
  );
}
