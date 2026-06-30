// ==========================================
// Evolution API Types
// ==========================================

export interface SendTextMessageParams {
  instanceName: string;
  remoteJid: string; // e.g. 5511999998888@s.whatsapp.net
  text: string;
}

export interface SendMediaMessageParams {
  instanceName: string;
  remoteJid: string;
  mediaType: 'image' | 'video' | 'audio' | 'document';
  mediaUrl: string;
  caption?: string;
  fileName?: string;
}

export interface InstanceInfo {
  instanceName: string;
  status: 'open' | 'close' | 'connecting';
  owner?: string;
  profilePicUrl?: string;
}

export interface WebhookPayload {
  event: string;
  instance: string;
  data: WebhookMessage;
}

export interface WebhookMessage {
  key: {
    remoteJid: string;
    fromMe: boolean;
    id: string;
  };
  pushName?: string;
  message?: {
    conversation?: string;
    extendedTextMessage?: {
      text: string;
    };
    imageMessage?: {
      url: string;
      caption?: string;
      mimetype: string;
    };
    audioMessage?: {
      url: string;
      mimetype: string;
    };
    documentMessage?: {
      url: string;
      fileName: string;
      mimetype: string;
    };
    videoMessage?: {
      url: string;
      caption?: string;
      mimetype: string;
    };
  };
  messageType: string;
  messageTimestamp: number;
}

export interface CreateInstanceParams {
  instanceName: string;
  qrcode: boolean;
  integration?: string;
}

export interface QrCodeResponse {
  pairingCode: string | null;
  code: string; // QR code base64
  count: number;
}
