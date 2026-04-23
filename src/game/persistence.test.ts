import { describe, expect, it } from "vitest";

import { INITIAL_EQUIPMENT, INITIAL_PLAYER } from "./constants";
import { clearGame, loadGame, saveGame } from "./persistence";

function createStorage(seed: Record<string, string> = {}): Storage {
  const data = new Map(Object.entries(seed));

  return {
    get length() {
      return data.size;
    },
    clear() {
      data.clear();
    },
    getItem(key) {
      return data.has(key) ? data.get(key)! : null;
    },
    key(index) {
      return Array.from(data.keys())[index] ?? null;
    },
    removeItem(key) {
      data.delete(key);
    },
    setItem(key, value) {
      data.set(key, value);
    },
  };
}

describe("loadGame", () => {
  it("returns migration-safe defaults when storage is empty", () => {
    const save = loadGame(createStorage());

    expect(save.player).toEqual(INITIAL_PLAYER);
    expect(save.inventory).toEqual([]);
  });

  it("merges saved player data over defaults and preserves all equipment slots", () => {
    const storage = createStorage({
      g_pl: JSON.stringify({
        name: "測試角鬥士",
        gold: 999,
        equipment: {
          weapon: { uid: "blade-1", name: "短劍" },
        },
      }),
      g_inv: JSON.stringify([{ uid: "loot-1", name: "戰利品" }]),
    });

    const save = loadGame(storage);

    expect(save.player.name).toBe("測試角鬥士");
    expect(save.player.gold).toBe(999);
    expect(save.player.equipment).toEqual({
      ...INITIAL_EQUIPMENT,
      weapon: { uid: "blade-1", name: "短劍" },
    });
    expect(save.inventory).toEqual([{ uid: "loot-1", name: "戰利品" }]);
  });

  it("falls back safely when stored payloads are malformed", () => {
    const storage = createStorage({
      g_pl: "{bad json",
      g_inv: JSON.stringify({ not: "an array" }),
    });

    const save = loadGame(storage);

    expect(save.player).toEqual(INITIAL_PLAYER);
    expect(save.inventory).toEqual([]);
  });
});

describe("saveGame", () => {
  it("writes the canonical save keys", () => {
    const storage = createStorage();
    const player = {
      ...INITIAL_PLAYER,
      gold: 321,
      equipment: {
        ...INITIAL_EQUIPMENT,
        weapon: { uid: "blade-2", name: "訓練劍" },
      },
    };
    const inventory = [{ uid: "loot-2", name: "皮甲" }];

    saveGame({ player, inventory }, storage);

    expect(storage.getItem("g_pl")).toBe(JSON.stringify(player));
    expect(storage.getItem("g_inv")).toBe(JSON.stringify(inventory));
  });
});

describe("clearGame", () => {
  it("removes the canonical save keys", () => {
    const storage = createStorage({
      g_pl: JSON.stringify(INITIAL_PLAYER),
      g_inv: JSON.stringify([]),
    });

    clearGame(storage);

    expect(storage.getItem("g_pl")).toBeNull();
    expect(storage.getItem("g_inv")).toBeNull();
  });
});
