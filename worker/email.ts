import type { Env } from "./env";
import { translate, type Locale } from "../shared/localization";

export type AccountEmail = {
  to: string;
  locale: Locale;
  subject: string;
  /** Short inbox preview line shown next to the subject. */
  preheader: string;
  eyebrow: string;
  heading: string;
  /** Paragraphs above the button. */
  body: string[];
  actionLabel: string;
  actionUrl: string;
  /** Small print under the button. Defaults to the personal-link warning used by account emails. */
  footnote?: string;
};

export type EmailImage = "logo" | "sun" | "shell";

/** Public base URL of the email images (R2 bucket behind a custom domain, ADR-029). Falls back to the app's own copy. */
export function emailAssetsUrl(env: Pick<Env, "APP_ORIGIN" | "EMAIL_ASSETS_URL">): string {
  return (env.EMAIL_ASSETS_URL || `${env.APP_ORIGIN}/assets/email`).replace(/\/+$/, "");
}

export async function sendAccountEmail(env: Env, input: AccountEmail): Promise<string> {
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) {
    if (env.APP_ENV === "local") return "local-email-not-sent";
    throw new Error("email_not_configured");
  }
  const { html, text } = renderAccountEmail(env.APP_ORIGIN, input, emailAssetsUrl(env));
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: env.EMAIL_FROM, to: [input.to], subject: input.subject, text, html }),
  });
  if (!response.ok) throw new Error(`resend_${response.status}`);
  const payload = await response.json<{ id: string }>();
  return payload.id;
}

const COLORS = { paper: "#f2f2f1", card: "#ffffff", ink: "#0c0c0c", blue: "#22458b", orange: "#e53412", gold: "#f7a90f", muted: "#5b6b8c" };
const FONT = "'Clash Grotesk', 'Helvetica Neue', Helvetica, Arial, sans-serif";

/**
 * Table-based, inline-styled HTML that holds up in Outlook (Word engine: VML button, ghost table,
 * Arial fallback), Gmail (no <style> dependency for layout), Apple Mail (web font, dark mode), and phones.
 * Every interpolated value is escaped. Images are absolute HTTPS URLs on the public assets host (EMAIL_ASSETS_URL).
 */
