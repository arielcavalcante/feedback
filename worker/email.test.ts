import { describe, expect, it, vi } from "vitest";
import { emailAssetsUrl, renderAccountEmail, sendAccountEmail, type AccountEmail } from "./email";
import type { Env } from "./env";

const input: AccountEmail = {
  to: "lia@example.com", locale: "pt-BR", subject: "Teu convite pro ino", preheader: "Cria tua senha",
  eyebrow: "Teu convite", heading: "Opa, <Lia>!", body: ["Primeiro & segundo", "Terceiro"],
  actionLabel: "Criar conta", actionUrl: "https://ino.praiasertao.com.br/accept-invite#token=abc&x=\"1\"",
};

describe("account email template", () => {
  const { html, text } = renderAccountEmail("https://ino.praiasertao.com.br", input);

  it("escapes every interpolated value", () => {
    expect(html).toContain("Opa, &lt;Lia&gt;!");
    expect(html).toContain("Primeiro &amp; segundo");
    expect(html).not.toContain("<Lia>");
    expect(html).toContain("token=abc&amp;x=&quot;1&quot;");
  });

  it("ships Outlook fallbacks and absolute image URLs", () => {
    expect(html).toContain("<v:roundrect");
    expect(html).toContain("<!--[if mso]>");
    expect(html).toContain('src="https://ino.praiasertao.com.br/assets/email/logo.png"');
    expect(html).toContain('lang="pt-BR"');
  });

  it("points images at the hosted assets URL when configured", () => {
    const hosted = renderAccountEmail("https://ino.praiasertao.com.br", input, "https://assets.praiasertao.com.br/email/v1").html;
    for (const name of ["logo", "sun", "shell"]) expect(hosted).toContain(`src="https://assets.praiasertao.com.br/email/v1/${name}.png"`);
    expect(hosted).not.toContain("cid:");
  });

  it("keeps the link usable in the plain-text part", () => {
    expect(text).toContain(`Criar conta: ${input.actionUrl}`);
    expect(text).toContain("Esse link é só teu.");
  });
});

describe("Resend delivery", () => {
  it("sends plain HTML with hosted images and no attachments", async () => {
    let payload: { html: string; attachments?: unknown } | undefined;
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => {
      payload = JSON.parse(String(init?.body));
      return Response.json({ id: "email_123" });
    });
    const env = { APP_ORIGIN: "https://ino.praiasertao.com.br", EMAIL_ASSETS_URL: "https://assets.praiasertao.com.br/email/v1/", RESEND_API_KEY: "re_test", EMAIL_FROM: "ino <ino@mail.praiasertao.com.br>", APP_ENV: "production" } as Env;
    await expect(sendAccountEmail(env, input)).resolves.toBe("email_123");
    fetchMock.mockRestore();
    expect(payload?.attachments).toBeUndefined();
    expect(payload?.html).toContain('src="https://assets.praiasertao.com.br/email/v1/logo.png"');
  });

  it("falls back to the app's own copy of the images", () => {
    expect(emailAssetsUrl({ APP_ORIGIN: "https://ino.praiasertao.com.br" })).toBe("https://ino.praiasertao.com.br/assets/email");
  });
});
