import { describe, expect, it } from "vitest";
import { formatDate, normalizeLocale, translate } from "./localization";

describe("localization", () => {
  it("uses Brazilian Portuguese by default and preserves English as an alternative", () => {
    expect(normalizeLocale(undefined)).toBe("pt-BR");
    expect(translate("Sign in", "pt-BR")).toBe("Entrar");
    expect(translate("Sign in", "en")).toBe("Sign in");
  });

  it("interpolates names and formats dates in Fortaleza", () => {
    expect(translate("Welcome, {name}", "pt-BR", { name: "Ariel" })).toBe("Boas-vindas, Ariel");
    expect(formatDate("2026-09-18T12:00:00.000Z", "pt-BR")).toContain("18 de setembro de 2026");
  });
});

describe("catalog coverage", async () => {
  const { readFileSync, readdirSync } = await import("node:fs");
  const { join } = await import("node:path");
  const { portuguese } = await import("./localization");
  const files = (dir: string): string[] => readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) => entry.isDirectory() ? (entry.name === "dev" ? [] : files(join(dir, entry.name))) : entry.name.endsWith(".tsx") ? [join(dir, entry.name)] : []);

  it("has a Portuguese entry for every literal passed to t()", () => {
    const missing = files("src").flatMap((file) => [...readFileSync(file, "utf8").matchAll(/\bt\(\s*"([^"]+)"/g)].map((match) => match[1]))
      .filter((key) => !(key in portuguese));
    expect([...new Set(missing)]).toEqual([]);
  });
});
