'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Clinic {
  id: string;
  name: string;
  slug: string;
  type: string;
  email: string;
  phone: string;
  plan: string;
  active: boolean;
  suspendedAt: string | null;
  whatsappConnected: boolean;
  createdAt: string;
}

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function ClinicsListPage() {
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchClinics = async (q?: string) => {
    const token = localStorage.getItem('admin_token');
    const params = q ? `?search=${encodeURIComponent(q)}` : '';
    const res = await fetch(`${API}/api/admin/clinics${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (Array.isArray(data)) {
      setClinics(data);
    } else {
      setClinics([]);
    }
    setLoading(false);
  };

  useEffect(() => { fetchClinics(); }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchClinics(search);
  };

  const handleSuspend = async (id: string) => {
    const reason = prompt('Motivo da suspensão:');
    if (!reason) return;
    const token = localStorage.getItem('admin_token');
    await fetch(`${API}/api/admin/clinics/${id}/suspend`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ reason }),
    });
    fetchClinics();
  };

  const handleReactivate = async (id: string) => {
    const token = localStorage.getItem('admin_token');
    await fetch(`${API}/api/admin/clinics/${id}/reactivate`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
    });
    fetchClinics();
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Tem certeza que deseja EXCLUIR "${name}" e todos os dados? Esta ação é irreversível!`)) return;
    const token = localStorage.getItem('admin_token');
    const res = await fetch(`${API}/api/admin/clinics/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const e = await res.json().catch(() => ({} as any));
      alert(`Erro ao excluir: ${e.message || e.error?.message || res.status}`);
      return;
    }
    fetchClinics();
  };

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-white">Clínicas</h1>
          <p className="text-surface-400 mt-1">Gerencie todas as clínicas cadastradas</p>
        </div>
        <Link
          href="/admin/clinics/new"
          className="px-6 py-3 bg-gradient-to-r from-red-600 to-orange-500 text-white font-semibold rounded-xl hover:from-red-700 hover:to-orange-600 transition-all"
        >
          + Nova Clínica
        </Link>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="mb-6">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome ou e-mail..."
          className="input bg-surface-900 border-surface-700 text-white placeholder-surface-500 w-full max-w-md"
        />
      </form>

      {/* Table */}
      <div className="bg-surface-900 border border-surface-800 rounded-2xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-surface-800 text-surface-400 text-sm uppercase tracking-wider">
              <th className="text-left px-6 py-4">Clínica</th>
              <th className="text-left px-6 py-4">Tipo</th>
              <th className="text-left px-6 py-4">Plano</th>
              <th className="text-left px-6 py-4">WhatsApp</th>
              <th className="text-left px-6 py-4">Status</th>
              <th className="text-right px-6 py-4">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="text-center py-16 text-surface-500">
                  Carregando...
                </td>
              </tr>
            ) : clinics.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-16 text-surface-500">
                  <span className="text-4xl mb-3 block">🏥</span>
                  <p>Nenhuma clínica cadastrada</p>
                  <Link href="/admin/clinics/new" className="text-red-400 hover:text-red-300 text-sm mt-2 inline-block">
                    Criar primeira clínica →
                  </Link>
                </td>
              </tr>
            ) : (
              clinics.map((clinic) => (
                <tr key={clinic.id} className="border-b border-surface-800/50 hover:bg-surface-800/30 transition-colors">
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-semibold text-white">{clinic.name}</p>
                      <p className="text-xs text-surface-500">{clinic.email}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-surface-300 capitalize">{clinic.type === 'medical' ? 'Médica' : clinic.type === 'dental' ? 'Odonto' : clinic.type}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-primary-500/20 text-primary-300">
                      {clinic.plan}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {clinic.whatsappConnected ? (
                      <span className="text-accent-400">● Conectado</span>
                    ) : (
                      <span className="text-surface-500">○ Desconectado</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {clinic.active ? (
                      <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-accent-500/20 text-accent-300">
                        Ativa
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/20 text-red-300">
                        Suspensa
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex gap-2 justify-end">
                      <Link
                        href={`/admin/clinics/${clinic.id}`}
                        className="px-3 py-1.5 text-xs bg-surface-800 text-surface-300 rounded-lg hover:bg-surface-700 transition-colors"
                      >
                        Editar
                      </Link>
                      {clinic.active ? (
                        <button
                          onClick={() => handleSuspend(clinic.id)}
                          className="px-3 py-1.5 text-xs bg-amber-500/20 text-amber-300 rounded-lg hover:bg-amber-500/30 transition-colors"
                        >
                          Suspender
                        </button>
                      ) : (
                        <button
                          onClick={() => handleReactivate(clinic.id)}
                          className="px-3 py-1.5 text-xs bg-accent-500/20 text-accent-300 rounded-lg hover:bg-accent-500/30 transition-colors"
                        >
                          Reativar
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(clinic.id, clinic.name)}
                        className="px-3 py-1.5 text-xs bg-red-500/20 text-red-300 rounded-lg hover:bg-red-500/30 transition-colors"
                      >
                        Excluir
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
