import { render, screen } from "@testing-library/react";
import { it, expect } from "vitest";
import { TavernPage } from "./TavernPage";

it("renders the inn panel and recovery copy", () => {
  render(<TavernPage player={{ hp: 40, maxHp: 100 }} recovery={{ dungeonInjuredUntil: Date.now() + 60_000, arenaInjuredUntil: 0 }} />);
  expect(screen.getByText("酒館旅店")).toBeInTheDocument();
});
