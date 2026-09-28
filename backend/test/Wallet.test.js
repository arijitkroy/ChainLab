const test = require("node:test");
const assert = require("node:assert/strict");
const Wallet = require("../src/blockchain/Wallet");

test("generates distinct simulated keypairs without exposing private keys", () => {
    const first = new Wallet({ name: "First" });
    const second = new Wallet({ name: "Second" });

    assert.notEqual(first.privateKey, second.privateKey);
    assert.notEqual(first.publicKey, second.publicKey);
    assert.notEqual(first.address, second.address);
    assert.equal(JSON.stringify(first.toPublicSummary(0)).includes(first.privateKey), false);
    assert.equal(first.toPublicSummary(0).signatureType, "simulated-hmac-not-bitcoin-ecdsa");
});
