const test = require("node:test");
const assert = require("node:assert/strict");
const DifficultyAdjustment = require("../src/blockchain/DifficultyAdjustment");

test("retargets faster-than-target blocks within configured limits", () => {
    const adjustment = new DifficultyAdjustment({ interval: 2, targetBlockTimeSeconds: 10, minimum: 1, maximum: 6 });
    const result = adjustment.adjust([
        { timestamp: 0 },
        { timestamp: 500 },
        { timestamp: 1000 }
    ], 2);

    assert.equal(result.adjusted, true);
    assert.equal(result.difficulty, 3);
    assert.equal(result.targetBlockTimeSeconds, 10);
});
