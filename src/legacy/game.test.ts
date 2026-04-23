import { describe, expect, it } from "vitest";

import { TRAIN_STAT_DISPLAY_KEYS } from "./game";

describe("train stat display mapping", () => {
  it("uses concrete player stat keys instead of derived abbreviations", () => {
    expect(TRAIN_STAT_DISPLAY_KEYS.trainedAtk).toBe("attack");
    expect(TRAIN_STAT_DISPLAY_KEYS.trainedDef).toBe("defense");
    expect(TRAIN_STAT_DISPLAY_KEYS.trainedSpd).toBe("speed");
  });
});
