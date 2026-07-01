'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface Service {
  id: string;
  name: string;
  category: string | null;
  durationMin: number;
  priceCents: number | null;
  description: string | null;
  active: boolean;
}

const CATEGORIES = ['consulta', 'exame', 'procedimento', 'retorno', 'outros'];

function ServiceModal({ service, onClose, onSaved }: {
  service?: Service;
  onClose: () => void;
  onSaved: (s: Service) => void;
}) {
  const [name, setName]         = useState(service?.name ?? '');
  const [category, setCategory] = useState(service?.category ?? '');
  const [duration, setDuration] = useState(String(service?.durationMin ?? 30));
  const [price, setPrice]       = useState(service?.priceCents ? String(service.priceCents / 100) : '');
  const [description, setDesc]  = useState(service?.description ?? '');
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    setError('');
    try {
      const data = {
        name,
        category: category || undefined,
        durationMin: Number(duration) || 30,
        priceCents: price ? Math.round(Number(price) * 100) : undefined,
        description: description || undefined,
      };
      let result: Service;
      if (service) {
        result = await api.updateService(service.id, data) as Service;
      } else {
        result = await api.createService(data) as Service;
      }
      onSaved(result);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4">
        <div className="px-6 py-4 border-b border-surface-200 flex items-center justify-between">
          <h2 className="font-semibold text-surface-900">{service ? 'Editar Serviço' : 'Novo Serviço'}</h2>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-600 text-xl">×</button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-surface-600 mb-1">Nome *</label>
            <input type="text" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Consulta Clínica" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-surface-600 mb-1">Categoria</label>
              <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="">Selecionar...</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-600 mb-1">Duração (min)</label>
              <input type="number" className="input" value={duration} onChange={(e) => setDuration(e.target.value)} min="5" step="5" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-600 mb-1">Preço (R$)</label>
            <input type="number" className="input" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="150,00" min="0" step="0.01" />
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-600 mb-1">Descrição</label>
            <textarea className="input resize-none" rows={2} value={description} onChange={(e) => setDesc(e.target.value)} placeholder="Descrição opcional..." />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>

        <div className="px-6 py-4 border-t border-surface-200 flex justify-end gap-2">
          <button onClick={onClose} className="btn-ghost text-sm">Cancelar</button>
          <button onClick={handleSave} disabled={saving || !name.trim()} className="btn-primary text-sm disabled:opacity-60">
            {saving ? 'Salvando...' : service ? 'Salvar' : 'Criar'}
          </button>
        </div>
      </div>
    </div>
  );
}

function formatMoney(cents: number | null) {
  if (!cents) return null;
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function ServicesPage() {
  const [services, setServices]   = useState<Service[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing]     = useState<Service | null>(null);

  async function fetchServices() {
    try {
      const res = await api.getServices({ pageSize: '100' }) as { data: Service[] };
      setServices(res.data ?? []);
    } catch {
      setServices([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchServices(); }, []);

  function onSaved(s: Service) {
    setServices((prev) => {
      const idx = prev.findIndex((x) => x.id === s.id);
      if (idx !== -1) return prev.map((x) => x.id === s.id ? s : x);
      return [s, ...prev];
    });
  }

  async function toggleActive(s: Service) {
    try {
      const updated = await api.updateService(s.id, { active: !s.active }) as Service;
      setServices((prev) => prev.map((x) => x.id === updated.id ? updated : x));
    } catch { /* ignore */ }
  }

  const categoryIcon: Record<string, string> = {
    consulta: '🩺', exame: '🔬', procedimento: '⚕️', retorno: '🔁', outros: '📋',
  };

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-surface-900">Serviços</h1>
          <p className="text-surface-500 mt-1">Serviços oferecidos pela clínica</p>
        </div>
        <button
          onClick={() => { setEditing(null); setShowModal(true); }}
          className="btn-primary flex items-center gap-2"
        >
          <span>+</span>
          Novo Serviço
        </button>
      </div>

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
            {services.map((s) => (
              <div key={s.id} className={`card p-6 flex flex-col gap-3 ${!s.active ? 'opacity-50' : ''}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{categoryIcon[s.category ?? ''] ?? '🩺'}</span>
                    <div className="min-w-0">
                      <p className="font-semibold text-surface-900 truncate">{s.name}</p>
                      {s.category && (
                        <p className="text-xs text-surface-400 capitalize">{s.category}</p>
                      )}
                    </div>
                  </div>
                  {!s.active && (
                    <span className="text-[10px] px-2 py-0.5 bg-surface-100 text-surface-400 rounded font-medium flex-shrink-0">
                      Inativo
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-4 text-sm text-surface-500">
                  <span>⏱ {s.durationMin} min</span>
                  {formatMoney(s.priceCents) && (
                    <span className="font-medium text-accent-600">{formatMoney(s.priceCents)}</span>
                  )}
                </div>

                {s.description && (
                  <p className="text-xs text-surface-400 line-clamp-2">{s.description}</p>
                )}

                <div className="flex gap-2 mt-auto">
                  <button
                    onClick={() => { setEditing(s); setShowModal(true); }}
                    className="flex-1 text-xs py-1.5 rounded-lg border border-surface-200 hover:bg-surface-50 transition-colors text-surface-600"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => toggleActive(s)}
                    className={`flex-1 text-xs py-1.5 rounded-lg border transition-colors font-medium ${
                      s.active
                        ? 'border-red-200 text-red-600 hover:bg-red-50'
                        : 'border-accent-200 text-accent-600 hover:bg-accent-50'
                    }`}
                  >
                    {s.active ? 'Desativar' : 'Ativar'}
                  </button>
                </div>
              </div>
            ))}

            <button
              onClick={() => { setEditing(null); setShowModal(true); }}
              className="card-interactive p-6 border-2 border-dashed border-surface-200 flex flex-col items-center justify-center min-h-[200px] text-surface-400 hover:border-primary-300 hover:text-primary-500 transition-colors"
            >
              <span className="text-4xl mb-3">+</span>
              <p className="font-medium">Adicionar serviço</p>
              <p className="text-sm mt-1 text-center">Consultas, exames e procedimentos</p>
            </button>
          </>
        )}
      </div>

      {showModal && (
        <ServiceModal
          service={editing ?? undefined}
          onClose={() => setShowModal(false)}
          onSaved={onSaved}
        />
      )}
    </div>
  );
}
