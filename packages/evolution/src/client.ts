import { ExternalServiceError } from '@crm-clinicas/shared';
import type {
  SendTextMessageParams,
  SendMediaMessageParams,
  InstanceInfo,
  CreateInstanceParams,
  QrCodeResponse,
} from './types.js';

// ==========================================
// Evolution API Client
// ==========================================

export class EvolutionClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(baseUrl: string, apiKey: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.apiKey = apiKey;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
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
        throw new ExternalServiceError('Evolution API', {
          status: response.status,
          body: errorBody,
        });
      }

      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof ExternalServiceError) throw error;
      throw new ExternalServiceError('Evolution API', { cause: error });
    }
  }

  // ========== Instance Management ==========

  async createInstance(params: CreateInstanceParams): Promise<InstanceInfo> {
    return this.request<InstanceInfo>('POST', '/instance/create', params);
  }

  async getInstanceStatus(instanceName: string): Promise<InstanceInfo> {
    return this.request<InstanceInfo>(
      'GET',
      `/instance/${instanceName}/status`,
    );
  }

  async getQrCode(instanceName: string): Promise<QrCodeResponse> {
    return this.request<QrCodeResponse>(
      'GET',
      `/instance/${instanceName}/qrcode`,
    );
  }

  async deleteInstance(instanceName: string): Promise<void> {
    await this.request('DELETE', `/instance/${instanceName}`);
  }

  async listInstances(): Promise<InstanceInfo[]> {
    return this.request<InstanceInfo[]>('GET', '/instance/fetchInstances');
  }

  // ========== Messaging ==========

  async sendText(params: SendTextMessageParams): Promise<{ key: { id: string } }> {
    const { instanceName, remoteJid, text } = params;
    return this.request('POST', `/message/sendText/${instanceName}`, {
      number: remoteJid,
      text,
    });
  }

  async sendMedia(params: SendMediaMessageParams): Promise<{ key: { id: string } }> {
    const { instanceName, remoteJid, mediaType, mediaUrl, caption, fileName } = params;
    return this.request('POST', `/message/sendMedia/${instanceName}`, {
      number: remoteJid,
      mediatype: mediaType,
      media: mediaUrl,
      caption,
      fileName,
    });
  }

  // ========== Webhook Configuration ==========

  async setWebhook(
    instanceName: string,
    webhookUrl: string,
    events: string[] = ['MESSAGES_UPSERT'],
  ): Promise<void> {
    await this.request('POST', `/webhook/set/${instanceName}`, {
      url: webhookUrl,
      webhook_by_events: false,
      webhook_base64: false,
      events,
    });
  }
}
