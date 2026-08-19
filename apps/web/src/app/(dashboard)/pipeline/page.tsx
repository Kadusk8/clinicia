'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface Deal {
  id: string;
  stage: string;
  valueCents: number | null;
  notes: string | null;
  patientId: string;
  serviceId: string | null;
  patientName: string | null;
  patientPhone: string | null;
  serviceName: string | null;
  createdAt: string;
  updatedAt: string;
}

const STAGES = [
  { key: 'lead_novo',       label: 'Lead Novo (Fila de Espera)',       color: 'bg-surface-50  border-surface-200' },
  { key: 'triagem',         label: 'Triagem Concluída',                color: 'bg-blue-50     border-blue-200' },
  { key: 'agendado',        label: 'Agendamento Realizado (A Confirmar)', color: 'bg-amber-50    border-amber-200' },
  { key: 'presenca_confirmada', label: 'Presença Confirmada',          color: 'bg-accent-50   border-accent-200' },
  { key: 'faltou_remarcar', label: 'Faltou / Remarcar',                color: 'bg-red-50      border-red-200' },
];

const APPOINTMENT_STATUS_LABELS: Record<string, string> = {
  scheduled: 'Agendada',
  confirmed: 'Confirmada',
  completed: 'Realizada',
  no_show: 'Faltou',
  cancelled: 'Cancelada',
};

interface PatientDetail {
  id: string;
  name: string | null;
  phone: string;
  email: string | null;
  insurance: string | null;
  notes: string | null;
  tags: string[] | null;
  contactReason: string | null;
  firstVisit: boolean | null;
  urgencyLevel: string | null;
  complaintSummary: string | null;
}

const URGENCY_LABELS: Record<string, { label: string; color: string }> = {
  alta: { label: 'Urgência Alta', color: 'bg-red-100 text-red-700' },
  media: { label: 'Urgência Média', color: 'bg-amber-100 text-amber-700' },
  baixa: { label: 'Urgência Baixa', color: 'bg-surface-100 text-surface-600' },
};

interface PatientHistoryDeal {
  id: string;
  stage: string;
  valueCents: number | null;
  serviceName: string | null;
  createdAt: string;
  updatedAt: string;
}

interface PatientHistoryAppointment {
  id: string;
  status: string;
  startsAt: string;
  serviceName: string | null;
  professionalName: string | null;
}

interface PatientHistory {
  patient: PatientDetail;
  servicesSought: string[];
  deals: PatientHistoryDeal[];
  appointments: PatientHistoryAppointment[];
}

