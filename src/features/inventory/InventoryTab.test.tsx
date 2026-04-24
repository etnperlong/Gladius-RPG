import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";

import { InventoryTab } from "./InventoryTab";

it("renders inventory controls, filters, and item actions", () => {
  render(
    <InventoryTab
      inventoryCount={2}
      inventoryFilterOptions={[
        { id: "all", isActive: true, label: "全部", onSelect: vi.fn() },
        { id: "weapon", isActive: false, label: "武器", onSelect: vi.fn() },
      ]}
      isEmpty={false}
      inventoryItems={[
        {
          item: {
            uid: "potion-1",
            type: "potion",
            icon: "🧪",
            name: "小型藥水",
            rarity: "normal",
            cat: undefined,
            attack: 0,
            defense: 0,
            hp: 0,
            speed: 0,
            heal: 25,
            enhLv: 0,
            itemLevel: 0,
            slot: undefined,
            cost: 12,
            affixes: [],
            specials: [],
          },
          onUse: vi.fn(),
          onSell: vi.fn(),
          price: 12,
          rarity: { color: "#50a860", glow: "", label: "普通" },
          onEquip: undefined,
          onSelectMerc: undefined,
          selectLabel: "",
        },
        {
          item: {
            uid: "scroll-1",
            type: "merc_scroll",
            icon: "🛡",
            name: "傭兵契約",
            rarity: "rare",
            cat: undefined,
            attack: 3,
            defense: 4,
            hp: 5,
            speed: 0,
            heal: 1,
            enhLv: 0,
            itemLevel: 0,
            slot: "merc_scroll",
            cost: 40,
            affixes: [{ special: "all", rolledVal: 0.1, tag: "軍紀" }],
            specials: [],
            desc: "可靠的傭兵。",
          },
          onUse: undefined,
          onSell: vi.fn(),
          price: 40,
          rarity: { color: "#d08030", glow: "0 0 8px #d08030", label: "稀有" },
          onEquip: undefined,
          onSelectMerc: vi.fn(),
          selectLabel: "選入傭兵隊",
        },
      ]}
      onSortInventory={vi.fn()}
      onSellJunk={vi.fn()}
    />,
  );

  expect(screen.getByText("背包")).toBeInTheDocument();
  expect(screen.getByText("— 2 件")).toBeInTheDocument();
  expect(screen.getByText("全部")).toBeInTheDocument();
  expect(screen.getByText("武器")).toBeInTheDocument();
  expect(screen.getByText("回復 25HP")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "使用" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "選入傭兵隊" })).toBeInTheDocument();
  expect(screen.getByText("軍紀:全屬+10%")).toBeInTheDocument();
});
