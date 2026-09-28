const test = require("node:test");
const assert = require("node:assert/strict");
const UTXOSet = require("../src/blockchain/UTXOSet");

test("tracks UTXOs, address balances, and simplified locking conditions", () => {
    const utxoSet = new UTXOSet();
    utxoSet.addUTXO("tx-1", 0, { address: "Alice", amount: 3 });
    utxoSet.addUTXO("tx-1", 1, { address: "Bob", amount: 2 });

    assert.equal(utxoSet.hasUTXO("tx-1", 0), true);
    assert.deepEqual(utxoSet.getUTXO("tx-1", 0), {
        txId: "tx-1",
        outputIndex: 0,
        address: "Alice",
        amount: 3,
        lockingCondition: { type: "ADDRESS", address: "Alice" }
    });
    assert.equal(utxoSet.getBalance("Alice"), 3);
    assert.deepEqual(utxoSet.getUTXOsForAddress("Bob").map(utxo => utxo.amount), [2]);
    assert.equal(utxoSet.getAllUTXOs().length, 2);
});

test("clones and removes UTXOs without losing the locking condition", () => {
    const utxoSet = new UTXOSet();
    utxoSet.addUTXO("tx-2", 0, {
        address: "Carol",
        amount: 4,
        lockingCondition: { type: "CUSTOM", address: "Carol" }
    });

    const copy = utxoSet.clone();
    assert.deepEqual(copy.getUTXO("tx-2", 0), utxoSet.getUTXO("tx-2", 0));
    assert.equal(utxoSet.removeUTXO("tx-2", 0), true);
    assert.equal(utxoSet.hasUTXO("tx-2", 0), false);
    assert.equal(utxoSet.removeUTXO("tx-2", 0), false);
    assert.equal(copy.hasUTXO("tx-2", 0), true);
});

test("rejects malformed UTXOs", () => {
    const utxoSet = new UTXOSet();

    assert.throws(() => utxoSet.addUTXO("tx-3", -1, { address: "Dave", amount: 1 }), TypeError);
    assert.throws(() => utxoSet.addUTXO("tx-3", 0, { address: "Dave", amount: 0 }), TypeError);
    assert.throws(() => utxoSet.addUTXO("tx-3", 0, { address: "Dave", amount: Number.NaN }), TypeError);
});
