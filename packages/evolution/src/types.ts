// ==========================================
// Evolution Go Types
// (evolution-foundation/evolution-go — NÃO é a Evolution API Node original)
// ==========================================

export interface SendTextParams {
  number: string; // DDI+DDD+número, sem "+" (ex: 5511999998888)
  text: string;
}

export interface SendMediaParams {
  number: string;
  mediaType: 'image' | 'video' | 'audio' | 'document';
  media: string; // URL ou base64
  caption?: string;
  fileName?: string;
}

export interface InstanceListItem {
  id: string; // UUID — identificador real da instância nas rotas admin
  name: string;
  token: string;
  webhook: string;
  connected: boolean;
  jid?: string;
}

export interface InstanceStatus {
  Connected: boolean;
  LoggedIn: boolean;
  Name?: string;
}

export interface ConnectParams {
  webhookUrl?: string;
  subscribe?: string[]; // ex: ['ALL'] ou ['MESSAGE', 'CONNECTION']
  immediate?: boolean;
}

export interface ConnectResponse {
  qrcode?: string;
  code?: string; // data:image/png;base64,...
  eventString?: string;
  jid?: string;
  webhookUrl?: string;
}

export interface CreateInstanceParams {
  name: string;
  token: string;
  webhook?: string;
  webhookEvents?: string[];
}

export interface CreateInstanceResponse {
  id: string;
  name: string;
  token: string;
  webhook: string;
  status: string;
  createdAt: string;
}

// ========== Webhook payloads recebidos da Evolution Go ==========
// Formato mirrors whatsmeow (Go), NÃO o formato Baileys da Evolution API original.

export interface WebhookPayload {
  event: string; // "Message" | "Connected" | "LoggedOut" | "PairSuccess" | "Receipt" | ...
  data: unknown;
  instanceId: string;
  instanceToken: string;
}

export interface WebhookMessageInfo {
  Chat: string; // JID do chat (grupo ou contato)
  Sender: string; // JID de quem enviou, ex: "557499879409:1@s.whatsapp.net"
  SenderAlt?: string;
  IsFromMe: boolean;
  IsGroup: boolean;
  ID: string;
  Type: string;
  PushName?: string;
  Timestamp: string;
  MediaType?: string;
}

export interface WebhookMessageData {
  Info: WebhookMessageInfo;
  Message?: {
    conversation?: string;
    extendedTextMessage?: { text: string };
    imageMessage?: { caption?: string; mimetype?: string; url?: string; base64?: string; mediaUrl?: string };
    audioMessage?: { mimetype?: string; url?: string; base64?: string; mediaUrl?: string };
    documentMessage?: { fileName?: string; mimetype?: string; url?: string; base64?: string; mediaUrl?: string };
    videoMessage?: { caption?: string; mimetype?: string; url?: string; base64?: string; mediaUrl?: string };
  };
  IsEphemeral?: boolean;
  IsViewOnce?: boolean;
  IsEdit?: boolean;
}

export interface WebhookConnectionData {
  status: 'open' | 'close' | string;
  jid?: string;
  pushName?: string;
}
