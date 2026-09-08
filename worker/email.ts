import type { Env } from "./env";

export async function sendAccountEmail(env: Env, input: { to: string; subject: string; heading: string; body: string; actionLabel: string; actionUrl: string }): Promise<string> {
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) {
    if (env.APP_ENV === "local") return "local-email-not-sent";
    throw new Error("email_not_configured");
  }
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: [input.to],
      subject: input.subject,
      text: `${input.heading}\n\n${input.body}\n\n${input.actionLabel}: ${input.actionUrl}`,
      html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#17383a"><h1>${escapeHtml(input.heading)}</h1><p>${escapeHtml(input.body)}</p><p><a href="${escapeHtml(input.actionUrl)}" style="background:#1d5c5a;color:white;padding:12px 18px;border-radius:8px;text-decoration:none">${escapeHtml(input.actionLabel)}</a></p><p style="color:#687775;font-size:13px">If you did not expect this message, you can ignore it.</p></div>`,
    }),
  });
  if (!response.ok) throw new Error(`resend_${response.status}`);
  const payload = await response.json<{ id: string }>();
  return payload.id;
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
