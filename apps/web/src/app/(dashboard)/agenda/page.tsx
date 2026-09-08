'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';

interface Appointment {
  id: string;
  startsAt: string;
  endsAt: string;
  status: string;
  notes: string | null;
  patientId: string;
  professionalId: string;
  serviceId: string;
  patientName: string | null;
  patientPhone: string | null;
  serviceName: string | null;
  professionalName: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  scheduled:  'bg-primary-100 border-l-primary-500 text-primary-800',
  confirmed:  'bg-accent-100 border-l-accent-500 text-accent-800',
  completed:  'bg-surface-100 border-l-surface-400 text-surface-500',
  cancelled:  'bg-red-50 border-l-red-400 text-red-500 line-through opacity-60',
  no_show:    'bg-amber-50 border-l-amber-400 text-amber-700 opacity-70',
};

const STATUS_LABEL: Record<string, string> = {
  scheduled: 'Agendado',
  confirmed: 'Confirmado',
  completed: 'Concluído',
  cancelled: 'Cancelado',
  no_show: 'Não compareceu',
};

// Hours shown in the grid: 07 to 20
const HOURS = Array.from({ length: 14 }, (_, i) => i + 7);
const SLOT_HEIGHT = 60; // px per hour

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0 = sun
  const diff = day === 0 ? -6 : 1 - day; // Monday as first day
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function isSameDay(a: Date, b: Date) {
  return a.toDateString() === b.toDateString();
}

// Os inputs de data/hora do modal trabalham sempre em horário de Brasília,
// não no timezone do navegador — evita confusão pra quem acessa de outro
// fuso e mantém consistência com o resto do sistema (agente, tools).
function toBrasiliaInputValue(iso: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}

function fromBrasiliaInputValue(value: string): string {
  return new Date(`${value}:00-03:00`).toISOString();
}

