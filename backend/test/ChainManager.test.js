const test = require("node:test");
const assert = require("node:assert/strict");
const Block = require("../src/blockchain/Block");
const Blockchain = require("../src/blockchain/Blockchain");
const ChainManager = require("../src/blockchain/ChainManager");
const { Transaction } = require("../src/blockchain/Transaction");

function coinbaseBlock(parent, height, miner) {
    return new Block({
        height,
        previousHash: parent.hash,
        transactions: [Transaction.createCoinbase(miner, 50)],
        difficulty: 1
    }).mine();
}

test("selects a higher-work fork and reports a reorganization", () => {
    const blockchain = new Blockchain();
    const genesis = blockchain.getLatestBlock();
    const manager = new ChainManager(blockchain);
    const first = coinbaseBlock(genesis, 1, "Miner A");
    const competing = coinbaseBlock(genesis, 1, "Miner B");

    assert.equal(manager.addBlock(first).canonicalChanged, true);
    assert.equal(manager.addBlock(competing).forkDetected, true);
    assert.equal(manager.canonicalTip.hash, first.hash);

    const extension = coinbaseBlock(competing, 2, "Miner B");
    const result = manager.addBlock(extension);
    assert.equal(result.reorganization, true);
    assert.equal(result.forkPoint.height, 0);
    assert.equal(manager.canonicalTip.hash, extension.hash);
    assert.equal(ChainManager.calculateChainWork(manager.getBestChain()), manager.getCumulativeWork(extension.hash));
});
