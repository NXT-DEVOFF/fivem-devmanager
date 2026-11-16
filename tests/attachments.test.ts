import { describe, expect, it } from "vitest";
import {
  attachmentMimeType,
  sanitizeAttachmentName,
  validateAttachment,
} from "@/server/attachment-rules";

describe("pieces jointes", () => {
  it("supprime les chemins et caracteres dangereux", () => {
    expect(sanitizeAttachmentName("../../etc/passwd.png")).toBe("passwd.png");
    expect(sanitizeAttachmentName("C:\\Windows\\photo.png")).toBe("photo.png");
    expect(sanitizeAttachmentName('capture "ecran".png')).toBe("capture _ecran_.png");
    expect(sanitizeAttachmentName("   ")).toBe("fichier");
  });

  it("conserve l'extension en tronquant un nom trop long", () => {
    const name = `${"a".repeat(300)}.png`;
    const clean = sanitizeAttachmentName(name);
    expect(clean.endsWith(".png")).toBe(true);
    expect(clean.length).toBeLessThanOrEqual(104);
  });

  it("neutralise les noms reserves Windows", () => {
    expect(sanitizeAttachmentName("CON.txt")).toBe("fichier-CON.txt");
  });

  it("n'accepte que les types autorises", () => {
    expect(attachmentMimeType("capture.PNG")).toBe("image/png");
    expect(attachmentMimeType("log.txt")).toContain("text/plain");
    expect(attachmentMimeType("rapport.pdf")).toBe("application/pdf");
    expect(attachmentMimeType("script.lua")).toBeNull();
    expect(attachmentMimeType("archive.zip")).toBeNull();
    expect(attachmentMimeType("sans-extension")).toBeNull();
  });

  it("valide la taille et le type", () => {
    expect(validateAttachment("capture.png", 2048)).toBeNull();
    expect(validateAttachment("capture.png", 0)).not.toBeNull();
    expect(validateAttachment("capture.png", 9 * 1024 * 1024)).not.toBeNull();
    expect(validateAttachment("script.lua", 100)).not.toBeNull();
  });
});
