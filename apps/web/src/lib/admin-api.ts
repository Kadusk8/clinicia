const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

/**
 * Fetch autenticado do painel super admin. O token dura 8h desde o login
 * (super-admin.guard.ts) — sem tratar o 401 aqui, cada página tinha que
 * lembrar de checar isso sozinha, e nenhuma lembrava: uma sessão expirada
 * aparecia como "nenhuma clínica cadastrada" (resposta 401 não é array,
 * cai no branch de lista vazia), fazendo parecer que os dados sumiram.
 * Em qualquer 401, limpa o token e manda pro login.
 */
export async function adminFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = localStorage.getItem('admin_token');
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${token}` },
  });

  if (res.status === 401 && typeof window !== 'undefined') {
    localStorage.removeItem('admin_token');
    window.location.href = '/admin/login?expired=1';
  }

  return res;
}
