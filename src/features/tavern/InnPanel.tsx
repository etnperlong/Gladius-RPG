import type { RecoveryState } from "../../game/types/recovery";

interface InnPanelProps {
  player: { hp: number; maxHp: number };
  recovery: RecoveryState;
}

export function InnPanel({ player, recovery }: InnPanelProps) {
  const now = Date.now();
  const dungeonInjured = recovery.dungeonInjuredUntil > now;
  const arenaInjured = recovery.arenaInjuredUntil > now;

  return (
    <div>
      <h3>酒館旅店</h3>
      <p>
        HP：{player.hp} / {player.maxHp}
      </p>
      {dungeonInjured && <p>地下城受傷中，無法出征</p>}
      {arenaInjured && <p>競技場受傷中，無法參賽</p>}
    </div>
  );
}
