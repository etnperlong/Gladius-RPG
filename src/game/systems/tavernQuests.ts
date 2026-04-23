import type { KillRecord } from "../types/combat";
import type { StoryRewardState, TavernQuestState } from "../types/tavern";

export function applyTavernKillProgress(state: TavernQuestState, kills: KillRecord[]): TavernQuestState {
  if (!state.activeQuestId) return state;
  const progress = { ...state.progress };
  for (const kill of kills) {
    progress[kill.enemyId] = (progress[kill.enemyId] ?? 0) + kill.count;
  }
  return { ...state, progress };
}

export function claimTavernQuestReward(state: TavernQuestState): TavernQuestState {
  if (!state.activeQuestId) return state;
  const quest = (state.board as any[]).find((q) => q.id === state.activeQuestId);
  if (!quest) return state;

  const storyReward: StoryRewardState = {
    title: quest.title,
    icon: quest.icon ?? "🏆",
    conclusion: quest.conclusion,
    reward: quest.reward,
  };

  return { ...state, activeQuestId: null, storyReward };
}

export function dismissStoryReward(state: TavernQuestState): TavernQuestState {
  return { ...state, storyReward: null };
}