function formatMoney(cents: number | null) {
  if (!cents) return null;
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function PatientDetailModal({ patientId, onClose }: { patientId: string; onClose: () => void }) {
  const [data, setData] = useState<PatientHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    api.getPatientHistory(patientId)
      .then((res) => { if (!cancelled) setData(res as PatientHistory); })
      .catch(() => { if (!cancelled) setError('Não foi possível carregar os dados do paciente.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [patientId]);

  type TimelineItem =
    | { kind: 'deal'; date: string; item: PatientHistoryDeal }
    | { kind: 'appointment'; date: string; item: PatientHistoryAppointment };

  const timeline: TimelineItem[] = data
    ? [
        ...data.deals.map((d): TimelineItem => ({ kind: 'deal', date: d.updatedAt, item: d })),
        ...data.appointments.map((a): TimelineItem => ({ kind: 'appointment', date: a.startsAt, item: a })),
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col">
        <div className="px-6 py-4 border-b border-surface-200 flex items-center justify-between flex-shrink-0">
          <h2 className="font-semibold text-surface-900">
            {data?.patient.name ?? 'Paciente'}
          </h2>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-600 text-xl">×</button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6">
          {loading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-4 bg-surface-100 rounded animate-pulse" />
              ))}
            </div>
          ) : error ? (
            <p className="text-sm text-red-500">{error}</p>
          ) : data ? (
            <>
              {/* Contact info */}
              <div className="space-y-1 text-sm">
                <p className="text-surface-600">📞 {data.patient.phone}</p>
                {data.patient.email && <p className="text-surface-600">✉️ {data.patient.email}</p>}
                {data.patient.insurance && <p className="text-surface-600">🏥 {data.patient.insurance}</p>}
                {data.patient.firstVisit !== null && (
                  <p className="text-surface-600">
                    {data.patient.firstVisit ? '🆕 Primeira vez na clínica' : '🔁 Paciente recorrente'}
                  </p>
                )}
                {data.patient.notes && (
                  <p className="text-surface-500 text-xs mt-2 italic">{data.patient.notes}</p>
                )}
              </div>

              {/* Qualification data */}
              {(data.patient.contactReason || data.patient.urgencyLevel || data.patient.complaintSummary) && (
                <div>
                  <h3 className="text-xs font-semibold text-surface-400 uppercase mb-2">Qualificação</h3>
                  <div className="space-y-2 text-sm">
                    {data.patient.contactReason && (
                      <p className="text-surface-700">
                        <span className="text-surface-400">Motivo do contato:</span> {data.patient.contactReason}
                      </p>
                    )}
                    {data.patient.urgencyLevel && URGENCY_LABELS[data.patient.urgencyLevel] && (
                      <span className={`inline-block text-xs px-2 py-1 rounded-full font-medium ${URGENCY_LABELS[data.patient.urgencyLevel]!.color}`}>
                        {URGENCY_LABELS[data.patient.urgencyLevel]!.label}
                      </span>
                    )}
                    {data.patient.complaintSummary && (
                      <p className="text-surface-500 text-xs italic">"{data.patient.complaintSummary}"</p>
                    )}
                  </div>
                </div>
              )}

              {/* Services sought */}
              {data.servicesSought.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-surface-400 uppercase mb-2">Serviços buscados</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {data.servicesSought.map((s) => (
                      <span key={s} className="badge-neutral text-xs">{s}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* History timeline */}
              <div>
                <h3 className="text-xs font-semibold text-surface-400 uppercase mb-2">Histórico</h3>
                {timeline.length === 0 ? (
                  <p className="text-sm text-surface-400">Sem histórico ainda.</p>
                ) : (
                  <div className="space-y-2">
                    {timeline.map((t) => (
                      <div
                        key={`${t.kind}-${t.item.id}`}
                        className="flex items-start gap-3 p-2.5 rounded-lg bg-surface-50 border border-surface-100"
                      >
                        <span className="text-base flex-shrink-0">
                          {t.kind === 'deal' ? '📈' : '📅'}
                        </span>
                        <div className="min-w-0 flex-1">
                          {t.kind === 'deal' ? (
                            <p className="text-sm text-surface-700">
                              Deal movido para <span className="font-medium">{STAGES.find((s) => s.key === t.item.stage)?.label ?? t.item.stage}</span>
                              {t.item.serviceName && <> — {t.item.serviceName}</>}
                              {formatMoney(t.item.valueCents) && <> ({formatMoney(t.item.valueCents)})</>}
                            </p>
                          ) : (
                            <p className="text-sm text-surface-700">
                              Consulta {APPOINTMENT_STATUS_LABELS[t.item.status] ?? t.item.status}
                              {t.item.serviceName && <> — {t.item.serviceName}</>}
                              {t.item.professionalName && <> com {t.item.professionalName}</>}
                            </p>
                          )}
                          <p className="text-xs text-surface-400 mt-0.5">{formatDateTime(t.date)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function DealCard({ deal, onMove, onOpen }: { deal: Deal; onMove: (id: string, stage: string) => void; onOpen: (patientId: string) => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const currentIdx = STAGES.findIndex((s) => s.key === deal.stage);
  const nextStages = STAGES.filter((s, i) => i !== currentIdx);

  return (
    <div
      onClick={() => onOpen(deal.patientId)}
      className="bg-white rounded-xl border border-surface-200 p-3 shadow-sm hover:shadow-md transition-shadow relative cursor-pointer"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium text-sm text-surface-800 truncate">
            {deal.patientName ?? deal.patientPhone ?? 'Paciente'}
          </p>
          {deal.serviceName && (
            <p className="text-xs text-surface-400 truncate mt-0.5">{deal.serviceName}</p>
          )}
          {formatMoney(deal.valueCents) && (
            <p className="text-xs font-medium text-accent-600 mt-1">{formatMoney(deal.valueCents)}</p>
          )}
        </div>
        <div className="relative flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="w-6 h-6 flex items-center justify-center text-surface-400 hover:text-surface-600 rounded hover:bg-surface-100 text-xs"
          >
            ⋯
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-7 z-20 bg-white border border-surface-200 rounded-xl shadow-lg py-1 w-40">
                <p className="px-3 py-1 text-[10px] text-surface-400 uppercase font-medium">Mover para</p>
                {nextStages.map((s) => (
                  <button
                    key={s.key}
                    onClick={() => { onMove(deal.id, s.key); setMenuOpen(false); }}
                    className="w-full text-left px-3 py-1.5 text-xs hover:bg-surface-50 text-surface-700"
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PipelinePage() {
  const [kanban, setKanban] = useState<Record<string, Deal[]>>({});
  const [loading, setLoading] = useState(true);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [openPatientId, setOpenPatientId] = useState<string | null>(null);

  async function fetchKanban() {
    try {
      const data = await api.getKanban() as Record<string, Deal[]>;
      setKanban(data ?? {});
    } catch {
      setKanban({});
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchKanban(); }, []);

  async function handleMove(id: string, newStage: string) {
    if (movingId) return;
    setMovingId(id);

    // Optimistic update
    setKanban((prev) => {
      const next = { ...prev };
      let movedDeal: Deal | undefined;
      for (const key of Object.keys(next)) {
        const idx = next[key]!.findIndex((d) => d.id === id);
        if (idx !== -1) {
          movedDeal = { ...next[key]![idx]!, stage: newStage };
          next[key] = next[key]!.filter((d) => d.id !== id);
          break;
        }
      }
      if (movedDeal) {
        next[newStage] = [movedDeal, ...(next[newStage] ?? [])];
      }
      return next;
    });

    try {
      await api.updateDealStage(id, newStage);
    } catch {
      // On failure, re-fetch
      await fetchKanban();
    } finally {
      setMovingId(null);
    }
  }

  const totalDeals = Object.values(kanban).reduce((n, arr) => n + arr.length, 0);

  return (
    <div className="animate-fade-in flex flex-col" style={{ height: 'calc(100vh - 80px)' }}>
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div>
          <h1 className="text-3xl font-bold text-surface-900">Pipeline</h1>
          <p className="text-surface-500 mt-1">
            {loading ? 'Carregando...' : `${totalDeals} deal${totalDeals !== 1 ? 's' : ''} no funil`}
          </p>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex gap-4 overflow-x-auto pb-4 flex-1">
        {STAGES.map((stage) => {
          const deals = kanban[stage.key] ?? [];
          return (
            <div key={stage.key} className="flex-shrink-0 w-64 flex flex-col">
              <div className={`rounded-xl border flex-1 flex flex-col ${stage.color}`}>
                <div className="flex items-center justify-between px-3 py-3 border-b border-inherit">
                  <h3 className="font-semibold text-sm text-surface-700">{stage.label}</h3>
                  <span className="badge-neutral text-xs">{deals.length}</span>
                </div>

                <div className="flex-1 p-2 space-y-2 overflow-y-auto">
                  {loading ? (
                    <div className="space-y-2">
                      {[...Array(2)].map((_, i) => (
                        <div key={i} className="h-16 bg-surface-100 rounded-xl animate-pulse" />
                      ))}
                    </div>
                  ) : deals.length === 0 ? (
                    <div className="border-2 border-dashed border-surface-200 rounded-xl p-4 text-center text-surface-400 text-xs">
                      Nenhum deal
                    </div>
                  ) : (
                    deals.map((deal) => (
                      <DealCard key={deal.id} deal={deal} onMove={handleMove} onOpen={setOpenPatientId} />
                    ))
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {openPatientId && (
        <PatientDetailModal patientId={openPatientId} onClose={() => setOpenPatientId(null)} />
      )}
    </div>
  );
}
