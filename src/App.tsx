import { useState } from "react";

import { createInitialPlayer } from "./game/constants";
import {
  clearGameState,
  loadGameState,
  saveGameState,
} from "./game/persistence";
import type { GameSave } from "./game/types";

export default function App() {
  const [gameSave, setGameSave] = useState<GameSave>(() => loadGameState());
  const [status, setStatus] = useState("");

  function handleSave() {
    saveGameState(gameSave);
    setStatus("存檔邊界已連線。");
  }

  function handleClear() {
    clearGameState();
    setGameSave({ player: createInitialPlayer(), inventory: [] });
    setStatus("已清除 g_pl / g_inv。\n");
  }

  return (
    <main className="app-shell">
      <section className="hero-panel" aria-labelledby="app-title">
        <p className="eyebrow">Minimal Runnable Migration</p>
        <h1 id="app-title">GLADIUS</h1>
        <p className="hero-copy">
          Parcel, React 19, and TypeScript are wired up. Save loading now routes
          through a migration-safe persistence boundary while the legacy runtime
          is still waiting for Task 3.
        </p>
        <dl className="hero-copy" aria-label="Current save summary">
          <div>角色: {gameSave.player.name}</div>
          <div>等級: {gameSave.player.level}</div>
          <div>金幣: {gameSave.player.gold}</div>
          <div>背包數量: {gameSave.inventory.length}</div>
        </dl>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <button type="button" onClick={handleSave}>
            儲存目前殼層資料
          </button>
          <button type="button" onClick={handleClear}>
            清除舊存檔鍵值
          </button>
        </div>
        {status ? <p className="hero-copy">{status.trim()}</p> : null}
      </section>
    </main>
  );
}
