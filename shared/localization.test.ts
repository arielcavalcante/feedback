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
