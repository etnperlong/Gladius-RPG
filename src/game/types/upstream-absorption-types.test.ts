import { describe, expectTypeOf, it } from "vitest";
import type { CombatResult, KillRecord } from "./combat";
import type { RecoveryState } from "./recovery";
import type { StoryRewardState, TavernQuestState } from "./tavern";

describe("upstream absorption shared types", () => {
  it("exposes combat result records for downstream systems", () => {
    expectTypeOf<CombatResult>().toMatchTypeOf<{
      outcome: "win" | "loss" | "draw";
      kills: KillRecord[];
      rewards: { exp: number; gold: number };
    }>();
  });

  it("exposes independent recovery timestamps", () => {
    expectTypeOf<RecoveryState>().toMatchTypeOf<{
      dungeonInjuredUntil: number;
      arenaInjuredUntil: number;
    }>();
  });

  it("exposes tavern quest and story reward state", () => {
    expectTypeOf<TavernQuestState>().toMatchTypeOf<object>();
    expectTypeOf<StoryRewardState | null>().toMatchTypeOf<object | null>();
  });
});
