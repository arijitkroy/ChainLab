const test = require("node:test");
const assert = require("node:assert/strict");
const Blockchain = require("../src/blockchain/Blockchain");
const Mempool = require("../src/blockchain/Mempool");
const { Transaction } = require("../src/blockchain/Transaction");

function spend(recipient, timestamp) {
    return new Transaction({
        inputs: [{ txId: "GENESIS", outputIndex: 0 }],
        outputs: [{ address: recipient, amount: 49.999 }],
        fee: 0.001,
        timestamp
    });
}

test("mempool rejects duplicate IDs and conflicting spends", () => {
    const blockchain = new Blockchain();
    const mempool = new Mempool({ maxSize: 5 });
    const first = spend("Bob", 1);
    const conflict = spend("Charlie", 2);

    assert.equal(mempool.addTransaction(first, blockchain).accepted, true);
    assert.equal(mempool.addTransaction(first, blockchain).reason, "Duplicate transaction");
    assert.equal(mempool.addTransaction(conflict, blockchain).reason, "Double spend detected");
    assert.equal(mempool.getTransactions().length, 1);
});

test("mempool enforces its capacity and can clear reservations", () => {
    const blockchain = new Blockchain();
    const mempool = new Mempool({ maxSize: 1 });
    const first = spend("Bob", 3);

    assert.equal(mempool.addTransaction(first, blockchain).accepted, true);
    assert.equal(mempool.addTransaction(spend("Carol", 4), blockchain).reason, "Mempool is full");
    assert.equal(mempool.removeTransaction(first.id), true);
    assert.equal(mempool.hasTransaction(first.id), false);
    mempool.clear();
    assert.equal(mempool.size, 0);
});
