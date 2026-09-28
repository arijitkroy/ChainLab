const crypto = require("crypto");
const MerkleTree = require("./MerkleTree");

class Block {
    constructor({
        height,
        version = 1,
        previousHash,
        transactions = [],
        difficulty = 4,
        timestamp = Date.now()
    }) {
        this.height = height;
        this.version = version;
        this.previousHash = previousHash;
        this.timestamp = timestamp;

        this.transactions = transactions;

        this.merkleRoot = Block.calculateMerkleRoot(transactions);

        this.difficulty = difficulty;

        this.nonce = 0;

        this.hash = this.calculateHash();
    }

    calculateHash() {
        const header = [
            this.version,
            this.previousHash,
            this.timestamp,
            this.merkleRoot,
            this.difficulty,
            this.nonce
        ].join("|");

        return crypto.createHash("sha256").update(header).digest("hex");
    }

    mine() {
        const target = "0".repeat(this.difficulty);

        while (true) {
            this.hash = this.calculateHash();

            if (this.hash.startsWith(target)) {
                return this;
            }

            this.nonce++;
        }
    }

    static hash(data) {
        return crypto.createHash("sha256").update(data).digest("hex");
    }

    static calculateMerkleRoot(transactions) {
        return new MerkleTree(transactions).getRoot();
    }

    static calculateWork(difficulty) {
        return Math.pow(16, difficulty);
    }
}

module.exports = Block;