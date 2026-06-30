'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const steps = ['Dados da Clínica', 'Acesso (Login)', 'Agente IA', 'Revisão'];

export default function NewClinicPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '', slug: '', type: 'medical', phone: '', email: '', address: '', plan: 'trial',
    ownerName: '', ownerEmail: '', ownerPassword: '',
    assistantName: '', greeting: '', agentSystemPrompt: '', agentKnowledgeBase: '', tone: 'profissional_amigavel',
  });

  const set = (f: string, v: string) => setForm((p) => ({ ...p, [f]: v }));
  const autoSlug = (n: string) => { set('name', n); set('slug', n.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')); };
  const next = () => setStep((s) => Math.min(s + 1, 3));
  const prev = () => setStep((s) => Math.max(s - 1, 0));

  const submit = async () => {
    setLoading(true); setError('');
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch(`${API}/api/admin/clinics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          ...form,
          agentConfig: { assistantName: form.assistantName, greeting: form.greeting, tone: form.tone },
        }),
      });
      if (!res.ok) throw new Error((await res.json()).message || 'Erro');
      router.push('/admin/clinics');
    } catch (e: any) { setError(e.message); setLoading(false); }
  };

  const inputCls = 'input bg-surface-800 border-surface-700 text-white placeholder-surface-500';

  return (
    <div className="animate-fade-in max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold text-white mb-2">Nova Clínica</h1>
      <p className="text-surface-400 mb-8">Cadastre e configure uma nova clínica</p>

      {/* Steps */}
      <div className="flex gap-2 mb-8">
        {steps.map((s, i) => (
          <div key={s} className="flex-1">
            <div className={`h-1.5 rounded-full ${i <= step ? 'bg-gradient-to-r from-red-500 to-orange-500' : 'bg-surface-800'}`} />
            <p className={`text-xs mt-2 ${i <= step ? 'text-surface-300' : 'text-surface-600'}`}>{s}</p>
          </div>
        ))}
      </div>

      {error && <div className="mb-6 p-4 bg-red-500/20 border border-red-500/30 rounded-xl text-red-300">{error}</div>}

      <div className="bg-surface-900 border border-surface-800 rounded-2xl p-8">
        {step === 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-white mb-4">Dados da Clínica</h2>
            <div><label className="block text-sm font-medium text-surface-300 mb-1">Nome *</label><input value={form.name} onChange={(e) => autoSlug(e.target.value)} className={inputCls} placeholder="Clínica Sorriso" /></div>
            <div><label className="block text-sm font-medium text-surface-300 mb-1">Slug</label><input value={form.slug} onChange={(e) => set('slug', e.target.value)} className={inputCls} placeholder="clinica-sorriso" /></div>
            <div><label className="block text-sm font-medium text-surface-300 mb-1">Tipo *</label><select value={form.type} onChange={(e) => set('type', e.target.value)} className={inputCls}><option value="medical">Médica</option><option value="dental">Odontológica</option><option value="other">Outra</option></select></div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-sm font-medium text-surface-300 mb-1">Telefone</label><input value={form.phone} onChange={(e) => set('phone', e.target.value)} className={inputCls} placeholder="(11) 99999-9999" /></div>
              <div><label className="block text-sm font-medium text-surface-300 mb-1">E-mail</label><input value={form.email} onChange={(e) => set('email', e.target.value)} className={inputCls} placeholder="contato@clinica.com" /></div>
            </div>
            <div><label className="block text-sm font-medium text-surface-300 mb-1">Endereço</label><input value={form.address} onChange={(e) => set('address', e.target.value)} className={inputCls} placeholder="Rua, número, cidade" /></div>
            <div><label className="block text-sm font-medium text-surface-300 mb-1">Plano</label><select value={form.plan} onChange={(e) => set('plan', e.target.value)} className={inputCls}><option value="trial">Trial (14 dias)</option><option value="starter">Starter</option><option value="pro">Pro</option><option value="enterprise">Enterprise</option></select></div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-white mb-4">Acesso da Clínica</h2>
            <p className="text-surface-400 text-sm mb-4">Login e senha que o dono da clínica usará para acessar o CRM.</p>
            <div><label className="block text-sm font-medium text-surface-300 mb-1">Nome do responsável *</label><input value={form.ownerName} onChange={(e) => set('ownerName', e.target.value)} className={inputCls} placeholder="Dr. João Silva" /></div>
            <div><label className="block text-sm font-medium text-surface-300 mb-1">E-mail de acesso *</label><input value={form.ownerEmail} onChange={(e) => set('ownerEmail', e.target.value)} className={inputCls} placeholder="joao@clinica.com" /></div>
            <div><label className="block text-sm font-medium text-surface-300 mb-1">Senha *</label><input type="text" value={form.ownerPassword} onChange={(e) => set('ownerPassword', e.target.value)} className={inputCls} placeholder="Senha inicial" /><p className="text-xs text-surface-500 mt-1">Visível para facilitar o envio ao cliente</p></div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-white mb-4">Configuração do Agente IA</h2>
            <p className="text-surface-400 text-sm mb-4">Configure o agente que atenderá pelo WhatsApp.</p>
            <div><label className="block text-sm font-medium text-surface-300 mb-1">Nome da assistente</label><input value={form.assistantName} onChange={(e) => set('assistantName', e.target.value)} className={inputCls} placeholder="Ex: Ana, Sofia, Lia..." /></div>
            <div><label className="block text-sm font-medium text-surface-300 mb-1">Tom de voz</label><select value={form.tone} onChange={(e) => set('tone', e.target.value)} className={inputCls}><option value="profissional_amigavel">Profissional e amigável</option><option value="formal">Formal</option><option value="casual">Casual</option><option value="tecnico">Técnico</option></select></div>
            <div><label className="block text-sm font-medium text-surface-300 mb-1">Boas-vindas</label><textarea value={form.greeting} onChange={(e) => set('greeting', e.target.value)} className={`${inputCls} min-h-[80px]`} placeholder="Olá! Sou a assistente da clínica." /></div>
            <div><label className="block text-sm font-medium text-surface-300 mb-1">Instruções do sistema</label><textarea value={form.agentSystemPrompt} onChange={(e) => set('agentSystemPrompt', e.target.value)} className={`${inputCls} min-h-[100px]`} placeholder="Instruções personalizadas..." /></div>
            <div><label className="block text-sm font-medium text-surface-300 mb-1">Base de conhecimento</label><textarea value={form.agentKnowledgeBase} onChange={(e) => set('agentKnowledgeBase', e.target.value)} className={`${inputCls} min-h-[100px]`} placeholder="Serviços, preços, horários..." /></div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-white mb-4">Revisão</h2>
            <div className="bg-surface-800 rounded-xl p-4"><h3 className="text-sm font-semibold text-surface-400 uppercase mb-2">Clínica</h3><p className="text-white font-medium">{form.name}</p><p className="text-surface-400 text-sm">{form.type === 'medical' ? 'Médica' : form.type === 'dental' ? 'Odonto' : form.type} · {form.plan}</p>{form.email && <p className="text-surface-400 text-sm">{form.email}</p>}</div>
            <div className="bg-surface-800 rounded-xl p-4"><h3 className="text-sm font-semibold text-surface-400 uppercase mb-2">Acesso</h3><p className="text-white">{form.ownerName}</p><p className="text-surface-400 text-sm">{form.ownerEmail} · Senha: {form.ownerPassword}</p></div>
            <div className="bg-surface-800 rounded-xl p-4"><h3 className="text-sm font-semibold text-surface-400 uppercase mb-2">Agente IA</h3><p className="text-white">{form.assistantName || 'Não configurado'}</p><p className="text-surface-400 text-sm">Tom: {form.tone}</p></div>
          </div>
        )}

        <div className="flex justify-between mt-8 pt-6 border-t border-surface-800">
          {step > 0 ? <button onClick={prev} className="px-6 py-2.5 text-surface-400 hover:text-white">← Voltar</button> : <div />}
          {step < 3 ? (
            <button onClick={next} className="px-6 py-2.5 bg-gradient-to-r from-red-600 to-orange-500 text-white font-semibold rounded-xl hover:from-red-700 hover:to-orange-600 transition-all">Próximo →</button>
          ) : (
            <button onClick={submit} disabled={loading} className="px-8 py-2.5 bg-gradient-to-r from-accent-500 to-accent-600 text-white font-semibold rounded-xl disabled:opacity-50 transition-all">{loading ? 'Criando...' : '✓ Criar Clínica'}</button>
          )}
        </div>
      </div>
    </div>
  );
}
