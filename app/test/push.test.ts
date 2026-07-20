import { describe, expect, it } from "vitest";
import { urlBase64ToUint8Array } from "../src/lib/push";

describe("urlBase64ToUint8Array", () => {
  it("dekodiert einen URL-safe-Base64-String (wie ihn web-push für VAPID-Keys liefert)", () => {
    // "Hallo" als Standard-Base64 ist "SGFsbG8=" - URL-safe ohne Padding: "SGFsbG8"
    const bytes = urlBase64ToUint8Array("SGFsbG8");
    expect(new TextDecoder().decode(bytes)).toBe("Hallo");
  });

  it("wandelt URL-safe-Zeichen (-, _) korrekt zurück in Standard-Base64 (+, /)", () => {
    // Bytes [0xfb, 0xff, 0xbf] sind als URL-safe Base64 "-_-_" (Standard wäre "+/+/")
    const bytes = urlBase64ToUint8Array("-_-_");
    expect([...bytes]).toEqual([0xfb, 0xff, 0xbf]);
  });

  it("ergänzt fehlendes Padding korrekt für alle drei Rest-Längen (mod 4 = 2, 3, 0)", () => {
    expect(urlBase64ToUint8Array("SGk").length).toBe(2); // "Hi", Rest 3 -> +1 Padding
    expect(urlBase64ToUint8Array("SGFs").length).toBe(3); // "Hal", Rest 0 -> kein Padding
    expect(urlBase64ToUint8Array("SA").length).toBe(1); // "H", Rest 2 -> +2 Padding
  });
});
