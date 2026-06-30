'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { api } from '@/lib/api';

// ==========================================
// Types
// ==========================================

interface Conversation {
  id: string;
  patientId: string | null;
  externalId: string | null;
  status: string;
  unreadCount: number | null;
  lastMessageAt: string | null;
  assignedUserId: string | null;
}

interface Message {
  id: string;
  role: string;
  content: string;
  createdAt: string;
}

type StatusFilter = 'all' | 'agent_active' | 'human_active';

// ==========================================
// Helpers
// ==========================================

function formatTime(iso: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function roleBadge(role: string) {
  const map: Record<string, string> = { agent: 'IA', staff: 'Atendente', system: 'Sistema' };
  return map[role] ?? '';
}

function roleBubble(role: string) {
  const map: Record<string, string> = {
    patient: 'bg-surface-100 text-surface-800 self-start rounded-br-sm',
    agent:   'bg-primary-100 text-primary-800 self-start rounded-br-sm',
    staff:   'bg-accent-500 text-white self-end rounded-bl-sm',
    system:  'bg-amber-50 text-amber-700 self-center text-xs italic max-w-full text-center',
  };
  return map[role] ?? 'bg-surface-100 self-start';
}

function statusLabel(s: string) {
  return s === 'human_active' ? 'Humano' : s === 'agent_active' ? 'IA' : 'Fechada';
}

function statusBadge(s: string) {
  return s === 'human_active'
    ? 'bg-amber-100 text-amber-700'
    : s === 'agent_active'
    ? 'bg-accent-100 text-accent-700'
    : 'bg-surface-100 text-surface-400';
}

// ==========================================
// Page
// ==========================================

export default function InboxPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected]           = useState<Conversation | null>(null);
  const [messages, setMessages]           = useState<Message[]>([]);
  const [filter, setFilter]               = useState<StatusFilter>('all');
  const [input, setInput]                 = useState('');
  const [sending, setSending]             = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef       = useRef<HTMLTextAreaElement>(null);

  // Poll conversations every 5s
  const fetchConversations = useCallback(async () => {
    try {
      const res = await api.getConversations({ pageSize: '50' }) as { data: Conversation[] };
      setConversations(res.data ?? []);
      // Keep selected in sync with latest status
      if (selected) {
        const fresh = res.data?.find((c: Conversation) => c.id === selected.id);
        if (fresh) setSelected(fresh);
      }
    } catch { /* ignore */ }
  }, [selected]);

  useEffect(() => {
    fetchConversations();
    const id = setInterval(fetchConversations, 5_000);
    return () => clearInterval(id);
  }, [fetchConversations]);

  // Poll messages every 3s when conversation open
  const fetchMessages = useCallback(async () => {
    if (!selected) return;
    try {
      const msgs = await api.getMessages(selected.id) as Message[];
      setMessages(msgs);
    } catch { /* ignore */ }
  }, [selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selected) { setMessages([]); return; }
    fetchMessages();
    const id = setInterval(fetchMessages, 3_000);
    return () => clearInterval(id);
  }, [selected?.id, fetchMessages]); // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Mark as read on open
  useEffect(() => {
    if (!selected || !selected.unreadCount) return;
    api.markConversationAsRead(selected.id).catch(() => null);
    setConversations((prev) =>
      prev.map((c) => (c.id === selected.id ? { ...c, unreadCount: 0 } : c)),
    );
  }, [selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleTakeover() {
    if (!selected) return;
    setActionLoading(true);
    try {
      await api.takeoverConversation(selected.id);
      const updated = { ...selected, status: 'human_active' };
      setSelected(updated);
      setConversations((prev) => prev.map((c) => (c.id === selected.id ? updated : c)));
    } finally { setActionLoading(false); }
  }

  async function handleReturnToAgent() {
    if (!selected) return;
    setActionLoading(true);
    try {
      await api.returnToAgent(selected.id);
      const updated = { ...selected, status: 'agent_active' };
      setSelected(updated);
      setConversations((prev) => prev.map((c) => (c.id === selected.id ? updated : c)));
    } finally { setActionLoading(false); }
  }

  async function handleSend() {
    if (!selected || !input.trim() || sending) return;
    const content = input.trim();
    setInput('');
    setSending(true);
    try {
      await api.sendMessage(selected.id, content);
      await fetchMessages();
    } catch {
      setInput(content);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }

  const filtered    = conversations.filter((c) => filter === 'all' || c.status === filter);
  const totalUnread = conversations.reduce((n, c) => n + (c.unreadCount ?? 0), 0);

  return (
    <div className="animate-fade-in flex flex-col" style={{ height: 'calc(100vh - 80px)' }}>
      {/* Page header */}
      <div className="mb-4 flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-3xl font-bold text-surface-900">Inbox</h1>
          <p className="text-surface-500 mt-1">Conversas do WhatsApp com pacientes</p>
        </div>
        {totalUnread > 0 && (
          <span className="badge-danger px-3 py-1 text-sm">{totalUnread} não lidas</span>
        )}
      </div>

      {/* Main split */}
      <div className="card flex flex-1 overflow-hidden">

        {/* ---- Conversation list ---- */}
        <div className="w-80 border-r border-surface-200 flex flex-col flex-shrink-0">
          {/* Filter tabs */}
          <div className="p-3 border-b border-surface-100 flex gap-1">
            {(['all', 'agent_active', 'human_active'] as StatusFilter[]).map((s) => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`flex-1 text-xs py-1.5 rounded-lg font-medium transition-colors ${
                  filter === s ? 'bg-primary-500 text-white' : 'text-surface-500 hover:bg-surface-50'
                }`}
              >
                {s === 'all' ? 'Todas' : s === 'agent_active' ? 'IA' : 'Humano'}
              </button>
            ))}
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto divide-y divide-surface-100">
            {filtered.length === 0 ? (
              <div className="py-16 text-center text-surface-400">
                <span className="text-4xl block mb-2">💬</span>
                <p className="text-sm">Nenhuma conversa</p>
              </div>
            ) : (
              filtered.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => setSelected(conv)}
                  className={`w-full text-left px-4 py-3 hover:bg-surface-50 transition-colors ${
                    selected?.id === conv.id
                      ? 'bg-primary-50 border-l-2 border-l-primary-500'
                      : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-medium text-sm text-surface-800 truncate">
                      {conv.externalId ?? '—'}
                    </span>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {(conv.unreadCount ?? 0) > 0 && (
                        <span className="badge-danger text-[10px] min-w-[18px] h-[18px] flex items-center justify-center rounded-full">
                          {conv.unreadCount}
                        </span>
                      )}
                      <span className="text-[10px] text-surface-400 whitespace-nowrap">
                        {formatTime(conv.lastMessageAt)}
                      </span>
                    </div>
                  </div>
                  <span className={`mt-1 inline-block text-[10px] px-1.5 py-0.5 rounded font-medium ${statusBadge(conv.status)}`}>
                    {statusLabel(conv.status)}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>

        {/* ---- Chat area ---- */}
        {!selected ? (
          <div className="flex-1 flex items-center justify-center text-surface-400">
            <div className="text-center">
              <span className="text-6xl block mb-4">📱</span>
              <p className="text-lg font-medium">Selecione uma conversa</p>
              <p className="text-sm mt-1">ou aguarde novas mensagens do WhatsApp</p>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-w-0">
            {/* Chat header */}
            <div className="px-5 py-3 border-b border-surface-200 flex items-center justify-between flex-shrink-0">
              <div>
                <p className="font-semibold text-surface-900">
                  {selected.externalId ?? 'Paciente'}
                </p>
                <span className={`text-xs px-2 py-0.5 rounded font-medium ${statusBadge(selected.status)}`}>
                  {statusLabel(selected.status)}
                </span>
              </div>
              <div className="flex gap-2">
                {selected.status === 'agent_active' ? (
                  <button
                    onClick={handleTakeover}
                    disabled={actionLoading}
                    className="btn-primary text-sm py-1.5 px-4 disabled:opacity-60"
                  >
                    {actionLoading ? '...' : '✋ Assumir'}
                  </button>
                ) : selected.status === 'human_active' ? (
                  <button
                    onClick={handleReturnToAgent}
                    disabled={actionLoading}
                    className="text-sm py-1.5 px-4 rounded-xl border border-surface-200 hover:bg-surface-50 transition-colors disabled:opacity-60"
                  >
                    {actionLoading ? '...' : '🤖 Devolver à IA'}
                  </button>
                ) : null}
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {messages.length === 0 ? (
                <p className="text-center text-surface-400 text-sm py-12">Nenhuma mensagem ainda</p>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${
                      msg.role === 'staff' ? 'items-end' : msg.role === 'system' ? 'items-center' : 'items-start'
                    }`}
                  >
                    {msg.role !== 'patient' && msg.role !== 'system' && (
                      <span className="text-[10px] text-surface-400 mb-0.5 px-1">
                        {roleBadge(msg.role)}
                      </span>
                    )}
                    <div
                      className={`max-w-[72%] rounded-2xl px-4 py-2 text-sm whitespace-pre-wrap break-words ${roleBubble(msg.role)}`}
                    >
                      {msg.content}
                    </div>
                    <span className="text-[10px] text-surface-400 mt-0.5 px-1">
                      {formatTime(msg.createdAt)}
                    </span>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            {selected.status === 'human_active' ? (
              <div className="p-3 border-t border-surface-200 flex gap-2 flex-shrink-0">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder="Digite uma mensagem… (Enter envia, Shift+Enter quebra linha)"
                  rows={2}
                  className="input flex-1 resize-none text-sm"
                  disabled={sending}
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || sending}
                  className="btn-primary self-end px-4 py-2 text-sm disabled:opacity-50"
                >
                  {sending ? '...' : '→'}
                </button>
              </div>
            ) : (
              <div className="p-3 border-t border-surface-200 flex-shrink-0 text-center">
                <p className="text-xs text-surface-400">
                  A IA está no controle — clique em <strong>Assumir</strong> para enviar mensagens
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
