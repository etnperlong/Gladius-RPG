import { describe, expect, it } from "vitest";
import { applyTavernKillProgress, claimTavernQuestReward } from "./tavernQuests";
import type { TavernQuestState } from "../types/tavern";

function mockActiveQuestState(): TavernQuestState {
  return {
    board: [{ id: "wolf_hunt", targetId: "wolf", targetCount: 5, reward: { gold: 50, exp: 30 }, title: "討伐餓狼", conclusion: "你完成了任務" }],
    activeQuestId: "wolf_hunt",
    progress: { wolf: 0 },
    storyReward: null,
  };
}

function mockCompletedQuestState(): TavernQuestState {
  return {
    board: [{ id: "wolf_hunt", targetId: "wolf", targetCount: 2, reward: { gold: 50, exp: 30 }, title: "討伐餓狼", icon: "🐺", conclusion: "你完成了任務" }],
    activeQuestId: "wolf_hunt",
    progress: { wolf: 5 },
    storyReward: null,
  };
}

describe("tavern quests", () => {
  it("increments progress from structured kill records", () => {
    const state = applyTavernKillProgress(mockActiveQuestState(), [{ enemyId: "wolf", enemyName: "餓狼", count: 2 }]);
    expect(state.progress.wolf).toBe(2);
  });

  it("creates story reward state when claiming a completed quest", () => {
    const result = claimTavernQuestReward(mockCompletedQuestState());
    expect(result.storyReward?.title).toBeTruthy();
    expect(result.storyReward?.conclusion).toBeTruthy();
  });
});
