import { describe, expect, it } from "vitest";
import {
  assertWithinRoot,
  baseName,
  detectResource,
  extensionOf,
  isEditable,
  joinRemotePath,
  normalizeRemotePath,
  parentPath,
} from "@/server/path-safety";

describe("securite des chemins", () => {
  it("normalise un chemin absolu", () => {
    expect(normalizeRemotePath("resources/garage/client.lua")).toBe("/resources/garage/client.lua");
    expect(normalizeRemotePath("/resources/./garage//client.lua")).toBe("/resources/garage/client.lua");
  });

  it("refuse toute traversee de repertoire", () => {
    expect(() => normalizeRemotePath("/resources/../../etc/passwd")).toThrow();
    expect(() => normalizeRemotePath("/resources/garage/../secret")).toThrow();
    expect(() => normalizeRemotePath("../secret")).toThrow();
  });

  it("refuse les antislashs et caracteres nuls", () => {
    expect(() => normalizeRemotePath("C:\\Windows\\system.ini")).toThrow();
    expect(() => normalizeRemotePath("/resources/a\0b.lua")).toThrow();
  });

  it("bloque un chemin hors racine autorisee", () => {
    expect(() => assertWithinRoot("/etc/passwd", "/resources")).toThrow();
    expect(() => assertWithinRoot("/resources/garage", "/resources")).not.toThrow();
  });

  it("detecte la ressource FiveM, y compris les categories", () => {
    expect(detectResource("/resources/garage/client.lua")).toBe("garage");
    expect(detectResource("/resources/[vehicles]/garage/server.lua")).toBe("[vehicles]/garage");
    expect(detectResource("/scripts/autre.lua")).toBeNull();
    expect(detectResource("/resources")).toBeNull();
  });

  it("calcule parent et nom", () => {
    expect(parentPath("/resources/garage/client.lua")).toBe("/resources/garage");
    expect(parentPath("/client.lua")).toBe("/");
    expect(baseName("/resources/garage/client.lua")).toBe("client.lua");
  });

  it("valide l'edition selon l'extension", () => {
    expect(isEditable("/resources/garage/client.lua")).toBe(true);
    expect(isEditable("/resources/garage/fxmanifest.lua")).toBe(true);
    expect(isEditable("/resources/garage/config.json")).toBe(true);
    expect(isEditable("/resources/garage/image.png")).toBe(false);
    expect(extensionOf("/resources/garage/FxManifest.lua")).toBe(".lua");
  });

  it("construit un chemin enfant sans autoriser l'evasion", () => {
    expect(joinRemotePath("/resources/garage", "client.lua")).toBe("/resources/garage/client.lua");
    expect(() => joinRemotePath("/resources/garage", "../secret")).toThrow();
    expect(() => joinRemotePath("/resources/garage", "a/b")).toThrow();
  });
});
