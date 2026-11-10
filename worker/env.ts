export interface Env {
  DB: D1Database;
  APP_ORIGIN: string;
  APP_ENV: "local" | "preview" | "production";
  AUTH_PEPPER: string;
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
  /** Public base URL for email images, e.g. https://assets.praiasertao.com.br/email/v1 (R2 custom domain). */
  EMAIL_ASSETS_URL?: string;
  SESSION_IDLE_DAYS: string;
  SESSION_ABSOLUTE_DAYS: string;
  INVITATION_TTL_HOURS: string;
  PASSWORD_RESET_TTL_MINUTES: string;
  PASSWORD_PBKDF2_ITERATIONS: string;
}
