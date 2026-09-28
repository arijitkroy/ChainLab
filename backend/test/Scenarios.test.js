const test = require("node:test");
const assert = require("node:assert/strict");
const DoubleSpendScenario = require("../src/simulation/DoubleSpendScenario");
const MajorityAttackScenario = require("../src/simulation/MajorityAttackScenario");
const SelfishMiningScenario = require("../src/simulation/SelfishMiningScenario");

test("double-spend lab demonstrates independent acceptance and a reorganization", async () => {
    const result = await new DoubleSpendScenario().run({ amount: 10, difficulty: 1 });
    assert.equal(result.nodeMempools.every(node => node.accepted), true);
    assert.equal(result.reorganization.occurred, true);
    assert.equal(result.transactions.filter(transaction => transaction.status === "confirmed").length, 1);
    assert.equal(result.transactions.filter(transaction => transaction.status === "orphaned").length, 1);
});

test("majority attack model selects the branch with more work", () => {
    const result = new MajorityAttackScenario().run({ attackerHashPower: 60, rounds: 100 });
    assert.equal(result.attackerWork + result.honestWork, 100);
    assert.equal(result.selectedChain, result.attackerWork > result.honestWork ? "attacker" : "honest");
});

test("selfish-mining model reports bounded canonical revenue", () => {
    const result = new SelfishMiningScenario().run({ attackerHashPower: 0.3, propagationAdvantage: 0.5, rounds: 200 });
    assert.equal(result.attackerRevenue >= 0 && result.attackerRevenue <= 1, true);
    assert.equal(result.honestRevenue >= 0 && result.honestRevenue <= 1, true);
});
