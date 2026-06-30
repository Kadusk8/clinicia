'use client';

import { useEffect, useState, useRef } from 'react';
import { api } from '@/lib/api';

interface ClinicData {
  id: string;
  name: string;
  slug: string;
  type: string;
  timezone: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  whatsappConnected: boolean | null;
  plan: string | null;
  active: boolean | null;
  trialEndsAt: string | null;
}

interface KbDocument {
  id: string;
  title: string;
  source: string | null;
  createdAt: string;
}

export default function SettingsPage() {
  const [clinic, setClinic] = useState<ClinicData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Form state
  const [name, setName]       = useState('');
  const [phone, setPhone]     = useState('');
  const [email, setEmail]     = useState('');
  const [address, setAddress] = useState('');

  // Knowledge Base state
  const [kbDocs, setKbDocs]         = useState<KbDocument[]>([]);
  const [kbTitle, setKbTitle]       = useState('');
  const [kbContent, setKbContent]   = useState('');
  const [kbSaving, setKbSaving]     = useState(false);
  const [kbDeleting, setKbDeleting] = useState<string | null>(null);

  useEffect(() => {
    api.getMe()
      .then((data) => {
        const c = data as ClinicData;
        setClinic(c);
        setName(c.name ?? '');
        setPhone(c.phone ?? '');
        setEmail(c.email ?? '');
        setAddress(c.address ?? '');
      })
      .catch(() => null)
      .finally(() => setLoading(false));

    api.getKnowledgeBase()
      .then((data) => setKbDocs(data as KbDocument[]))
      .catch(() => null);
  }, []);

  async function handleKbAdd() {
    if (!kbTitle.trim() || !kbContent.trim() || kbSaving) return;
    setKbSaving(true);
    try {
      const doc = await api.createKnowledgeBaseDoc({ title: kbTitle.trim(), content: kbContent.trim() }) as KbDocument;
      setKbDocs((prev) => [...prev, doc]);
      setKbTitle('');
      setKbContent('');
    } catch {
      // noop
    } finally {
      setKbSaving(false);
    }
  }

  async function handleKbDelete(id: string) {
    if (kbDeleting) return;
    setKbDeleting(id);
    try {
      await api.deleteKnowledgeBaseDoc(id);
      setKbDocs((prev) => prev.filter((d) => d.id !== id));
    } catch {
      // noop
    } finally {
      setKbDeleting(null);
    }
  }

  async function handleSave() {
    if (!clinic || saving) return;
    setSaving(true);
    setSaved(false);
    try {
      const updated = await api.updateMe({ name, phone, email, address }) as ClinicData;
      setClinic(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      // noop
    } finally {
      setSaving(false);
    }
  }

  const planLabel: Record<string, string> = {
    trial: 'Período de teste',
    starter: 'Starter',
    pro: 'Pro',
    enterprise: 'Enterprise',
  };

  return (
    <div className="animate-fade-in max-w-3xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-surface-900">Configurações</h1>
        <p className="text-surface-500 mt-1">Dados da sua clínica</p>
      </div>

      <div className="space-y-6">
        {/* Clinic Info */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-surface-900 mb-4">Dados da Clínica</h2>

          {loading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-10 bg-surface-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-surface-600 mb-1">Nome</label>
                <input
                  type="text"
                  className="input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-surface-600 mb-1">Telefone</label>
                  <input
                    type="text"
                    className="input"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(11) 99999-9999"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-surface-600 mb-1">E-mail</label>
                  <input
                    type="email"
                    className="input"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="contato@clinica.com"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-surface-600 mb-1">Endereço</label>
                <input
                  type="text"
                  className="input"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Rua, número, bairro, cidade"
                />
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="btn-primary disabled:opacity-60"
                >
                  {saving ? 'Salvando...' : 'Salvar'}
                </button>
                {saved && (
                  <span className="text-sm text-accent-600 font-medium">Salvo com sucesso!</span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Plan / Billing */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-surface-900 mb-4">Assinatura</h2>
          {clinic && (
            <div className="flex items-center gap-4 p-4 bg-accent-50 border border-accent-200 rounded-xl">
              <span className="text-2xl">✨</span>
              <div>
                <p className="font-medium text-accent-800">
                  {planLabel[clinic.plan ?? 'trial'] ?? clinic.plan}
                </p>
                {clinic.trialEndsAt && (
                  <p className="text-sm text-accent-600">
                    Teste até {new Date(clinic.trialEndsAt).toLocaleDateString('pt-BR')}
                  </p>
                )}
                {!clinic.trialEndsAt && (
                  <p className="text-sm text-accent-600">Gerenciado pelo administrador da plataforma</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* WhatsApp / Agent (read-only) */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-surface-900 mb-4">Agente IA e WhatsApp</h2>
          <div className="flex items-center gap-4 p-4 bg-primary-50 border border-primary-200 rounded-xl">
            <span className="text-2xl">
              {clinic?.whatsappConnected ? '🟢' : '⚪'}
            </span>
            <div>
              <p className="font-medium text-primary-800">
                WhatsApp {clinic?.whatsappConnected ? 'conectado' : 'não configurado'}
              </p>
              <p className="text-sm text-primary-600">
                A configuração do agente IA e integração com WhatsApp é gerenciada pelo administrador da plataforma.
              </p>
            </div>
          </div>
        </div>

        {/* Knowledge Base */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-surface-900 mb-1">Base de Conhecimento</h2>
          <p className="text-sm text-surface-400 mb-4">
            Documentos que o agente IA consulta para responder perguntas sobre sua clínica.
          </p>

          {/* Existing docs */}
          {kbDocs.length > 0 && (
            <div className="space-y-2 mb-4">
              {kbDocs.map((doc) => (
                <div key={doc.id} className="flex items-center gap-3 p-3 rounded-xl bg-surface-50 border border-surface-200">
                  <span className="text-lg">📄</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-surface-800 truncate">{doc.title}</p>
                    <p className="text-xs text-surface-400">
                      {new Date(doc.createdAt).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  <button
                    onClick={() => handleKbDelete(doc.id)}
                    disabled={kbDeleting === doc.id}
                    className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50 transition-colors disabled:opacity-50"
                  >
                    {kbDeleting === doc.id ? '...' : 'Remover'}
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add new document */}
          <div className="border border-surface-200 rounded-xl p-4 space-y-3">
            <p className="text-sm font-medium text-surface-700">Adicionar documento</p>
            <div>
              <label className="block text-xs font-medium text-surface-500 mb-1">Título</label>
              <input
                type="text"
                className="input text-sm"
                value={kbTitle}
                onChange={(e) => setKbTitle(e.target.value)}
                placeholder="Ex: Perguntas Frequentes, Convênios aceitos..."
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-surface-500 mb-1">Conteúdo</label>
              <textarea
                className="input text-sm resize-none"
                rows={5}
                value={kbContent}
                onChange={(e) => setKbContent(e.target.value)}
                placeholder="Cole aqui o texto que o agente IA deve conhecer..."
              />
            </div>
            <button
              onClick={handleKbAdd}
              disabled={kbSaving || !kbTitle.trim() || !kbContent.trim()}
              className="btn-primary text-sm disabled:opacity-60"
            >
              {kbSaving ? 'Salvando e indexando...' : 'Adicionar à base'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
