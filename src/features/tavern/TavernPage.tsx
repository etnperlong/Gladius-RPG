import type { RecoveryState } from "../../game/types/recovery";
import { InnPanel } from "./InnPanel";

interface TavernPageProps {
  player: { hp: number; maxHp: number };
  recovery: RecoveryState;
}

export function TavernPage({ player, recovery }: TavernPageProps) {
  return (
    <section>
      <h2>🍺 酒館</h2>
      <InnPanel player={player} recovery={recovery} />
    </section>
  );
}
