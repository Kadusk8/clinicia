'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const tabs = ['Dados', 'Agente IA', 'WhatsApp', 'Estatísticas'];

export default function EditClinicPage() {
  const { id } = useParams();
  const router = useRouter();
  const [tab, setTab] = useState(0);
  const [clinic, setClinic] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  useEffect(() => {
    if (!token) return;
    fetch(`${API}/api/admin/clinics/${id}`, { headers }).then(r => r.json()).then(setClinic);
    fetch(`${API}/api/admin/clinics/${id}/stats`, { headers }).then(r => r.json()).then(setStats);
  }, [id]);

  const save = async (data: any) => {
    setSaving(true);
    await fetch(`${API}/api/admin/clinics/${id}`, { method: 'PUT', headers, body: JSON.stringify(data) });
    setSaving(false);
    alert('Salvo!');
  };

  const saveAgent = async (data: any) => {
    setSaving(true);
    await fetch(`${API}/api/admin/clinics/${id}/agent`, { method: 'PUT', headers, body: JSON.stringify(data) });
    setSaving(false);
    alert('Agente salvo!');
  };

  const saveWhatsApp = async (data: any) => {
    setSaving(true);
    await fetch(`${API}/api/admin/clinics/${id}/whatsapp`, { method: 'PUT', headers, body: JSON.stringify(data) });
    setSaving(false);
    alert('Integração salva!');
  };

  if (!clinic) return <div className="text-surface-400 p-8">Carregando...</div>;

  const inputCls = 'input bg-surface-800 border-surface-700 text-white placeholder-surface-500';
  const agentCfg = clinic.agentConfig || {};

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
            <div><label className="block text-sm font-medium text-surface-300 mb-1">Nome</label><input defaultValue={clinic.name} onBlur={(e) => (clinic.name = e.target.value)} className={inputCls} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-sm font-medium text-surface-300 mb-1">Tipo</label><select defaultValue={clinic.type} onBlur={(e) => (clinic.type = e.target.value)} className={inputCls}><option value="medical">Médica</option><option value="dental">Odontológica</option><option value="other">Outra</option></select></div>
              <div><label className="block text-sm font-medium text-surface-300 mb-1">Plano</label><select defaultValue={clinic.plan} onBlur={(e) => (clinic.plan = e.target.value)} className={inputCls}><option value="trial">Trial</option><option value="starter">Starter</option><option value="pro">Pro</option><option value="enterprise">Enterprise</option></select></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-sm font-medium text-surface-300 mb-1">Telefone</label><input defaultValue={clinic.phone} onBlur={(e) => (clinic.phone = e.target.value)} className={inputCls} /></div>
              <div><label className="block text-sm font-medium text-surface-300 mb-1">E-mail</label><input defaultValue={clinic.email} onBlur={(e) => (clinic.email = e.target.value)} className={inputCls} /></div>
            </div>
            <div><label className="block text-sm font-medium text-surface-300 mb-1">Endereço</label><input defaultValue={clinic.address} onBlur={(e) => (clinic.address = e.target.value)} className={inputCls} /></div>

            {/* Users */}
            {clinic.users?.length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-semibold text-surface-400 uppercase mb-3">Usuários</h3>
                {clinic.users.map((u: any) => (
                  <div key={u.id} className="flex items-center gap-3 bg-surface-800 rounded-xl p-3 mb-2">
                    <div className="w-8 h-8 bg-primary-500/20 rounded-full flex items-center justify-center text-primary-300 text-sm font-bold">{u.name[0]}</div>
                    <div><p className="text-white text-sm">{u.name}</p><p className="text-surface-500 text-xs">{u.email} · {u.role}</p></div>
                  </div>
                ))}
              </div>
            )}

            <button onClick={() => save({ name: clinic.name, type: clinic.type, plan: clinic.plan, phone: clinic.phone, email: clinic.email, address: clinic.address })} disabled={saving} className="px-6 py-2.5 bg-gradient-to-r from-red-600 to-orange-500 text-white font-semibold rounded-xl disabled:opacity-50 transition-all mt-4">{saving ? 'Salvando...' : 'Salvar Dados'}</button>
          </div>
        )}

        {tab === 1 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-white mb-4">Agente IA</h2>
            <div><label className="block text-sm font-medium text-surface-300 mb-1">Nome da assistente</label><input defaultValue={agentCfg.assistantName} onBlur={(e) => (agentCfg.assistantName = e.target.value)} className={inputCls} placeholder="Ana" /></div>
            <div><label className="block text-sm font-medium text-surface-300 mb-1">Tom</label><select defaultValue={agentCfg.tone} onBlur={(e) => (agentCfg.tone = e.target.value)} className={inputCls}><option value="profissional_amigavel">Profissional e amigável</option><option value="formal">Formal</option><option value="casual">Casual</option><option value="tecnico">Técnico</option></select></div>
            <div><label className="block text-sm font-medium text-surface-300 mb-1">Boas-vindas</label><textarea defaultValue={agentCfg.greeting} onBlur={(e) => (agentCfg.greeting = e.target.value)} className={`${inputCls} min-h-[80px]`} /></div>
            <div><label className="block text-sm font-medium text-surface-300 mb-1">System prompt</label><textarea defaultValue={clinic.agentSystemPrompt} onBlur={(e) => (clinic.agentSystemPrompt = e.target.value)} className={`${inputCls} min-h-[120px]`} /></div>
            <div><label className="block text-sm font-medium text-surface-300 mb-1">Base de conhecimento</label><textarea defaultValue={clinic.agentKnowledgeBase} onBlur={(e) => (clinic.agentKnowledgeBase = e.target.value)} className={`${inputCls} min-h-[120px]`} /></div>
            <button onClick={() => saveAgent({ agentConfig: agentCfg, agentSystemPrompt: clinic.agentSystemPrompt, agentKnowledgeBase: clinic.agentKnowledgeBase })} disabled={saving} className="px-6 py-2.5 bg-gradient-to-r from-red-600 to-orange-500 text-white font-semibold rounded-xl disabled:opacity-50 transition-all">{saving ? 'Salvando...' : 'Salvar Agente'}</button>
          </div>
        )}

        {tab === 2 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-white mb-4">WhatsApp (Evolution API)</h2>
            <div className={`p-4 rounded-xl border ${clinic.whatsappConnected ? 'bg-accent-500/10 border-accent-500/30' : 'bg-amber-500/10 border-amber-500/30'}`}>
              <p className={`font-medium ${clinic.whatsappConnected ? 'text-accent-300' : 'text-amber-300'}`}>{clinic.whatsappConnected ? '✅ WhatsApp conectado' : '⚠️ WhatsApp desconectado'}</p>
              {clinic.whatsappInstanceName && <p className="text-surface-400 text-sm mt-1">Instância: {clinic.whatsappInstanceName}</p>}
            </div>
            <div><label className="block text-sm font-medium text-surface-300 mb-1">Nome da instância Evolution</label><input defaultValue={clinic.whatsappInstanceName} onBlur={(e) => (clinic.whatsappInstanceName = e.target.value)} className={inputCls} placeholder="clinica-sorriso" /></div>
            <div><label className="block text-sm font-medium text-surface-300 mb-1">URL da API (Evolution Go)</label><input defaultValue={clinic.evolutionApiUrl} onBlur={(e) => (clinic.evolutionApiUrl = e.target.value)} className={inputCls} placeholder="https://evolution.sua-clinica.com" /></div>
            <div><label className="block text-sm font-medium text-surface-300 mb-1">API Key da Instância (Token)</label><input defaultValue={clinic.evolutionApiKey} onBlur={(e) => (clinic.evolutionApiKey = e.target.value)} className={inputCls} placeholder="Token da instância..." type="password" /></div>
            <button onClick={() => saveWhatsApp({ whatsappInstanceName: clinic.whatsappInstanceName, evolutionApiUrl: clinic.evolutionApiUrl, evolutionApiKey: clinic.evolutionApiKey })} disabled={saving} className="px-6 py-2.5 bg-gradient-to-r from-red-600 to-orange-500 text-white font-semibold rounded-xl disabled:opacity-50 transition-all mt-4">{saving ? 'Salvando...' : 'Salvar Integração'}</button>
            <p className="text-surface-500 text-sm mt-4">A conexão com o WhatsApp via QR Code será implementada na integração com a Evolution API.</p>
          </div>
        )}

        {tab === 3 && stats && (
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
