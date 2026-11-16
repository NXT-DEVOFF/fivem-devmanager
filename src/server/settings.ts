/** Reglages applicatifs persistes (AppSetting). */
import "server-only";
import { prisma } from "@/lib/prisma";

export interface AppSettings {
  serverName: string;
  gameVersion: string;
  currentVersion: string;
  defaultIdleMinutes: number;
  autoValidationEnabled: boolean;
  defaultSftpRoot: string;
  timezone: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  serverName: "FiveM DevManager",
  gameVersion: "FXServer",
  currentVersion: "1.0.0",
  defaultIdleMinutes: 15,
  autoValidationEnabled: false,
  defaultSftpRoot: "/",
  timezone: "Europe/Paris",
};

const SETTINGS_KEY = "app.settings";

export async function getSettings(): Promise<AppSettings> {
  const record = await prisma.appSetting.findUnique({ where: { key: SETTINGS_KEY } });
  if (!record) return DEFAULT_SETTINGS;
  const value = (record.value ?? {}) as Partial<AppSettings>;
  return { ...DEFAULT_SETTINGS, ...value };
}

export async function updateSettings(patch: Partial<AppSettings>, updatedById: string): Promise<AppSettings> {
  const current = await getSettings();
  const next: AppSettings = {
    ...current,
    ...patch,
    defaultIdleMinutes: Math.min(
      180,
      Math.max(1, Number(patch.defaultIdleMinutes ?? current.defaultIdleMinutes) || 15),
    ),
  };
  await prisma.appSetting.upsert({
    where: { key: SETTINGS_KEY },
    create: { key: SETTINGS_KEY, value: next as object, updatedById },
    update: { value: next as object, updatedById },
  });
  return next;
}

/** Version applicative affichee dans les patch notes. */
export async function nextPatchVersion(): Promise<string> {
  const settings = await getSettings();
  const last = await prisma.patchNote.findFirst({
    orderBy: { createdAt: "desc" },
    select: { version: true },
  });
  const base = last?.version ?? settings.currentVersion;
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(base);
  if (!match) return `${settings.currentVersion}.1`;
  const major = Number(match[1]);
  const minor = Number(match[2]);
  const patch = Number(match[3]) + 1;
  return `${major}.${minor}.${patch}`;
}