export default function AgendaPage() {
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal de detalhe/edição do agendamento
  const [selected, setSelected] = useState<Appointment | null>(null);
  const [editStartsAt, setEditStartsAt] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  function openAppointment(apt: Appointment) {
    setSelected(apt);
    setEditStartsAt(toBrasiliaInputValue(apt.startsAt));
    setEditNotes(apt.notes ?? '');
    setSaveError('');
  }

  async function handleSaveAppointment() {
    if (!selected) return;
    setSaving(true);
    setSaveError('');
    try {
      const updated = await api.updateAppointment(selected.id, {
        startsAt: fromBrasiliaInputValue(editStartsAt),
        notes: editNotes,
      }) as Appointment;
      setAppointments((prev) => prev.map((a) => (a.id === selected.id ? { ...a, ...updated } : a)));
      setSelected(null);
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Erro ao salvar agendamento');
    } finally {
      setSaving(false);
    }
  }

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const weekEnd = addDays(weekStart, 7);

  const fetchAppointments = useCallback(async () => {
    setLoading(true);
    try {
      const from = weekStart.toISOString();
      const to = weekEnd.toISOString();
      const data = await api.getAppointmentsByRange(from, to) as Appointment[];
      setAppointments(data ?? []);
    } catch {
      setAppointments([]);
    } finally {
      setLoading(false);
    }
  }, [weekStart.toISOString()]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchAppointments(); }, [fetchAppointments]);

  function prevWeek() { setWeekStart((d) => addDays(d, -7)); }
  function nextWeek() { setWeekStart((d) => addDays(d, 7)); }
  function goToday()  { setWeekStart(getWeekStart(new Date())); }

  // Get appointments for a specific day + hour
  function getAptForSlot(day: Date) {
    return appointments.filter((apt) => {
      const start = new Date(apt.startsAt);
      return isSameDay(start, day);
    });
  }

  // Position appointment in the grid
  function aptStyle(apt: Appointment) {
    const start = new Date(apt.startsAt);
    const end = new Date(apt.endsAt);
    const startH = start.getHours() + start.getMinutes() / 60;
    const endH = end.getHours() + end.getMinutes() / 60;
    const gridStart = HOURS[0]!;
    const top = (startH - gridStart) * SLOT_HEIGHT;
    const height = Math.max((endH - startH) * SLOT_HEIGHT, 24);
    return { top, height };
  }

  const today = new Date();
  const isThisWeek = isSameDay(weekStart, getWeekStart(today));

  const weekLabel = (() => {
    const s = weekStart.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
    const e = addDays(weekStart, 6).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
    return `${s} – ${e}`;
  })();

  return (
    <div className="animate-fade-in flex flex-col" style={{ height: 'calc(100vh - 80px)' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div>
          <h1 className="text-3xl font-bold text-surface-900">Agenda</h1>
          <p className="text-surface-500 mt-1">Visualização semanal dos agendamentos</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={prevWeek} className="btn-ghost text-sm px-3 py-1.5">← Anterior</button>
          <button onClick={goToday} className={`text-sm px-3 py-1.5 rounded-lg border transition-colors ${
            isThisWeek
              ? 'border-primary-300 bg-primary-50 text-primary-700 font-medium'
              : 'border-surface-200 hover:bg-surface-50 text-surface-600'
          }`}>
            {weekLabel}
          </button>
          <button onClick={nextWeek} className="btn-ghost text-sm px-3 py-1.5">Próxima →</button>
        </div>
      </div>

      {/* Calendar */}
      <div className="card flex flex-col flex-1 overflow-hidden">
        {/* Day header row */}
        <div className="grid border-b border-surface-200 flex-shrink-0" style={{ gridTemplateColumns: '60px repeat(7, 1fr)' }}>
          <div className="p-2 text-xs text-surface-400 text-center" />
          {weekDays.map((day, i) => {
            const isToday = isSameDay(day, today);
            return (
              <div
                key={i}
                className={`p-2 text-center border-l border-surface-100 ${isToday ? 'bg-primary-50' : ''}`}
              >
                <p className="text-xs text-surface-400 uppercase">
                  {day.toLocaleDateString('pt-BR', { weekday: 'short' })}
                </p>
                <p className={`text-sm font-semibold mt-0.5 ${
                  isToday
                    ? 'w-7 h-7 rounded-full bg-primary-500 text-white flex items-center justify-center mx-auto'
                    : 'text-surface-700'
                }`}>
                  {day.getDate()}
                </p>
              </div>
            );
          })}
        </div>

        {/* Scrollable grid body */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-48 text-surface-400">
              <p className="text-sm">Carregando...</p>
            </div>
          ) : (
            <div className="grid relative" style={{ gridTemplateColumns: '60px repeat(7, 1fr)' }}>
              {/* Hour labels */}
              <div>
                {HOURS.map((h) => (
                  <div key={h} style={{ height: SLOT_HEIGHT }} className="border-b border-surface-100 flex items-start justify-center pt-1">
                    <span className="text-[10px] text-surface-400">{String(h).padStart(2, '0')}:00</span>
                  </div>
                ))}
              </div>

              {/* Day columns */}
              {weekDays.map((day, di) => {
                const dayApts = getAptForSlot(day);
                const isToday = isSameDay(day, today);
                return (
                  <div key={di} className={`border-l border-surface-100 relative ${isToday ? 'bg-primary-50/30' : ''}`}
                    style={{ height: HOURS.length * SLOT_HEIGHT }}>
                    {/* Hour grid lines */}
                    {HOURS.map((h) => (
                      <div key={h} style={{ height: SLOT_HEIGHT, top: (h - HOURS[0]!) * SLOT_HEIGHT }}
                        className="absolute w-full border-b border-surface-100" />
                    ))}

                    {/* Today line */}
                    {isToday && (() => {
                      const now = new Date();
                      const nowH = now.getHours() + now.getMinutes() / 60;
                      const top = (nowH - HOURS[0]!) * SLOT_HEIGHT;
                      if (top < 0 || top > HOURS.length * SLOT_HEIGHT) return null;
                      return (
                        <div className="absolute w-full z-10 flex items-center pointer-events-none" style={{ top }}>
                          <div className="w-2 h-2 rounded-full bg-red-500 -ml-1 flex-shrink-0" />
                          <div className="flex-1 h-px bg-red-400" />
                        </div>
                      );
                    })()}

                    {/* Appointments */}
                    {dayApts.map((apt) => {
                      const { top, height } = aptStyle(apt);
                      const colorClass = STATUS_COLORS[apt.status] ?? STATUS_COLORS.scheduled!;
                      return (
                        <div
                          key={apt.id}
                          onClick={() => openAppointment(apt)}
                          title={`${apt.patientName ?? 'Paciente'} · ${apt.serviceName ?? 'Consulta'}\n${STATUS_LABEL[apt.status] ?? apt.status}`}
                          style={{ top, height, left: 2, right: 2 }}
                          className={`absolute rounded border-l-2 px-1.5 py-1 text-[11px] overflow-hidden cursor-pointer hover:brightness-95 transition-all ${colorClass}`}
                        >
                          <p className="font-semibold truncate leading-tight">
                            {apt.patientName ?? apt.patientPhone ?? 'Paciente'}
                          </p>
                          {height > 30 && (
                            <p className="truncate opacity-80 leading-tight">
                              {apt.serviceName ?? 'Consulta'}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modal de detalhe/edição */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4">
            <div className="px-6 py-4 border-b border-surface-200 flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-surface-900">
                  {selected.patientName ?? selected.patientPhone ?? 'Paciente'}
                </h2>
                <p className="text-sm text-surface-500">
                  {selected.serviceName ?? 'Consulta'} · {selected.professionalName ?? 'Profissional'}
                </p>
              </div>
              <button onClick={() => setSelected(null)} className="text-surface-400 hover:text-surface-600 text-xl">×</button>
            </div>

            <div className="p-6 space-y-4">
              <span className={`inline-block text-xs font-medium px-2 py-1 rounded-lg ${STATUS_COLORS[selected.status] ?? STATUS_COLORS.scheduled}`}>
                {STATUS_LABEL[selected.status] ?? selected.status}
              </span>

              <div>
                <label className="block text-sm font-medium text-surface-600 mb-1">Data e horário</label>
                <input
                  type="datetime-local"
                  className="input"
                  value={editStartsAt}
                  onChange={(e) => setEditStartsAt(e.target.value)}
                />
                <p className="text-xs text-surface-400 mt-1">Horário de Brasília. A duração é recalculada pelo serviço.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-surface-600 mb-1">Observação</label>
                <textarea
                  className="input min-h-[90px] resize-none"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Anotações sobre este agendamento..."
                />
              </div>

              {saveError && <p className="text-sm text-red-500">{saveError}</p>}
            </div>

            <div className="px-6 py-4 border-t border-surface-200 flex justify-end gap-2">
              <button onClick={() => setSelected(null)} className="btn-ghost text-sm">Cancelar</button>
              <button onClick={handleSaveAppointment} disabled={saving} className="btn-primary text-sm disabled:opacity-60">
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
