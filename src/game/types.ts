export const EQUIPMENT_SLOT_IDS = [
  "weapon",
  "offhand",
  "helmet",
  "armor",
  "gloves",
  "boots",
  "ring",
  "amulet",
] as const;

export type EquipmentSlotId = (typeof EQUIPMENT_SLOT_IDS)[number];

export type RuntimeItem = Record<string, unknown>;

export type RuntimeEquipment = Record<string, RuntimeItem | null>;

export type RuntimePlayer = Record<string, unknown> & {
  name: string;
  level: number;
  exp: number;
  expNeeded: number;
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  speed: number;
  gold: number;
  equipment: RuntimeEquipment;
  trainedAtk: number;
  trainedDef: number;
  trainedHp: number;
  trainedSpd: number;
  totalKills: number;
  totalBossKills: number;
  totalDungeons: number;
  totalExpeditions: number;
  totalArenaWins: number;
  totalGoldEarned: number;
  totalEnhances: number;
  totalTrains: number;
  totalMercRuns: number;
  highestLevel: number;
};

export type GameSave = {
  player: RuntimePlayer;
  inventory: RuntimeItem[];
};
