import { describe, expect, it } from "vitest";
import {
  buildPlayersSummary,
  nextPlayerStatusAfterRevoke,
  resolvePlayerStatus,
  sanctionCode,
  sanctionIsActive,
} from "@/lib/players";

const NOW = new Date("2026-11-07T12:00:00.000Z");

describe("players", () => {
  it("formate le code de sanction", () => {
    expect(sanctionCode(7)).toBe("SAN-0007");
    expect(sanctionCode(1234)).toBe("SAN-1234");
  });

  it("considere un bannissement definitif comme actif", () => {
    expect(
      sanctionIsActive({ type: "PERMANENT_BAN", revokedAt: null, endsAt: null }, NOW),
    ).toBe(true);
  });

  it("expire un bannissement temporaire arrive a echeance", () => {
    expect(
      sanctionIsActive(
        {
          type: "TEMP_BAN",
          revokedAt: null,
          endsAt: "2026-11-07T11:59:00.000Z",
        },
        NOW,
      ),
    ).toBe(false);
    expect(
      sanctionIsActive(
        {
          type: "TEMP_BAN",
          revokedAt: null,
          endsAt: "2026-11-08T12:00:00.000Z",
        },
        NOW,
      ),
    ).toBe(true);
  });

  it("ignore une sanction revoquee", () => {
    expect(
      sanctionIsActive(
        {
          type: "PERMANENT_BAN",
          revokedAt: "2026-11-07T10:00:00.000Z",
          endsAt: null,
        },
        NOW,
      ),
    ).toBe(false);
  });

  it("ne bloque pas un avertissement ou une expulsion", () => {
    expect(
      sanctionIsActive(
        { type: "WARNING", revokedAt: null, endsAt: "2027-01-01T00:00:00.000Z" },
        NOW,
      ),
    ).toBe(false);
    expect(sanctionIsActive({ type: "KICK", revokedAt: null, endsAt: null }, NOW)).toBe(false);
  });

  it("resume les joueurs et les sanctions", () => {
    const summary = buildPlayersSummary(
      [
        {
          status: "ACTIVE",
          sanctions: [{ active: false, createdAt: "2026-11-01T10:00:00.000Z" }],
        },
        {
          status: "BANNED",
          sanctions: [
            { active: true, createdAt: "2026-11-06T10:00:00.000Z" },
            { active: false, createdAt: "2026-09-01T10:00:00.000Z" },
          ],
        },
        { status: "WATCHED", sanctions: [] },
      ],
      NOW,
    );

    expect(summary).toEqual({
      total: 3,
      active: 1,
      watched: 1,
      banned: 1,
      activeSanctions: 1,
      sanctions30d: 2,
    });
  });

  it("deduit le statut effectif a partir des bannissements", () => {
    expect(
      resolvePlayerStatus(
        "BANNED",
        [{ type: "TEMP_BAN", revokedAt: null, endsAt: "2026-11-07T11:00:00.000Z" }],
        NOW,
      ),
    ).toBe("ACTIVE");
    expect(
      resolvePlayerStatus(
        "ACTIVE",
        [{ type: "PERMANENT_BAN", revokedAt: null, endsAt: null }],
        NOW,
      ),
    ).toBe("BANNED");
    expect(
      resolvePlayerStatus(
        "BANNED",
        [{ type: "PERMANENT_BAN", revokedAt: "2026-11-01T10:00:00.000Z", endsAt: null }],
        NOW,
      ),
    ).toBe("ACTIVE");
    expect(resolvePlayerStatus("BANNED", [], NOW)).toBe("BANNED");
    expect(
      resolvePlayerStatus(
        "SUSPENDED",
        [{ type: "TEMP_BAN", revokedAt: null, endsAt: "2026-11-06T10:00:00.000Z" }],
        NOW,
      ),
    ).toBe("SUSPENDED");
  });

  it("reactive un joueur banni quand plus aucun ban n'est actif", () => {
    expect(nextPlayerStatusAfterRevoke("BANNED", 0)).toBe("ACTIVE");
    expect(nextPlayerStatusAfterRevoke("BANNED", 1)).toBe("BANNED");
    expect(nextPlayerStatusAfterRevoke("WATCHED", 0)).toBe("WATCHED");
  });
});
