const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

class ApiClient {
  readonly baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    options?: RequestInit,
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}/api${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      credentials: 'include',
      body: body ? JSON.stringify(body) : undefined,
      ...options,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Erro desconhecido' }));
      throw new Error(error.message || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // Auth
  login(email: string, password: string) {
    return this.request('POST', '/auth/login', { email, password });
  }

  register(data: { email: string; password: string; name: string; clinicName: string; clinicType: string }) {
    return this.request('POST', '/auth/register', data);
  }

  me() {
    return this.request('GET', '/auth/me');
  }

  logout() {
    return this.request('POST', '/auth/logout');
  }

  // Patients
  getPatients(params?: Record<string, string>) {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return this.request('GET', `/patients${query}`);
  }

  getPatient(id: string) {
    return this.request('GET', `/patients/${id}`);
  }

  createPatient(data: unknown) {
    return this.request('POST', '/patients', data);
  }

  updatePatient(id: string, data: unknown) {
    return this.request('PUT', `/patients/${id}`, data);
  }

  deletePatient(id: string) {
    return this.request('DELETE', `/patients/${id}`);
  }

  // Services
  getServices(params?: Record<string, string>) {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return this.request('GET', `/services${query}`);
  }

  createService(data: unknown) {
    return this.request('POST', '/services', data);
  }

  updateService(id: string, data: unknown) {
    return this.request('PUT', `/services/${id}`, data);
  }

  deleteService(id: string) {
    return this.request('DELETE', `/services/${id}`);
  }

  // Professionals
  getProfessionals(params?: Record<string, string>) {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return this.request('GET', `/professionals${query}`);
  }

  createProfessional(data: unknown) {
    return this.request('POST', '/professionals', data);
  }

  updateProfessional(id: string, data: unknown) {
    return this.request('PUT', `/professionals/${id}`, data);
  }

  updateWorkingHours(id: string, workingHours: unknown) {
    return this.request('PATCH', `/professionals/${id}/working-hours`, { workingHours });
  }

  // Appointments
  getAppointments(params?: Record<string, string>) {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return this.request('GET', `/appointments${query}`);
  }

  getAppointmentsByRange(from: string, to: string) {
    return this.request('GET', `/appointments/range?from=${from}&to=${to}`);
  }

  createAppointment(data: unknown) {
    return this.request('POST', '/appointments', data);
  }

  cancelAppointment(id: string, reason?: string) {
    return this.request('PUT', `/appointments/${id}/cancel`, { reason });
  }

  // Conversations
  getConversations(params?: Record<string, string>) {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return this.request('GET', `/conversations${query}`);
  }

  getConversation(id: string) {
    return this.request('GET', `/conversations/${id}`);
  }

  getMessages(conversationId: string) {
    return this.request('GET', `/conversations/${conversationId}/messages`);
  }

  sendMessage(conversationId: string, content: string) {
    return this.request('POST', `/conversations/${conversationId}/messages`, { content });
  }

  takeoverConversation(id: string) {
    return this.request('PUT', `/conversations/${id}/takeover`);
  }

  returnToAgent(id: string) {
    return this.request('PUT', `/conversations/${id}/return-to-agent`);
  }

  markConversationAsRead(id: string) {
    return this.request('PUT', `/conversations/${id}/read`);
  }

  // Clinics (settings)
  getMe() {
    return this.request('GET', '/clinics/me');
  }

  updateMe(data: Record<string, unknown>) {
    return this.request('PATCH', '/clinics/me', data);
  }

  // Reports
  getOverview() {
    return this.request('GET', '/reports/overview');
  }

  getAppointmentsReport(from: string, to: string) {
    return this.request('GET', `/reports/appointments?from=${from}&to=${to}`);
  }

  getConversationsReport() {
    return this.request('GET', '/reports/conversations');
  }

  exportAppointmentsCsvUrl(from: string, to: string) {
    return `${this.baseUrl}/api/reports/export/appointments?from=${from}&to=${to}`;
  }

  // Knowledge Base
  getKnowledgeBase() {
    return this.request('GET', '/knowledge-base');
  }

  createKnowledgeBaseDoc(data: { title: string; content: string }) {
    return this.request('POST', '/knowledge-base', data);
  }

  deleteKnowledgeBaseDoc(id: string) {
    return this.request('DELETE', `/knowledge-base/${id}`);
  }

  // Pipeline
  getDeals(params?: Record<string, string>) {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return this.request('GET', `/pipeline${query}`);
  }

  getKanban() {
    return this.request('GET', '/pipeline/kanban');
  }

  createDeal(data: unknown) {
    return this.request('POST', '/pipeline', data);
  }

  updateDealStage(id: string, stage: string) {
    return this.request('PUT', `/pipeline/${id}/stage`, { stage });
  }
}

export const api = new ApiClient(API_BASE_URL);
