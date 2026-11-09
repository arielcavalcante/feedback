import { describe, expect, it, vi } from "vitest";
import { renderAccountEmail, sendAccountEmail, type AccountEmail } from "./email";
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

  it("references inline CID images when sending", () => {
    const inline = renderAccountEmail("https://ino.praiasertao.com.br", input, "inline").html;
    expect(inline).toContain('src="cid:ino-logo"');
    expect(inline).toContain('src="cid:ino-sun"');
    expect(inline).not.toContain("/assets/email/");
  });

  it("keeps the link usable in the plain-text part", () => {
    expect(text).toContain(`Criar conta: ${input.actionUrl}`);
    expect(text).toContain("Esse link é só teu.");
  });
});

describe("Resend delivery", () => {
  it("sends the images as inline CID attachments", async () => {
    let payload: { html: string; attachments: Array<{ content_id: string; content_type: string; content: string }> } | undefined;
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => {
      payload = JSON.parse(String(init?.body));
      return Response.json({ id: "email_123" });
    });
    const env = { APP_ORIGIN: "https://ino.praiasertao.com.br", RESEND_API_KEY: "re_test", EMAIL_FROM: "ino <ino@mail.praiasertao.com.br>", APP_ENV: "production" } as Env;
    await expect(sendAccountEmail(env, input)).resolves.toBe("email_123");
    fetchMock.mockRestore();
    expect(payload?.attachments.map((item) => item.content_id).sort()).toEqual(["ino-logo", "ino-shell", "ino-sun"]);
    expect(payload?.attachments.every((item) => item.content_type === "image/png" && item.content.startsWith("iVBOR"))).toBe(true);
    for (const id of ["ino-logo", "ino-sun", "ino-shell"]) expect(payload?.html).toContain(`cid:${id}`);
  });
});