export function renderAccountEmail(origin: string, input: AccountEmail, assetsUrl = `${origin}/assets/email`): { html: string; text: string } {
  const t = (message: string) => translate(message, input.locale);
  const e = escapeHtml;
  const asset = (name: EmailImage) => e(`${assetsUrl}/${name}.png`);
  const url = e(input.actionUrl);
  const lang = input.locale === "en" ? "en" : "pt-BR";
  const footerTitle = t("Feedback, with care.");
  const privacy = t("Survey responses are anonymous to coordinators and teammates.");
  const footnote = input.footnote ?? `${t("This link is personal. Please don’t forward this email.")} ${t("If you did not expect this message, you can ignore it.")}`;
  const fallback = t("If the button doesn’t work, copy this link into your browser:");
  // Pads the preview so clients don't pull body text into the inbox snippet.
  const previewPad = "&#847;&zwnj;&nbsp;".repeat(60);

  const paragraphs = input.body.map((paragraph) => `
                <tr><td class="ino-text" style="padding:0 0 16px 0;font-family:${FONT};font-size:17px;line-height:26px;mso-line-height-rule:exactly;color:${COLORS.ink};">${e(paragraph)}</td></tr>`).join("");

  const html = `<!DOCTYPE html>
<html lang="${lang}" dir="ltr" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="x-apple-disable-message-reformatting">
<meta name="format-detection" content="telephone=no, date=no, address=no, email=no, url=no">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${e(input.subject)}</title>
<!--[if mso]>
<noscript><xml><o:OfficeDocumentSettings><o:AllowPNG/><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
<style>table, td, div, h1, p, a, span { font-family: Arial, Helvetica, sans-serif !important; }</style>
<![endif]-->
<!--[if !mso]><!-->
<style>
  @font-face { font-family: 'Clash Grotesk'; src: url('${e(origin)}/fonts/ClashGrotesk-Variable.woff2') format('woff2'); font-weight: 200 700; font-style: normal; }
</style>
<!--<![endif]-->
<style>
  :root { color-scheme: light dark; supported-color-schemes: light dark; }
  html, body { margin: 0 !important; padding: 0 !important; width: 100% !important; }
  body { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
  table, td { border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
  img { border: 0; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic; display: block; }
  a { text-decoration: none; }
  a[x-apple-data-detectors], #MessageViewBody a, u + #body a { color: inherit !important; text-decoration: none !important; font-size: inherit !important; font-family: inherit !important; font-weight: inherit !important; line-height: inherit !important; }
  .ino-url a, a.ino-url { color: ${COLORS.blue} !important; text-decoration: underline !important; word-break: break-all; }
  @media only screen and (max-width: 620px) {
    .ino-outer { padding: 20px 10px !important; }
    .ino-pad { padding-left: 24px !important; padding-right: 24px !important; }
    .ino-card-pad { padding: 32px 24px 28px 24px !important; }
    .ino-h1 { font-size: 32px !important; line-height: 34px !important; }
    .ino-sun { width: 120px !important; height: 60px !important; }
    .ino-btn-a { display: block !important; width: auto !important; }
  }
  @media (prefers-color-scheme: dark) {
    .ino-bg { background-color: ${COLORS.ink} !important; }
    .ino-card { background-color: #1b1b1b !important; }
    .ino-text, .ino-foot { color: ${COLORS.paper} !important; }
    .ino-h1, .ino-eyebrow, .ino-foot-title { color: ${COLORS.gold} !important; }
    .ino-muted { color: #b9c3d6 !important; }
    .ino-url a, a.ino-url { color: ${COLORS.gold} !important; }
    .ino-rule { border-color: #333333 !important; }
  }
  [data-ogsc] .ino-bg { background-color: ${COLORS.ink} !important; }
  [data-ogsc] .ino-card { background-color: #1b1b1b !important; }
  [data-ogsc] .ino-text, [data-ogsc] .ino-foot { color: ${COLORS.paper} !important; }
  [data-ogsc] .ino-h1, [data-ogsc] .ino-eyebrow, [data-ogsc] .ino-foot-title { color: ${COLORS.gold} !important; }
  [data-ogsc] .ino-muted { color: #b9c3d6 !important; }
</style>
</head>
<body id="body" class="ino-bg" style="margin:0;padding:0;word-spacing:normal;background-color:${COLORS.paper};">
<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;color:${COLORS.paper};">${e(input.preheader)}${previewPad}</div>
<div role="article" aria-roledescription="email" aria-label="${e(input.subject)}" lang="${lang}" class="ino-bg" style="background-color:${COLORS.paper};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="ino-bg" style="width:100%;background-color:${COLORS.paper};">
  <tr>
    <td align="center" class="ino-outer" style="padding:40px 16px;">
      <!--[if mso]><table role="presentation" align="center" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;margin:0 auto;">
        <tr>
          <td class="ino-pad" style="padding:0 40px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td valign="bottom" style="padding:0 0 24px 0;">
                  <a href="${e(origin)}" target="_blank" style="text-decoration:none;"><img src="${asset("logo")}" width="64" height="46" alt="ino" style="display:block;width:64px;height:46px;border:0;color:${COLORS.orange};font-family:${FONT};font-size:28px;font-weight:bold;"></a>
                </td>
                <td valign="bottom" align="right" style="padding:0;">
                  <img class="ino-sun" src="${asset("sun")}" width="160" height="80" alt="" style="display:block;width:160px;height:80px;border:0;">
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td class="ino-card ino-card-pad" bgcolor="${COLORS.card}" style="background-color:${COLORS.card};border-radius:28px;padding:44px 40px 36px 40px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr><td class="ino-eyebrow" style="padding:0 0 14px 0;font-family:${FONT};font-size:12px;line-height:16px;mso-line-height-rule:exactly;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:${COLORS.blue};">${e(input.eyebrow)}</td></tr>
              <tr><td style="padding:0 0 24px 0;"><h1 class="ino-h1" style="margin:0;font-family:${FONT};font-size:40px;line-height:42px;mso-line-height-rule:exactly;font-weight:500;letter-spacing:-1px;color:${COLORS.blue};">${e(input.heading)}</h1></td></tr>${paragraphs}
              <tr>
                <td style="padding:16px 0 32px 0;">
                  <!--[if mso]>
                  <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${url}" style="height:54px;v-text-anchor:middle;width:300px;" arcsize="50%" stroke="f" fillcolor="${COLORS.orange}">
                    <w:anchorlock/>
                    <center style="color:${COLORS.paper};font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:bold;">${e(input.actionLabel)} &rarr;</center>
                  </v:roundrect>
                  <![endif]-->
                  <!--[if !mso]><!-->
                  <a class="ino-btn-a" href="${url}" target="_blank" style="display:inline-block;width:300px;background-color:${COLORS.orange};border-radius:999px;color:${COLORS.paper};font-family:${FONT};font-size:16px;font-weight:600;line-height:54px;text-align:center;text-decoration:none;-webkit-text-size-adjust:none;mso-hide:all;">${e(input.actionLabel)}&nbsp;&nbsp;&rarr;</a>
                  <!--<![endif]-->
                </td>
              </tr>
              <tr><td class="ino-rule" style="border-top:1px solid #e3e5ea;font-size:0;line-height:0;mso-line-height-rule:exactly;">&nbsp;</td></tr>
              <tr><td class="ino-muted" style="padding:20px 0 6px 0;font-family:${FONT};font-size:13px;line-height:20px;mso-line-height-rule:exactly;color:${COLORS.muted};">${e(fallback)}</td></tr>
              <tr><td class="ino-url" style="padding:0 0 16px 0;font-family:${FONT};font-size:13px;line-height:20px;mso-line-height-rule:exactly;word-break:break-all;"><a class="ino-url" href="${url}" target="_blank" style="color:${COLORS.blue};text-decoration:underline;word-break:break-all;">${url}</a></td></tr>
              <tr><td class="ino-muted" style="padding:0;font-family:${FONT};font-size:13px;line-height:20px;mso-line-height-rule:exactly;color:${COLORS.muted};">${e(footnote)}</td></tr>
            </table>
          </td>
        </tr>
        <tr>
          <td class="ino-pad" style="padding:32px 40px 0 40px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td width="30" valign="top" style="width:30px;padding:4px 0 0 0;"><img src="${asset("shell")}" width="22" height="17" alt="" style="display:block;width:22px;height:17px;border:0;"></td>
                <td valign="top">
                  <p class="ino-foot-title" style="margin:0 0 6px 0;font-family:${FONT};font-size:20px;line-height:24px;mso-line-height-rule:exactly;font-weight:500;color:${COLORS.blue};">${e(footerTitle)}</p>
                  <p class="ino-foot" style="margin:0;font-family:${FONT};font-size:13px;line-height:20px;mso-line-height-rule:exactly;color:${COLORS.ink};">${e(privacy)}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
      <!--[if mso]></td></tr></table><![endif]-->
    </td>
  </tr>
</table>
</div>
</body>
</html>`;

  const text = [
    input.heading,
    "",
    ...input.body.flatMap((paragraph) => [paragraph, ""]),
    `${input.actionLabel}: ${input.actionUrl}`,
    "",
    footnote,
    "",
    `— ino · ${footerTitle}`,
  ].join("\n");

  return { html, text };
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
