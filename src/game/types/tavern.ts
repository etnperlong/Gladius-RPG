export interface StoryRewardState {
  title: string;
  icon: string;
  conclusion: string;
  reward: { gold: number; exp: number };
}

export interface TavernQuestState {
  board: unknown[];
  activeQuestId: string | null;
  progress: Record<string, number>;
  storyReward: StoryRewardState | null;
}
