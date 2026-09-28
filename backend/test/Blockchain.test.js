const test = require("node:test");
const assert = require("node:assert/strict");
const Block = require("../src/blockchain/Block");
const Blockchain = require("../src/blockchain/Blockchain");
const { Transaction } = require("../src/blockchain/Transaction");

function transaction(inputs, outputs) {
    return { inputs, outputs, coinbase: false };
}

test("accepts a spend whose outputs do not exceed its UTXO inputs", () => {
    const blockchain = new Blockchain();
    const result = blockchain.validateTransaction(
        transaction([{ txId: "GENESIS", outputIndex: 0 }], [{ address: "Bob", amount: 49 }])
    );

    assert.deepEqual(result, { valid: true, fee: 1 });
});

test("rejects missing and duplicate UTXO inputs", () => {
    const blockchain = new Blockchain();
    const output = [{ address: "Bob", amount: 1 }];

    assert.equal(blockchain.validateTransaction(
        transaction([{ txId: "missing", outputIndex: 0 }], output)
    ).valid, false);
    assert.equal(blockchain.validateTransaction(
        transaction([
            { txId: "GENESIS", outputIndex: 0 },
            { txId: "GENESIS", outputIndex: 0 }
        ], output)
    ).reason, "Duplicate input");
    assert.equal(blockchain.validateTransaction(
        transaction([{ txId: "GENESIS", outputIndex: 0 }], output),
        blockchain.utxoSet,
        new Set(["GENESIS:0"])
    ).reason, "Double spend detected");
});

test("rejects transactions that create value or contain invalid outputs", () => {
    const blockchain = new Blockchain();
    const input = [{ txId: "GENESIS", outputIndex: 0 }];

    assert.equal(blockchain.validateTransaction(
        transaction(input, [{ address: "Bob", amount: 51 }])
    ).reason, "Outputs exceed inputs");
    assert.equal(blockchain.validateTransaction(
        transaction(input, [{ address: "Bob", amount: 0 }])
    ).reason, "Transaction outputs must have an address and positive finite amount");
});

test("rejects blocks with multiple coinbase transactions", () => {
    const blockchain = new Blockchain();
    const block = new Block({
        height: 1,
        previousHash: blockchain.getLatestBlock().hash,
        transactions: [
            Transaction.createCoinbase("Miner 1", 50),
            Transaction.createCoinbase("Miner 2", 50)
        ],
        difficulty: 1
    }).mine();

    assert.deepEqual(blockchain.validateBlock(block), {
        valid: false,
        reason: "Block may contain only one coinbase transaction"
    });
});
