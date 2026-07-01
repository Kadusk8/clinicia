'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';

interface Patient {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  birthDate: string | null;
  insurance: string | null;
  createdAt: string;
}

function PatientModal({ patient, onClose, onSaved }: {
  patient?: Patient;
  onClose: () => void;
  onSaved: (p: Patient) => void;
}) {
  const [name, setName]         = useState(patient?.name ?? '');
  const [phone, setPhone]       = useState(patient?.phone ?? '');
  const [email, setEmail]       = useState(patient?.email ?? '');
  const [birthDate, setBirth]   = useState(patient?.birthDate?.slice(0, 10) ?? '');
  const [insurance, setIns]     = useState(patient?.insurance ?? '');
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');

  async function handleSave() {
    if (!name.trim() || !phone.trim()) return;
    setSaving(true);
    setError('');
    try {
      const data = { name, phone, email: email || undefined, birthDate: birthDate || undefined, insurance: insurance || undefined };
      let result: Patient;
      if (patient) {
        result = await api.updatePatient(patient.id, data) as Patient;
      } else {
        result = await api.createPatient(data) as Patient;
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
          <h2 className="font-semibold text-surface-900">{patient ? 'Editar Paciente' : 'Novo Paciente'}</h2>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-600 text-xl">×</button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-surface-600 mb-1">Nome *</label>
            <input type="text" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Maria Oliveira" />
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-600 mb-1">Telefone / WhatsApp *</label>
            <input type="text" className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="5511999998888" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-surface-600 mb-1">E-mail</label>
              <input type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="maria@email.com" />
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-600 mb-1">Data de Nascimento</label>
              <input type="date" className="input" value={birthDate} onChange={(e) => setBirth(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-600 mb-1">Convênio</label>
            <input type="text" className="input" value={insurance} onChange={(e) => setIns(e.target.value)} placeholder="Unimed, Bradesco..." />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>

        <div className="px-6 py-4 border-t border-surface-200 flex justify-end gap-2">
          <button onClick={onClose} className="btn-ghost text-sm">Cancelar</button>
          <button onClick={handleSave} disabled={saving || !name.trim() || !phone.trim()} className="btn-primary text-sm disabled:opacity-60">
            {saving ? 'Salvando...' : patient ? 'Salvar' : 'Criar'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PatientsPage() {
  const [patients, setPatients]   = useState<Patient[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [page, setPage]           = useState(1);
  const [totalPages, setTotal]    = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing]     = useState<Patient | null>(null);

  const fetchPatients = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(page), pageSize: '20' };
      if (search.trim()) params.search = search.trim();
      const res = await api.getPatients(params) as { data: Patient[]; totalPages: number };
      setPatients(res.data ?? []);
      setTotal(res.totalPages ?? 1);
    } catch {
      setPatients([]);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { fetchPatients(); }, [fetchPatients]);

  // Reset page on search change
  useEffect(() => { setPage(1); }, [search]);

  function onSaved(p: Patient) {
    setPatients((prev) => {
      const idx = prev.findIndex((x) => x.id === p.id);
      if (idx !== -1) return prev.map((x) => x.id === p.id ? p : x);
      return [p, ...prev];
    });
  }

  function formatBirth(iso: string | null) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('pt-BR');
  }

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-surface-900">Pacientes</h1>
          <p className="text-surface-500 mt-1">Gerencie seus pacientes</p>
        </div>
        <button onClick={() => { setEditing(null); setShowModal(true); }} className="btn-primary flex items-center gap-2">
          <span>+</span>
          Novo Paciente
        </button>
      </div>

      {/* Search */}
      <div className="mb-6">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome, telefone ou e-mail..."
          className="input max-w-md"
        />
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="table-header">
              <th className="text-left px-6 py-4">Nome</th>
              <th className="text-left px-6 py-4">Telefone</th>
              <th className="text-left px-6 py-4">E-mail</th>
              <th className="text-left px-6 py-4">Convênio</th>
              <th className="text-left px-6 py-4">Nascimento</th>
              <th className="text-right px-6 py-4">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i} className="border-t border-surface-100">
                  {[...Array(6)].map((_, j) => (
                    <td key={j} className="px-6 py-4">
                      <div className="h-4 bg-surface-100 rounded animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
            ) : patients.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-16 text-surface-400">
                  <span className="text-4xl mb-3 block">👥</span>
                  <p>{search ? 'Nenhum paciente encontrado' : 'Nenhum paciente cadastrado'}</p>
                </td>
              </tr>
            ) : (
              patients.map((p) => (
                <tr key={p.id} className="border-t border-surface-100 hover:bg-surface-50 transition-colors">
                  <td className="px-6 py-4">
                    <p className="font-medium text-surface-800">{p.name}</p>
                  </td>
                  <td className="px-6 py-4 text-sm text-surface-600">{p.phone}</td>
                  <td className="px-6 py-4 text-sm text-surface-600">{p.email ?? '—'}</td>
                  <td className="px-6 py-4 text-sm text-surface-600">{p.insurance ?? '—'}</td>
                  <td className="px-6 py-4 text-sm text-surface-600">{formatBirth(p.birthDate)}</td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => { setEditing(p); setShowModal(true); }}
                      className="text-xs text-primary-600 hover:text-primary-800 font-medium px-3 py-1.5 rounded-lg hover:bg-primary-50 transition-colors"
                    >
                      Editar
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-surface-100 flex items-center justify-between">
            <p className="text-sm text-surface-500">Página {page} de {totalPages}</p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="text-sm px-3 py-1.5 rounded-lg border border-surface-200 hover:bg-surface-50 disabled:opacity-40 transition-colors"
              >
                ← Anterior
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="text-sm px-3 py-1.5 rounded-lg border border-surface-200 hover:bg-surface-50 disabled:opacity-40 transition-colors"
              >
                Próxima →
              </button>
            </div>
          </div>
        )}
      </div>

      {showModal && (
        <PatientModal
          patient={editing ?? undefined}
          onClose={() => setShowModal(false)}
          onSaved={onSaved}
        />
      )}
    </div>
  );
}
