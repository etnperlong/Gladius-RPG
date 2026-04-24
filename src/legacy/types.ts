import type {
  RuntimeArenaOpponent,
  RuntimeItem,
  RuntimePlayer,
  RuntimeQuestState,
  RuntimeReplay,
} from "../game/types";

export type AnyRecord = Record<string, any>;
export type AnyList = any[];

export type LegacyItem = RuntimeItem & AnyRecord & {
  uid: any;
  name: any;
  icon: any;
  rarity: any;
  cat: any;
  attack: any;
  defense: any;
  hp: any;
  speed: any;
  heal: any;
  enhLv: any;
  itemLevel: any;
  slot: any;
  type: any;
  cost: any;
  affixes: any[];
  specials: any[];
};

export type LegacyPlayer = RuntimePlayer & AnyRecord & {
  level: any;
  exp: any;
  expNeeded: any;
  hp: any;
  maxHp: any;
  attack: any;
  defense: any;
  speed: any;
  gold: any;
  equipment: AnyRecord;
};

export type LegacyQuestState = RuntimeQuestState & AnyRecord;

export type LegacyArenaOpponent = Omit<RuntimeArenaOpponent, "equipment"> & AnyRecord & {
  equipment: AnyRecord;
  attack: any;
  defense: any;
  maxHp: any;
  hp: any;
  goldCarried: any;
};

export type LegacyReplay = Omit<RuntimeReplay, "drops" | "dungeon" | "tier" | "expedition" | "opponent"> & AnyRecord & {
  lines: any[];
  cursor: any;
  drops: LegacyItem[];
  won?: any;
  dungeon?: any;
  tier?: any;
  expedition?: any;
  opponent?: any;
};

export type LootDrop = LegacyItem & { _remaining?: LegacyItem[] };
