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

export type RuntimeItem = Record<string, any>;

export type RuntimeEquipment = Record<EquipmentSlotId, RuntimeItem | null>;

export type RuntimeLogEntry = {
  txt: string;
  type: string;
};

export type RuntimeQuestProgressEntry = {
  collected: boolean;
  baseVal: number;
};

export type RuntimeQuestState = {
  progress: Record<string, RuntimeQuestProgressEntry>;
  dailyDate: string;
  weeklyDate: string;
};

export type RuntimeArenaOpponent = Record<string, any> & {
  id: number;
  name: string;
  title: string;
  level: number;
  tier: string;
  attack: number;
  defense: number;
  maxHp: number;
  hp: number;
  equipment: RuntimeEquipment;
  goldCarried: number;
  wcKey: string;
  wins: number;
  losses: number;
};

export type RuntimeArenaState = {
  arenaOpponents: RuntimeArenaOpponent[];
  arenaInjuredUntil: number;
  arenaRefreshes: number;
  arenaLastDate: string;
};

export type RuntimeReplay = Record<string, any> & {
  lines: RuntimeLogEntry[];
  cursor: number;
  drops: RuntimeItem[];
  won: boolean;
  isArena?: boolean;
  isExpedition?: boolean;
  isMerc?: boolean;
  dungeon?: RuntimeItem | null;
  tier?: RuntimeItem | null;
  expedition?: RuntimeItem | null;
  mercDungeonId?: string;
  opponent?: RuntimeArenaOpponent | null;
};

export type RuntimePlayer = Record<string, any> & {
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
