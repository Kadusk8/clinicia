'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const tabs = ['Dados', 'Agente IA', 'WhatsApp', 'Ativação', 'Categorias', 'Estatísticas'];

interface ClinicData {
  id: string;
  name: string;
  slug: string;
  type: string;
  plan: string;
  phone: string;
  email: string;
  address: string;
  active: boolean;
  whatsappConnected: boolean;
  whatsappInstanceName: string;
  evolutionApiUrl: string;
  evolutionApiKey: string;
  agentConfig: Record<string, string>;
  agentSystemPrompt: string;
  agentKnowledgeBase: string;
  agentMode: 'single' | 'multi';
  users?: Array<{ id: string; name: string; email: string; role: string }>;
}

interface Stats {
  patients: number;
  appointments: number;
  conversations: number;
  deals: number;
}

interface ActivationTrigger {
  id: string;
  phrase: string;
  categoryKey: string | null;
  active: boolean;
}

interface AgentCategory {
  id: string;
  key: string;
  label: string;
  systemPrompt: string | null;
  knowledgeBase: string | null;
  active: boolean;
}

export default function EditClinicPage() {
  const { id } = useParams();
  const router = useRouter();
  const [tab, setTab] = useState(0);
  const [clinic, setClinic] = useState<ClinicData | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [saving, setSaving] = useState(false);

  // Tab 0 — Dados
  const [form, setForm] = useState({ name: '', type: '', plan: '', phone: '', email: '', address: '' });
  // Tab 1 — Agente IA
  const [agentForm, setAgentForm] = useState({ assistantName: '', tone: '', greeting: '', agentSystemPrompt: '', agentKnowledgeBase: '', provider: 'anthropic', model: 'claude-sonnet-4-5-20250514', apiKey: '' });
  // Tab 2 — WhatsApp
  const [waForm, setWaForm] = useState({ whatsappInstanceName: '', evolutionApiUrl: '', evolutionApiKey: '' });
  // Tab 3 — Ativação
  const [triggers, setTriggers] = useState<ActivationTrigger[]>([]);
  const [newPhrase, setNewPhrase] = useState('');
  const [newTriggerCategory, setNewTriggerCategory] = useState('');
  // Tab 4 — Categorias (agent_mode = 'multi')
  const [agentMode, setAgentMode] = useState<'single' | 'multi'>('single');
  const [categories, setCategories] = useState<AgentCategory[]>([]);
  const [newCategory, setNewCategory] = useState({ key: '', label: '' });

  const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  useEffect(() => {
    if (!token) return;
    fetch(`${API}/api/admin/clinics/${id}`, { headers })
      .then((r) => r.json())
      .then((c: ClinicData) => {
        setClinic(c);
        setForm({ name: c.name ?? '', type: c.type ?? '', plan: c.plan ?? '', phone: c.phone ?? '', email: c.email ?? '', address: c.address ?? '' });
        const cfg = c.agentConfig ?? {};
        setAgentForm({ assistantName: cfg.assistantName ?? '', tone: cfg.tone ?? '', greeting: cfg.greeting ?? '', agentSystemPrompt: c.agentSystemPrompt ?? '', agentKnowledgeBase: c.agentKnowledgeBase ?? '', provider: cfg.provider ?? 'anthropic', model: cfg.model ?? 'claude-sonnet-4-5-20250514', apiKey: cfg.apiKey ?? '' });
        setWaForm({ whatsappInstanceName: c.whatsappInstanceName ?? '', evolutionApiUrl: c.evolutionApiUrl ?? '', evolutionApiKey: c.evolutionApiKey ?? '' });
        setAgentMode(c.agentMode ?? 'single');
      });
    fetch(`${API}/api/admin/clinics/${id}/stats`, { headers }).then((r) => r.json()).then(setStats);
    loadTriggers();
    loadCategories();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadTriggers = async () => {
    const res = await fetch(`${API}/api/admin/clinics/${id}/activation-triggers`, { headers });
    setTriggers(await res.json());
  };

  const loadCategories = async () => {
    const res = await fetch(`${API}/api/admin/clinics/${id}/agent-categories`, { headers });
    setCategories(await res.json());
  };

  const addTrigger = async () => {
    if (!newPhrase.trim()) return;
    await fetch(`${API}/api/admin/clinics/${id}/activation-triggers`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ phrase: newPhrase.trim(), categoryKey: newTriggerCategory || undefined }),
    });
    setNewPhrase('');
    setNewTriggerCategory('');
    loadTriggers();
  };

  const toggleTrigger = async (trigger: ActivationTrigger) => {
    await fetch(`${API}/api/admin/clinics/${id}/activation-triggers/${trigger.id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ active: !trigger.active }),
    });
    loadTriggers();
  };

  const deleteTrigger = async (triggerId: string) => {
    await fetch(`${API}/api/admin/clinics/${id}/activation-triggers/${triggerId}`, {
      method: 'DELETE',
      headers,
    });
    loadTriggers();
  };

  const saveAgentMode = async (mode: 'single' | 'multi') => {
    setAgentMode(mode);
    await fetch(`${API}/api/admin/clinics/${id}/agent-mode`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ agentMode: mode }),
    });
  };

  const addCategory = async () => {
    if (!newCategory.key.trim() || !newCategory.label.trim()) return;
    await fetch(`${API}/api/admin/clinics/${id}/agent-categories`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ key: newCategory.key.trim(), label: newCategory.label.trim() }),
    });
    setNewCategory({ key: '', label: '' });
    loadCategories();
  };

  const updateCategory = async (categoryId: string, data: Partial<AgentCategory>) => {
    await fetch(`${API}/api/admin/clinics/${id}/agent-categories/${categoryId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(data),
    });
    loadCategories();
  };

  const deleteCategory = async (categoryId: string) => {
    await fetch(`${API}/api/admin/clinics/${id}/agent-categories/${categoryId}`, {
      method: 'DELETE',
      headers,
    });
    loadCategories();
  };

  const save = async () => {
    setSaving(true);
    await fetch(`${API}/api/admin/clinics/${id}`, { method: 'PUT', headers, body: JSON.stringify(form) });
    setSaving(false);
    alert('Salvo!');
  };

  const saveAgent = async () => {
    setSaving(true);
    await fetch(`${API}/api/admin/clinics/${id}/agent`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        agentConfig: { assistantName: agentForm.assistantName, tone: agentForm.tone, greeting: agentForm.greeting, provider: agentForm.provider, model: agentForm.model, apiKey: agentForm.apiKey },
        agentSystemPrompt: agentForm.agentSystemPrompt,
        agentKnowledgeBase: agentForm.agentKnowledgeBase,
      }),
    });
    setSaving(false);
    alert('Agente salvo!');
  };

  const saveWhatsApp = async () => {
    setSaving(true);
    const res = await fetch(`${API}/api/admin/clinics/${id}/whatsapp`, { method: 'PUT', headers, body: JSON.stringify(waForm) });
    const result = await res.json().catch(() => ({} as any));
    setSaving(false);
    if (!res.ok) {
      alert(`Erro ao salvar: ${result.message || res.status}`);
      return;
    }
    if (result.webhookError) {
      alert(`Dados salvos, mas falha ao configurar o webhook na Evolution Go: ${result.webhookError}`);
      return;
    }
    alert(result.whatsappConnected ? 'Integração salva e conectada!' : 'Integração salva. Aguardando conexão (escaneie o QR code na Evolution Go).');
  };

  if (!clinic) return <div className="text-surface-400 p-8">Carregando...</div>;

  const inputCls = 'input bg-surface-800 border-surface-700 text-white placeholder-surface-500';

  return (
    <div className="animate-fade-in max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <button onClick={() => router.push('/admin/clinics')} className="text-surface-500 hover:text-surface-300 text-sm mb-2 block">← Voltar</button>
          <h1 className="text-3xl font-bold text-white">{clinic.name}</h1>
          <p className="text-surface-400 text-sm">{clinic.slug} · {clinic.active ? '✅ Ativa' : '⛔ Suspensa'}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-surface-900 p-1 rounded-xl w-fit">
        {tabs.map((t, i) => (
          <button key={t} onClick={() => setTab(i)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === i ? 'bg-surface-700 text-white' : 'text-surface-400 hover:text-surface-200'}`}>{t}</button>
        ))}
      </div>

      <div className="bg-surface-900 border border-surface-800 rounded-2xl p-8">
        {tab === 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-white mb-4">Dados da Clínica</h2>
            <div>
              <label className="block text-sm font-medium text-surface-300 mb-1">Nome</label>
              <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} className={inputCls} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-surface-300 mb-1">Tipo</label>
                <select value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))} className={inputCls}>
                  <option value="medical">Médica</option>
                  <option value="dental">Odontológica</option>
                  <option value="other">Outra</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-surface-300 mb-1">Plano</label>
                <select value={form.plan} onChange={(e) => setForm((p) => ({ ...p, plan: e.target.value }))} className={inputCls}>
                  <option value="trial">Trial</option>
                  <option value="starter">Starter</option>
                  <option value="pro">Pro</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-surface-300 mb-1">Telefone</label>
                <input value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-medium text-surface-300 mb-1">E-mail</label>
                <input value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} className={inputCls} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-300 mb-1">Endereço</label>
              <input value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} className={inputCls} />
            </div>

            {clinic.users && clinic.users.length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-semibold text-surface-400 uppercase mb-3">Usuários</h3>
                {clinic.users.map((u) => (
                  <div key={u.id} className="flex items-center gap-3 bg-surface-800 rounded-xl p-3 mb-2">
                    <div className="w-8 h-8 bg-primary-500/20 rounded-full flex items-center justify-center text-primary-300 text-sm font-bold">{u.name[0]}</div>
                    <div><p className="text-white text-sm">{u.name}</p><p className="text-surface-500 text-xs">{u.email} · {u.role}</p></div>
                  </div>
                ))}
              </div>
            )}

            <button onClick={save} disabled={saving} className="px-6 py-2.5 bg-gradient-to-r from-red-600 to-orange-500 text-white font-semibold rounded-xl disabled:opacity-50 transition-all mt-4">
              {saving ? 'Salvando...' : 'Salvar Dados'}
            </button>
          </div>
        )}

        {tab === 1 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-white mb-4">Agente IA</h2>

            <div>
              <label className="block text-sm font-medium text-surface-300 mb-1">Modo do agente</label>
              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={() => saveAgentMode('single')} className={`p-3 rounded-xl border text-left ${agentMode === 'single' ? 'border-orange-500 bg-orange-500/10' : 'border-surface-700 bg-surface-800'}`}>
                  <p className="text-white text-sm font-medium">1 agente</p>
                </button>
                <button type="button" onClick={() => saveAgentMode('multi')} className={`p-3 rounded-xl border text-left ${agentMode === 'multi' ? 'border-orange-500 bg-orange-500/10' : 'border-surface-700 bg-surface-800'}`}>
                  <p className="text-white text-sm font-medium">Múltiplos agentes</p>
                </button>
              </div>
              {agentMode === 'multi' && (
                <p className="text-xs text-surface-500 mt-2">Prompt e base de conhecimento agora vêm da aba "Categorias".</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-surface-300 mb-1">Nome da assistente</label>
              <input value={agentForm.assistantName} onChange={(e) => setAgentForm((p) => ({ ...p, assistantName: e.target.value }))} className={inputCls} placeholder="Ana" />
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-300 mb-1">Tom</label>
              <select value={agentForm.tone} onChange={(e) => setAgentForm((p) => ({ ...p, tone: e.target.value }))} className={inputCls}>
                <option value="profissional_amigavel">Profissional e amigável</option>
                <option value="formal">Formal</option>
                <option value="casual">Casual</option>
                <option value="tecnico">Técnico</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-300 mb-1">Boas-vindas</label>
              <textarea value={agentForm.greeting} onChange={(e) => setAgentForm((p) => ({ ...p, greeting: e.target.value }))} className={`${inputCls} min-h-[80px]`} />
            </div>
            {agentMode === 'single' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-surface-300 mb-1">System prompt</label>
                  <textarea value={agentForm.agentSystemPrompt} onChange={(e) => setAgentForm((p) => ({ ...p, agentSystemPrompt: e.target.value }))} className={`${inputCls} min-h-[120px]`} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-surface-300 mb-1">Base de conhecimento</label>
                  <textarea value={agentForm.agentKnowledgeBase} onChange={(e) => setAgentForm((p) => ({ ...p, agentKnowledgeBase: e.target.value }))} className={`${inputCls} min-h-[120px]`} />
                </div>
              </>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-surface-300 mb-1">Provedor LLM</label>
                <select
                  value={agentForm.provider}
                  onChange={(e) => {
                    const defaultModels: Record<string, string> = {
                      anthropic: 'claude-sonnet-4-5-20250514',
                      openai: 'gpt-4o',
                      google: 'gemini-2.0-flash',
                      openrouter: 'anthropic/claude-sonnet-4-5',
                    };
                    setAgentForm((p) => ({ ...p, provider: e.target.value, model: defaultModels[e.target.value] ?? '' }));
                  }}
                  className={inputCls}
                >
                  <option value="anthropic">Anthropic (Claude)</option>
                  <option value="openai">OpenAI (GPT)</option>
                  <option value="google">Google (Gemini)</option>
                  <option value="openrouter">OpenRouter</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-surface-300 mb-1">Modelo</label>
                {agentForm.provider === 'anthropic' && (
                  <select value={agentForm.model} onChange={(e) => setAgentForm((p) => ({ ...p, model: e.target.value }))} className={inputCls}>
                    <option value="claude-sonnet-4-5-20250514">Sonnet 4.5 (padrão)</option>
                    <option value="claude-sonnet-5">Sonnet 5</option>
                    <option value="claude-haiku-4-5-20251001">Haiku 4.5 (econômico)</option>
                    <option value="claude-opus-4-8">Opus 4.8 (máximo)</option>
                  </select>
                )}
                {agentForm.provider === 'openai' && (
                  <select value={agentForm.model} onChange={(e) => setAgentForm((p) => ({ ...p, model: e.target.value }))} className={inputCls}>
                    <option value="gpt-4o">GPT-4o</option>
                    <option value="gpt-4.1">GPT-4.1</option>
                    <option value="gpt-4o-mini">GPT-4o Mini (econômico)</option>
                    <option value="o3-mini">o3 Mini</option>
                  </select>
                )}
                {agentForm.provider === 'google' && (
                  <select value={agentForm.model} onChange={(e) => setAgentForm((p) => ({ ...p, model: e.target.value }))} className={inputCls}>
                    <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
                    <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                    <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
                    <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                    <option value="gemini-1.5-flash">Gemini 1.5 Flash (econômico)</option>
                  </select>
                )}
                {agentForm.provider === 'openrouter' && (
                  <input
                    value={agentForm.model}
                    onChange={(e) => setAgentForm((p) => ({ ...p, model: e.target.value }))}
                    className={inputCls}
                    placeholder="ex: anthropic/claude-sonnet-4-5"
                  />
                )}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-300 mb-1">API Key do provedor</label>
              <input
                type="password"
                value={agentForm.apiKey}
                onChange={(e) => setAgentForm((p) => ({ ...p, apiKey: e.target.value }))}
                className={inputCls}
                placeholder={
                  agentForm.provider === 'anthropic' ? 'sk-ant-...'
                  : agentForm.provider === 'openai' ? 'sk-...'
                  : agentForm.provider === 'google' ? 'AIza...'
                  : 'sk-or-...'
                }
                autoComplete="off"
              />
              <p className="text-xs text-surface-500 mt-1">Cada clínica usa sua própria chave. A chave é armazenada na configuração do agente e usada pelo worker para esta clínica.</p>
            </div>
            <button onClick={saveAgent} disabled={saving} className="px-6 py-2.5 bg-gradient-to-r from-red-600 to-orange-500 text-white font-semibold rounded-xl disabled:opacity-50 transition-all">
              {saving ? 'Salvando...' : 'Salvar Agente'}
            </button>
          </div>
        )}

        {tab === 2 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-white mb-4">WhatsApp (Evolution Go)</h2>
            <div className={`p-4 rounded-xl border ${clinic.whatsappConnected ? 'bg-accent-500/10 border-accent-500/30' : 'bg-amber-500/10 border-amber-500/30'}`}>
              <p className={`font-medium ${clinic.whatsappConnected ? 'text-accent-300' : 'text-amber-300'}`}>
                {clinic.whatsappConnected ? '✅ WhatsApp conectado' : '⚠️ WhatsApp desconectado'}
              </p>
              {clinic.whatsappInstanceName && <p className="text-surface-400 text-sm mt-1">Instância: {clinic.whatsappInstanceName}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-300 mb-1">Nome da instância</label>
              <input value={waForm.whatsappInstanceName} onChange={(e) => setWaForm((p) => ({ ...p, whatsappInstanceName: e.target.value }))} className={inputCls} placeholder="clinica-sorriso" />
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-300 mb-1">URL da Evolution Go</label>
              <input value={waForm.evolutionApiUrl} onChange={(e) => setWaForm((p) => ({ ...p, evolutionApiUrl: e.target.value }))} className={inputCls} placeholder="https://evolution.sua-clinica.com" />
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-300 mb-1">API Key da Instância</label>
              <input value={waForm.evolutionApiKey} onChange={(e) => setWaForm((p) => ({ ...p, evolutionApiKey: e.target.value }))} className={inputCls} placeholder="Token da instância..." type="password" />
            </div>
            {waForm.whatsappInstanceName && (
              <div className="bg-surface-800 border border-surface-700 rounded-xl p-4">
                <p className="text-xs font-semibold text-surface-400 uppercase mb-2">URL do Webhook (copie para a Evolution Go)</p>
                <code className="text-xs text-accent-300 break-all select-all">
                  {API}/api/webhooks/evolution/{waForm.whatsappInstanceName}
                </code>
                <p className="text-xs text-surface-500 mt-2">Configure este webhook na Evolution Go com os eventos <strong className="text-surface-400">MESSAGES_UPSERT</strong> e <strong className="text-surface-400">CONNECTION_UPDATE</strong>. Ao salvar, o sistema tenta registrar automaticamente.</p>
              </div>
            )}
            <button onClick={saveWhatsApp} disabled={saving} className="px-6 py-2.5 bg-gradient-to-r from-red-600 to-orange-500 text-white font-semibold rounded-xl disabled:opacity-50 transition-all mt-4">
              {saving ? 'Salvando...' : 'Salvar e Registrar Webhook'}
            </button>
          </div>
        )}

        {tab === 3 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-white mb-1">Gatilhos de Ativação</h2>
            <p className="text-surface-400 text-sm mb-4">
              Conversas novas nascem sem a IA ativa. Quando o paciente manda uma mensagem que contém
              uma dessas frases (sem diferenciar maiúsculas/minúsculas), a IA assume a conversa a
              partir dali. Sem nenhum gatilho ativo, a IA nunca liga sozinha.
            </p>

            <div className="flex gap-2">
              <input
                value={newPhrase}
                onChange={(e) => setNewPhrase(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addTrigger()}
                className={inputCls}
                placeholder="ex: quero agendar"
              />
              {agentMode === 'multi' && (
                <select value={newTriggerCategory} onChange={(e) => setNewTriggerCategory(e.target.value)} className={`${inputCls} max-w-[220px]`}>
                  <option value="">Sem categoria</option>
                  {categories.map((c) => (
                    <option key={c.key} value={c.key}>{c.label}</option>
                  ))}
                </select>
              )}
              <button onClick={addTrigger} className="px-4 py-2.5 bg-gradient-to-r from-red-600 to-orange-500 text-white font-semibold rounded-xl whitespace-nowrap">
                + Adicionar
              </button>
            </div>

            <div className="space-y-2 mt-4">
              {triggers.length === 0 && (
                <p className="text-surface-500 text-sm">Nenhum gatilho cadastrado.</p>
              )}
              {triggers.map((t) => (
                <div key={t.id} className="flex items-center justify-between bg-surface-800 rounded-xl p-3">
                  <div>
                    <span className={`text-sm ${t.active ? 'text-white' : 'text-surface-500 line-through'}`}>{t.phrase}</span>
                    {t.categoryKey && (
                      <span className="ml-2 text-xs px-2 py-0.5 rounded-lg bg-primary-500/20 text-primary-300">
                        {categories.find((c) => c.key === t.categoryKey)?.label ?? t.categoryKey}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => toggleTrigger(t)}
                      className={`text-xs px-2 py-1 rounded-lg ${t.active ? 'bg-accent-500/20 text-accent-300' : 'bg-surface-700 text-surface-400'}`}
                    >
                      {t.active ? 'Ativo' : 'Inativo'}
                    </button>
                    <button onClick={() => deleteTrigger(t.id)} className="text-surface-500 hover:text-red-400 text-sm">
                      Remover
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 4 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-white mb-1">Categorias do Agente</h2>
            <p className="text-surface-400 text-sm mb-4">
              Só têm efeito com o modo "Múltiplos agentes" ativo (aba Agente IA). Cada categoria tem
              seu próprio prompt e base de conhecimento; a IA escolhe qual usar por mensagem.
            </p>

            <div className="flex gap-2">
              <input
                value={newCategory.key}
                onChange={(e) => setNewCategory((p) => ({ ...p, key: e.target.value.toLowerCase().replace(/[^a-z0-9_]+/g, '_') }))}
                className={`${inputCls} max-w-[220px]`}
                placeholder="key (ex: atm_ortognatica)"
              />
              <input
                value={newCategory.label}
                onChange={(e) => setNewCategory((p) => ({ ...p, label: e.target.value }))}
                className={inputCls}
                placeholder="Nome legível (ex: Cirurgia Ortognática)"
              />
              <button onClick={addCategory} className="px-4 py-2.5 bg-gradient-to-r from-red-600 to-orange-500 text-white font-semibold rounded-xl whitespace-nowrap">
                + Adicionar
              </button>
            </div>

            <div className="space-y-4 mt-4">
              {categories.length === 0 && (
                <p className="text-surface-500 text-sm">Nenhuma categoria cadastrada.</p>
              )}
              {categories.map((c) => (
                <div key={c.id} className="bg-surface-800 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-white font-medium">{c.label}</p>
                      <p className="text-surface-500 text-xs">{c.key}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => updateCategory(c.id, { active: !c.active })}
                        className={`text-xs px-2 py-1 rounded-lg ${c.active ? 'bg-accent-500/20 text-accent-300' : 'bg-surface-700 text-surface-400'}`}
                      >
                        {c.active ? 'Ativa' : 'Inativa'}
                      </button>
                      <button onClick={() => deleteCategory(c.id)} className="text-surface-500 hover:text-red-400 text-sm">
                        Remover
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-surface-400 mb-1">System prompt</label>
                    <textarea
                      defaultValue={c.systemPrompt ?? ''}
                      onBlur={(e) => updateCategory(c.id, { systemPrompt: e.target.value })}
                      className={`${inputCls} min-h-[90px]`}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-surface-400 mb-1">Base de conhecimento</label>
                    <textarea
                      defaultValue={c.knowledgeBase ?? ''}
                      onBlur={(e) => updateCategory(c.id, { knowledgeBase: e.target.value })}
                      className={`${inputCls} min-h-[90px]`}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 5 && stats && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-white mb-4">Estatísticas</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Pacientes', value: stats.patients, icon: '👥' },
                { label: 'Consultas', value: stats.appointments, icon: '📅' },
                { label: 'Conversas', value: stats.conversations, icon: '💬' },
                { label: 'Deals', value: stats.deals, icon: '📈' },
              ].map((s) => (
                <div key={s.label} className="bg-surface-800 rounded-xl p-4 text-center">
                  <span className="text-2xl">{s.icon}</span>
                  <p className="text-2xl font-bold text-white mt-2">{s.value}</p>
                  <p className="text-xs text-surface-400">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
