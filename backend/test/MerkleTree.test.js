const test = require("node:test");
const assert = require("node:assert/strict");
const MerkleTree = require("../src/blockchain/MerkleTree");

test("builds a root and verifies proofs for odd and even leaf counts", () => {
    for (const leaves of [["a", "b"], ["a", "b", "c"]]) {
        const tree = new MerkleTree(leaves);
        for (let index = 0; index < leaves.length; index++) {
            const proof = tree.getProof(index);
            assert.equal(MerkleTree.verifyProof(leaves[index], proof, tree.getRoot()), true);
            assert.equal(MerkleTree.verifyProof("tampered", proof, tree.getRoot()), false);
        }
    }
});

test("uses a stable SHA-256 root for an empty tree", () => {
    assert.equal(new MerkleTree([]).getRoot(), MerkleTree.hash(""));
});
