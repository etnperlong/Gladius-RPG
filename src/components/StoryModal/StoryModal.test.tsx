import { render, screen } from "@testing-library/react";
import { it, expect } from "vitest";
import { StoryModal } from "./StoryModal";

it("renders the upstream heading and action text", () => {
  render(<StoryModal story={{ title: "討伐完成", icon: "🗡", conclusion: "故事結尾", reward: { gold: 10, exp: 20 } }} />);
  expect(screen.getByText("QUEST COMPLETE")).toBeInTheDocument();
  expect(screen.getByText("收下賞金，離開酒館")).toBeInTheDocument();
});
