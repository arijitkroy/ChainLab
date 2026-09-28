const test = require("node:test");
const assert = require("node:assert/strict");
const Block = require("../src/blockchain/Block");
const Blockchain = require("../src/blockchain/Blockchain");
const { Transaction } = require("../src/blockchain/Transaction");

function candidate(blockchain, overrides = {}) {
    return new Block({
        height: 1,
        previousHash: blockchain.getLatestBlock().hash,
        transactions: [Transaction.createCoinbase("Miner", 50)],
        difficulty: 1,
        ...overrides
    }).mine();
}

test("accepts a valid block and rejects a mutated hash", () => {
    const blockchain = new Blockchain();
    const valid = candidate(blockchain);
    assert.equal(blockchain.validateBlock(valid).valid, true);

    const invalidHash = Object.assign(Object.create(Object.getPrototypeOf(valid)), valid, { hash: "f".repeat(64) });
    assert.equal(blockchain.validateBlock(invalidHash).reason, "Invalid block hash");
});

test("rejects an unknown previous hash and an invalid Merkle root", () => {
    const blockchain = new Blockchain();
    const wrongParent = candidate(blockchain, { previousHash: "unknown" });
    assert.equal(blockchain.validateBlock(wrongParent).reason, "Previous hash mismatch");

    const invalidRoot = candidate(blockchain);
    invalidRoot.merkleRoot = "1".repeat(64);
    invalidRoot.hash = invalidRoot.calculateHash();
    invalidRoot.mine();
    assert.equal(blockchain.validateBlock(invalidRoot).reason, "Merkle root mismatch");
});

test("rejects coinbase value above subsidy and fees", () => {
    const blockchain = new Blockchain();
    const overpaying = candidate(blockchain, {
        transactions: [Transaction.createCoinbase("Miner", 50.1)]
    });
    assert.equal(blockchain.validateBlock(overpaying).reason, "Coinbase reward exceeds block reward plus fees");
});
