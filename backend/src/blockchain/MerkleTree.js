const crypto = require("crypto");

class MerkleTree {
    constructor(leaves = []) {
        this.leaves = leaves.map(leaf => typeof leaf === "string" ? leaf : leaf.id);
        this.levels = this.buildTree();
    }

    buildTree() {
        if (!this.leaves.length) return [[]];

        const levels = [this.leaves.slice()];
        while (levels.at(-1).length > 1) {
            const current = levels.at(-1);
            const next = [];
            for (let index = 0; index < current.length; index += 2) {
                next.push(MerkleTree.hashPair(current[index], current[index + 1] ?? current[index]));
            }
            levels.push(next);
        }
        return levels;
    }

    getRoot() {
        return this.levels.at(-1)[0] ?? MerkleTree.hash("");
    }

    getProof(leafIndex) {
        if (!Number.isInteger(leafIndex) || leafIndex < 0 || leafIndex >= this.leaves.length) {
            throw new RangeError("Leaf index is outside the Merkle tree");
        }

        const proof = [];
        let index = leafIndex;
        for (const level of this.levels.slice(0, -1)) {
            const siblingIndex = index ^ 1;
            proof.push({
                hash: level[siblingIndex] ?? level[index],
                position: index % 2 ? "left" : "right"
            });
            index = Math.floor(index / 2);
        }
        return proof;
    }

    static hash(data) {
        return crypto.createHash("sha256").update(data).digest("hex");
    }

    static hashPair(left, right) {
        return MerkleTree.hash(left + right);
    }

    static verifyProof(leaf, proof, root) {
        const calculatedRoot = proof.reduce((hash, item) =>
            item.position === "left"
                ? MerkleTree.hashPair(item.hash, hash)
                : MerkleTree.hashPair(hash, item.hash),
        leaf
        );
        return calculatedRoot === root;
    }
}

module.exports = MerkleTree;
