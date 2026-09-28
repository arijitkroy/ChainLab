const test = require("node:test");
const assert = require("node:assert/strict");
const Block = require("../src/blockchain/Block");
const Miner = require("../src/blockchain/Miner");

test("mines a block below the configured target and reports work", async () => {
    const miner = new Miner();
    const block = new Block({ height: 1, previousHash: "0".repeat(64), difficulty: 0 });
    const result = await miner.mineBlock(block);

    assert.equal(miner.isValidProof(result.successfulHash, result.target), true);
    assert.equal(result.attempts, 1);
    assert.equal(result.block.hash, result.successfulHash);
    assert.equal(result.hashRate >= 0, true);
});
