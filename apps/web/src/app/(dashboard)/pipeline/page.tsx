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
  { key: 'lead',       label: 'Lead',           color: 'bg-surface-50  border-surface-200' },
  { key: 'qualified',  label: 'Qualificado',     color: 'bg-blue-50     border-blue-200' },
  { key: 'scheduled',  label: 'Agendado',        color: 'bg-amber-50    border-amber-200' },
  { key: 'attended',   label: 'Atendido',        color: 'bg-purple-50   border-purple-200' },
  { key: 'treatment',  label: 'Em Tratamento',   color: 'bg-primary-50  border-primary-200' },
  { key: 'won',        label: 'Ganho',           color: 'bg-accent-50   border-accent-200' },
  { key: 'lost',       label: 'Perdido',         color: 'bg-red-50      border-red-200' },
];

function formatMoney(cents: number | null) {
  if (!cents) return null;
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function DealCard({ deal, onMove }: { deal: Deal; onMove: (id: string, stage: string) => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const currentIdx = STAGES.findIndex((s) => s.key === deal.stage);
  const nextStages = STAGES.filter((s, i) => i !== currentIdx);

  return (
    <div className="bg-white rounded-xl border border-surface-200 p-3 shadow-sm hover:shadow-md transition-shadow relative">
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
        <div className="relative flex-shrink-0">
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
                      <DealCard key={deal.id} deal={deal} onMove={handleMove} />
                    ))
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
