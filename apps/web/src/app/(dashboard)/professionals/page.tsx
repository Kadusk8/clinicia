'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

// ==========================================
// Types
// ==========================================

interface TimeSlot { start: string; end: string; }

type WorkingHours = Partial<Record<'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun', TimeSlot[]>>;

interface Professional {
  id: string;
  name: string;
  speciality: string | null;
  registration: string | null;
  workingHours: WorkingHours | null;
}

const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
const DAY_LABELS: Record<string, string> = {
  mon: 'Segunda', tue: 'Terça', wed: 'Quarta',
  thu: 'Quinta', fri: 'Sexta', sat: 'Sábado', sun: 'Domingo',
};

// ==========================================
// Working Hours Modal
// ==========================================

function WorkingHoursModal({ professional, onClose, onSaved }: {
  professional: Professional;
  onClose: () => void;
  onSaved: (updated: Professional) => void;
}) {
  // State: for each day, whether active + start/end
  type DayState = { active: boolean; start: string; end: string };
  const [days, setDays] = useState<Record<string, DayState>>(() => {
    const wh = professional.workingHours ?? {};
    return Object.fromEntries(
      DAY_KEYS.map((key) => {
        const slot = (wh[key] ?? [])[0];
        return [key, { active: !!slot, start: slot?.start ?? '08:00', end: slot?.end ?? '18:00' }];
      }),
    );
  });
  const [saving, setSaving] = useState(false);

  function toggle(key: string) {
    setDays((prev) => ({ ...prev, [key]: { ...prev[key]!, active: !prev[key]!.active } }));
  }
  function setTime(key: string, field: 'start' | 'end', val: string) {
    setDays((prev) => ({ ...prev, [key]: { ...prev[key]!, [field]: val } }));
  }

  async function handleSave() {
    setSaving(true);
    const workingHours: WorkingHours = {};
    for (const key of DAY_KEYS) {
      const d = days[key];
      if (d?.active) {
        workingHours[key] = [{ start: d.start, end: d.end }];
      }
    }
    try {
      const updated = await api.updateWorkingHours(professional.id, workingHours) as Professional;
      onSaved(updated);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
        <div className="px-6 py-4 border-b border-surface-200 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-surface-900">Horários de Trabalho</h2>
            <p className="text-sm text-surface-500">{professional.name}</p>
          </div>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-600 text-xl">×</button>
        </div>

        <div className="p-6 space-y-3">
          {DAY_KEYS.map((key) => {
            const d = days[key]!;
            return (
              <div key={key} className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${
                d.active ? 'bg-primary-50 border border-primary-200' : 'bg-surface-50'
              }`}>
                <label className="flex items-center gap-2 w-24 cursor-pointer flex-shrink-0">
                  <input
                    type="checkbox"
                    checked={d.active}
                    onChange={() => toggle(key)}
                    className="w-4 h-4 accent-primary-500"
                  />
                  <span className={`text-sm font-medium ${d.active ? 'text-surface-800' : 'text-surface-400'}`}>
                    {DAY_LABELS[key]}
                  </span>
                </label>
                {d.active ? (
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      type="time"
                      value={d.start}
                      onChange={(e) => setTime(key, 'start', e.target.value)}
                      className="input py-1 text-sm flex-1"
                    />
                    <span className="text-surface-400 text-xs">até</span>
                    <input
                      type="time"
                      value={d.end}
                      onChange={(e) => setTime(key, 'end', e.target.value)}
                      className="input py-1 text-sm flex-1"
                    />
                  </div>
                ) : (
                  <span className="text-xs text-surface-400">Folga</span>
                )}
              </div>
            );
          })}
        </div>

        <div className="px-6 py-4 border-t border-surface-200 flex justify-end gap-2">
          <button onClick={onClose} className="btn-ghost text-sm">Cancelar</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary text-sm disabled:opacity-60">
            {saving ? 'Salvando...' : 'Salvar Horários'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// Create/Edit Modal
// ==========================================

function ProfessionalModal({ professional, onClose, onSaved }: {
  professional?: Professional;
  onClose: () => void;
  onSaved: (p: Professional) => void;
}) {
  const [name, setName]             = useState(professional?.name ?? '');
  const [speciality, setSpeciality] = useState(professional?.speciality ?? '');
  const [registration, setReg]      = useState(professional?.registration ?? '');
  const [saving, setSaving]         = useState(false);

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      let result: Professional;
      if (professional) {
        result = await api.updateProfessional(professional.id, { name, speciality, registration }) as Professional;
      } else {
        result = await api.createProfessional({ name, speciality, registration }) as Professional;
      }
      onSaved(result);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4">
        <div className="px-6 py-4 border-b border-surface-200 flex items-center justify-between">
          <h2 className="font-semibold text-surface-900">
            {professional ? 'Editar Profissional' : 'Novo Profissional'}
          </h2>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-600 text-xl">×</button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-surface-600 mb-1">Nome *</label>
            <input type="text" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Dr. João Silva" />
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-600 mb-1">Especialidade</label>
            <input type="text" className="input" value={speciality} onChange={(e) => setSpeciality(e.target.value)} placeholder="Clínico Geral" />
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-600 mb-1">CRM / Registro</label>
            <input type="text" className="input" value={registration} onChange={(e) => setReg(e.target.value)} placeholder="CRM 12345" />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-surface-200 flex justify-end gap-2">
          <button onClick={onClose} className="btn-ghost text-sm">Cancelar</button>
          <button onClick={handleSave} disabled={saving || !name.trim()} className="btn-primary text-sm disabled:opacity-60">
            {saving ? 'Salvando...' : professional ? 'Salvar' : 'Criar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// Page
// ==========================================

function activeDays(wh: WorkingHours | null) {
  if (!wh) return 'Sem horários';
  const active = DAY_KEYS.filter((k) => (wh[k]?.length ?? 0) > 0);
  if (!active.length) return 'Sem horários';
  return active.map((k) => DAY_LABELS[k]!.slice(0, 3)).join(', ');
}

export default function ProfessionalsPage() {
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [loading, setLoading]             = useState(true);
  const [editingWH, setEditingWH]         = useState<Professional | null>(null);
  const [editingProf, setEditingProf]     = useState<Professional | null | 'new'>('new' as any);
  const [showModal, setShowModal]         = useState<'create' | 'edit' | 'wh' | null>(null);
  const [targetProf, setTargetProf]       = useState<Professional | null>(null);

  async function fetchProfessionals() {
    try {
      const res = await api.getProfessionals({ pageSize: '100' }) as { data: Professional[] };
      setProfessionals(res.data ?? []);
    } catch {
      setProfessionals([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchProfessionals(); }, []);

  function onSavedProf(p: Professional) {
    setProfessionals((prev) => {
      const idx = prev.findIndex((x) => x.id === p.id);
      if (idx !== -1) return prev.map((x) => x.id === p.id ? p : x);
      return [p, ...prev];
    });
  }

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-surface-900">Profissionais</h1>
          <p className="text-surface-500 mt-1">Equipe da clínica</p>
        </div>
        <button
          onClick={() => { setTargetProf(null); setShowModal('create'); }}
          className="btn-primary flex items-center gap-2"
        >
          <span>+</span>
          Novo Profissional
        </button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          [...Array(3)].map((_, i) => (
            <div key={i} className="card p-6 animate-pulse">
              <div className="h-5 bg-surface-100 rounded w-2/3 mb-3" />
              <div className="h-4 bg-surface-100 rounded w-1/2 mb-2" />
              <div className="h-4 bg-surface-100 rounded w-3/4" />
            </div>
          ))
        ) : (
          <>
            {professionals.map((prof) => (
              <div key={prof.id} className="card p-6 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-surface-900 truncate">{prof.name}</p>
                    {prof.speciality && (
                      <p className="text-sm text-surface-500 truncate">{prof.speciality}</p>
                    )}
                    {prof.registration && (
                      <p className="text-xs text-surface-400">{prof.registration}</p>
                    )}
                  </div>
                  <span className="text-3xl flex-shrink-0">👨‍⚕️</span>
                </div>

                <div className="text-xs text-surface-400 bg-surface-50 rounded-lg px-3 py-2">
                  <span className="font-medium">Horários:</span> {activeDays(prof.workingHours)}
                </div>

                <div className="flex gap-2 mt-auto">
                  <button
                    onClick={() => { setTargetProf(prof); setShowModal('edit'); }}
                    className="flex-1 text-xs py-1.5 rounded-lg border border-surface-200 hover:bg-surface-50 transition-colors text-surface-600"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => { setTargetProf(prof); setShowModal('wh'); }}
                    className="flex-1 text-xs py-1.5 rounded-lg border border-primary-200 bg-primary-50 hover:bg-primary-100 transition-colors text-primary-700 font-medium"
                  >
                    Horários
                  </button>
                </div>
              </div>
            ))}

            {/* Add card */}
            <button
              onClick={() => { setTargetProf(null); setShowModal('create'); }}
              className="card-interactive p-6 border-2 border-dashed border-surface-200 flex flex-col items-center justify-center min-h-[180px] text-surface-400 hover:border-primary-300 hover:text-primary-500 transition-colors"
            >
              <span className="text-4xl mb-2">+</span>
              <p className="font-medium text-sm">Adicionar profissional</p>
            </button>
          </>
        )}
      </div>

      {/* Modals */}
      {(showModal === 'create' || showModal === 'edit') && (
        <ProfessionalModal
          professional={showModal === 'edit' ? targetProf ?? undefined : undefined}
          onClose={() => setShowModal(null)}
          onSaved={onSavedProf}
        />
      )}
      {showModal === 'wh' && targetProf && (
        <WorkingHoursModal
          professional={targetProf}
          onClose={() => setShowModal(null)}
          onSaved={onSavedProf}
        />
      )}
    </div>
  );
}
