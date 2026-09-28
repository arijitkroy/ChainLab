const test = require("node:test");
const assert = require("node:assert/strict");
const UTXOSet = require("../src/blockchain/UTXOSet");
const { Transaction } = require("../src/blockchain/Transaction");

test("transaction serialization hashes deterministically and calculates fees", () => {
    const utxos = new UTXOSet();
    utxos.addUTXO("origin", 0, { address: "Alice", amount: 10 });
    const options = {
        inputs: [{ txId: "origin", outputIndex: 0 }],
        outputs: [{ address: "Bob", amount: 9 }],
        fee: 1,
        timestamp: 1234
    };
    const first = new Transaction(options);
    const second = new Transaction(options);

    assert.equal(first.calculateTransactionHash(), second.calculateTransactionHash());
    assert.equal(first.calculateFee(utxos), 1);
    assert.deepEqual(first.validate(utxos), { valid: true, fee: 1 });
    assert.equal(first.isCoinbase(), false);
});

test("coinbase detection remains separate from normal spends", () => {
    const coinbase = Transaction.createCoinbase("Miner", 50);
    assert.equal(coinbase.isCoinbase(), true);
    assert.equal(coinbase.fee, 0);
});
