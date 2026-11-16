import { describe, expect, it } from "vitest";
import {
  hasPermission,
  resolvePermissions,
  effectivePermissionList,
  ROLE_PERMISSIONS,
} from "@/server/permissions";

describe("permissions", () => {
  it("donne les droits developpeur de base", () => {
    expect(hasPermission({ role: "DEVELOPER" }, "files.write")).toBe(true);
    expect(hasPermission({ role: "DEVELOPER" }, "sessions.start")).toBe(true);
    expect(hasPermission({ role: "DEVELOPER" }, "server.power")).toBe(false);
    expect(hasPermission({ role: "DEVELOPER" }, "users.manage")).toBe(false);
    expect(hasPermission({ role: "DEVELOPER" }, "knowledge.view")).toBe(true);
    expect(hasPermission({ role: "DEVELOPER" }, "knowledge.manage")).toBe(false);
    expect(hasPermission({ role: "DEVELOPER" }, "maintenance.view")).toBe(true);
    expect(hasPermission({ role: "DEVELOPER" }, "maintenance.manage")).toBe(false);
  });

  it("donne tous les droits au super administrateur", () => {
    const map = resolvePermissions({ role: "SUPER_ADMIN" });
    expect(Object.values(map).every(Boolean)).toBe(true);
  });

  it("permet de retirer un droit a un super administrateur", () => {
    expect(
      hasPermission(
        { role: "SUPER_ADMIN", permissionsDenied: ["server.power"] },
        "server.power",
      ),
    ).toBe(false);
    expect(hasPermission({ role: "SUPER_ADMIN", permissionsDenied: ["server.power"] }, "audit.view")).toBe(true);
  });

  it("ajoute et retire des permissions granulaires", () => {
    const subject = {
      role: "DEVELOPER" as const,
      permissionsGranted: ["server.power"],
      permissionsDenied: ["files.upload"],
    };
    expect(hasPermission(subject, "server.power")).toBe(true);
    expect(hasPermission(subject, "files.upload")).toBe(false);
    expect(hasPermission(subject, "files.write")).toBe(true);
  });

  it("ignore les permissions inconnues", () => {
    const map = resolvePermissions({
      role: "DEVELOPER",
      permissionsGranted: ["does.not.exist"],
      permissionsDenied: ["nope"],
    });
    expect(Object.values(map).every((value) => typeof value === "boolean")).toBe(true);
  });

  it("refuse tout pour un utilisateur absent", () => {
    expect(hasPermission(null, "files.view")).toBe(false);
    expect(hasPermission(undefined, "tasks.view")).toBe(false);
  });

  it("expose une liste effective coherente", () => {
    const list = effectivePermissionList({ role: "ADMIN" });
    expect(list).toContain("users.manage");
    expect(list).toContain("server.power");
    expect(list).not.toContain("unknown.permission");
  });

  it("le role LEAD_DEV supervise sans administrer", () => {
    expect(hasPermission({ role: "LEAD_DEV" }, "tasks.validate")).toBe(true);
    expect(hasPermission({ role: "LEAD_DEV" }, "users.manage")).toBe(false);
    expect(hasPermission({ role: "LEAD_DEV" }, "sync.manage")).toBe(true);
    expect(hasPermission({ role: "LEAD_DEV" }, "knowledge.manage")).toBe(true);
    expect(hasPermission({ role: "LEAD_DEV" }, "maintenance.manage")).toBe(true);
    expect(hasPermission({ role: "DEVELOPER" }, "sync.manage")).toBe(false);
    expect(ROLE_PERMISSIONS.LEAD_DEV).toContain("deployments.approve");
  });
});
