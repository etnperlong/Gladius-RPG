import {
  createInitialEquipment,
  createInitialPlayer,
  STORAGE_KEYS,
} from "./constants";
import type { GameSave, RuntimeEquipment, RuntimeItem, RuntimePlayer } from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function resolveStorage(storage?: Storage): Storage | null {
  if (storage) {
    return storage;
  }

  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage;
}

function mergeEquipment(equipment: unknown): RuntimeEquipment {
  if (!isRecord(equipment)) {
    return createInitialEquipment();
  }

  const mergedEquipment = createInitialEquipment();

  for (const [slot, value] of Object.entries(equipment)) {
    if (value === null || isRecord(value)) {
      mergedEquipment[slot] = value;
    }
  }

  return mergedEquipment;
}

function mergePlayer(player: unknown): RuntimePlayer {
  const initialPlayer = createInitialPlayer();

  if (!isRecord(player)) {
    return initialPlayer;
  }

  return {
    ...initialPlayer,
    ...player,
    equipment: mergeEquipment(player.equipment),
  };
}

function parsePlayer(storage: Storage | null): RuntimePlayer {
  if (!storage) {
    return createInitialPlayer();
  }

  try {
    return mergePlayer(JSON.parse(storage.getItem(STORAGE_KEYS.player) ?? "null"));
  } catch {
    return createInitialPlayer();
  }
}

function parseInventory(storage: Storage | null): RuntimeItem[] {
  if (!storage) {
    return [];
  }

  try {
    const parsed = JSON.parse(storage.getItem(STORAGE_KEYS.inventory) ?? "[]");

    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function loadGame(storage?: Storage): GameSave {
  const resolvedStorage = resolveStorage(storage);

  return {
    player: parsePlayer(resolvedStorage),
    inventory: parseInventory(resolvedStorage),
  };
}

export function saveGame(save: GameSave, storage?: Storage): void {
  const resolvedStorage = resolveStorage(storage);

  if (!resolvedStorage) {
    return;
  }

  resolvedStorage.setItem(STORAGE_KEYS.player, JSON.stringify(save.player));
  resolvedStorage.setItem(STORAGE_KEYS.inventory, JSON.stringify(save.inventory));
}

export function clearGame(storage?: Storage): void {
  const resolvedStorage = resolveStorage(storage);

  if (!resolvedStorage) {
    return;
  }

  resolvedStorage.removeItem(STORAGE_KEYS.player);
  resolvedStorage.removeItem(STORAGE_KEYS.inventory);
}
