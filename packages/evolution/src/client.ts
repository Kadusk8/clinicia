import { ExternalServiceError } from '@crm-clinicas/shared';
import type {
  SendTextParams,
  SendMediaParams,
  InstanceListItem,
  InstanceStatus,
  ConnectParams,
  ConnectResponse,
  CreateInstanceParams,
  CreateInstanceResponse,
} from './types.js';

// ==========================================
// Evolution Go Client
// (evolution-foundation/evolution-go)
//
// Duas classes de rotas, ambas autenticadas via header `apikey`:
// - Admin (GLOBAL_API_KEY do servidor): create/list/info/delete de instâncias,
//   endereçadas por UUID.
// - Operacional (token da própria instância, gerado em createInstance): connect,
//   status, send/*, disconnect, logout — SEM UUID na URL, o token já identifica
//   a instância.
// ==========================================

export class EvolutionClient {
  private baseUrl: string;
  private apiKey: string;

  /**
   * @param apiKey Para rotas admin, passe a GLOBAL_API_KEY do servidor.
   *               Para rotas operacionais, passe o token da instância.
   */
  constructor(baseUrl: string, apiKey: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.apiKey = apiKey;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          apikey: this.apiKey,
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new ExternalServiceError('Evolution Go', {
          status: response.status,
          body: errorBody,
        });
      }

      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof ExternalServiceError) throw error;
      throw new ExternalServiceError('Evolution Go', { cause: error });
    }
  }

  // ========== Admin (GLOBAL_API_KEY, endereçado por UUID) ==========

  async createInstance(params: CreateInstanceParams): Promise<CreateInstanceResponse> {
    return this.request('POST', '/instance/create', params);
  }

  async listInstances(): Promise<InstanceListItem[]> {
    const res = await this.request<{ data: InstanceListItem[] }>('GET', '/instance/all');
    return res.data;
  }

  async getInstanceInfo(instanceId: string): Promise<InstanceListItem> {
    return this.request('GET', `/instance/info/${instanceId}`);
  }

  async deleteInstance(instanceId: string): Promise<void> {
    await this.request('DELETE', `/instance/delete/${instanceId}`);
  }

  // ========== Operacional (token da instância, sem UUID na URL) ==========

  async connect(params: ConnectParams = {}): Promise<ConnectResponse> {
    const res = await this.request<{ data: ConnectResponse }>('POST', '/instance/connect', params);
    return res.data;
  }

  async getStatus(): Promise<InstanceStatus> {
    const res = await this.request<{ data: InstanceStatus }>('GET', '/instance/status');
    return res.data;
  }

  async disconnect(): Promise<void> {
    await this.request('POST', '/instance/disconnect');
  }

  async logout(): Promise<void> {
    await this.request('DELETE', '/instance/logout');
  }

  async sendText(params: SendTextParams): Promise<{ key?: { id: string } }> {
    return this.request('POST', '/send/text', params);
  }

  async sendMedia(params: SendMediaParams): Promise<{ key?: { id: string } }> {
    return this.request('POST', '/send/media', params);
  }

  /**
   * Configura (ou reconfigura) o webhook da instância. Atalho sobre connect(),
   * que é a única rota que aceita webhookUrl/subscribe para uma instância já
   * criada — não existe rota dedicada `/webhook/set`.
   */
  async setWebhook(webhookUrl: string, events: string[] = ['ALL']): Promise<ConnectResponse> {
    return this.connect({ webhookUrl, subscribe: events, immediate: true });
  }
}
