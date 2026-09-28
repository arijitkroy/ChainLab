const crypto = require("crypto");

class Wallet {
    constructor({ walletId = crypto.randomUUID(), name = "Wallet", address = null } = {}) {
        const keyPair = crypto.createECDH("secp256k1");
        keyPair.generateKeys();

        this.walletId = walletId;
        this.name = name.trim() || "Wallet";
        this.privateKey = keyPair.getPrivateKey("hex");
        this.publicKey = keyPair.getPublicKey("hex", "compressed");
        this.address = address ?? `CL${crypto.createHash("sha256").update(this.publicKey).digest("hex").slice(0, 32)}`;
    }

    createSimulatedSignature(message) {
        return `SIMULATED:${crypto.createHmac("sha256", Buffer.from(this.privateKey, "hex")).update(message).digest("hex")}`;
    }

    toPublicSummary(balance, utxoCount = 0) {
        return {
            walletId: this.walletId,
            name: this.name,
            address: this.address,
            publicKey: this.publicKey,
            balance,
            utxoCount,
            keyType: "simulated-secp256k1",
            signatureType: "simulated-hmac-not-bitcoin-ecdsa"
        };
    }
}

module.exports = Wallet;
