export interface GoogleOAuthTokens {
  accessToken: string;
  refreshToken: string | null;
  expiryDate: number | null;
}

export interface CreateEventParams {
  summary: string;
  description?: string;
  startISO: string;
  endISO: string;
  timeZone: string;
}

export interface UpdateEventParams extends CreateEventParams {}

export interface BusyInterval {
  start: string;
  end: string;
}
