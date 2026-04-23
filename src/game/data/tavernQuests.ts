export interface TavernQuestDef {
  id: string;
  targetId: string;
  targetCount: number;
  title: string;
  icon: string;
  conclusion: string;
  reward: { gold: number; exp: number };
}

export const TAVERN_QUEST_DEFS: TavernQuestDef[] = [
  {
    id: "wolf_hunt",
    targetId: "wolf",
    targetCount: 5,
    title: "討伐餓狼",
    icon: "🐺",
    conclusion: "你清除了附近的狼群，村民們感謝你的英勇。",
    reward: { gold: 80, exp: 50 },
  },
  {
    id: "goblin_raid",
    targetId: "goblin",
    targetCount: 8,
    title: "哥布林掃蕩",
    icon: "👺",
    conclusion: "哥布林部落已被驅散，商路再度暢通。",
    reward: { gold: 120, exp: 80 },
  },
  {
    id: "skeleton_purge",
    targetId: "skeleton",
    targetCount: 6,
    title: "淨化亡骸",
    icon: "💀",
    conclusion: "骷髏士兵已被消滅，古墓重歸寧靜。",
    reward: { gold: 100, exp: 70 },
  },
];
