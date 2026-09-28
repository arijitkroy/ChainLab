const Block = require("./Block");
const Blockchain = require("./Blockchain");

class ChainManager {
    constructor(blockchain) {
        this.initialBlockReward = blockchain.initialBlockReward;
        this.halvingInterval = blockchain.halvingInterval;
        this.blocks = new Map();
        this.chainWork = new Map();
        this.childCounts = new Map();
        this.forkCount = 0;
        this.reorganizationCount = 0;
        this.genesisHash = blockchain.getBlocks()[0].hash;
        this.canonicalChain = blockchain.getBlocks().slice();

        let work = 0;
        for (const block of this.canonicalChain) {
            this.blocks.set(block.hash, block);
            work += ChainManager.calculateBlockWork(block);
            this.chainWork.set(block.hash, work);
            this.childCounts.set(block.previousHash, (this.childCounts.get(block.previousHash) ?? 0) + 1);
        }
        this.canonicalTip = this.canonicalChain.at(-1);
    }

    addBlock(block) {
        if (this.blocks.has(block.hash)) return { accepted: false, reason: "Block is already known" };
        const parent = this.blocks.get(block.previousHash);
        if (!parent) return { accepted: false, reason: "Previous block is unknown" };
        if (block.height !== parent.height + 1) return { accepted: false, reason: "Invalid block height" };

        const parentChain = this.getChainTo(parent.hash);
        if (!parentChain) return { accepted: false, reason: "Block does not connect to genesis" };

        const candidateChain = new Blockchain({
            initialBlockReward: this.initialBlockReward,
            halvingInterval: this.halvingInterval
        });
        try {
            for (const ancestor of parentChain.slice(1)) candidateChain.addBlock(ancestor);
            const validation = candidateChain.validateBlock(block);
            if (!validation.valid) return { accepted: false, reason: validation.reason };
            candidateChain.addBlock(block);
        } catch (error) {
            return { accepted: false, reason: error.message };
        }

        const previousChildren = this.childCounts.get(parent.hash) ?? 0;
        this.childCounts.set(parent.hash, previousChildren + 1);
        this.childCounts.set(block.hash, this.childCounts.get(block.hash) ?? 0);
        this.blocks.set(block.hash, block);
        const work = this.chainWork.get(parent.hash) + ChainManager.calculateBlockWork(block);
        this.chainWork.set(block.hash, work);

        const forkDetected = previousChildren > 0;
        if (forkDetected) this.forkCount++;

        const oldChain = this.canonicalChain;
        const oldTip = this.canonicalTip;
        const canonicalChanged = work > (this.chainWork.get(oldTip.hash) ?? 0);
        let chain = oldChain;
        let forkPoint = oldTip;
        let disconnected = [];
        let connected = [];
        let reorganization = false;

        if (canonicalChanged) {
            chain = [...parentChain, block];
            forkPoint = ChainManager.findCommonAncestor(oldChain, chain);
            const commonIndex = oldChain.findIndex(candidate => candidate.hash === forkPoint.hash);
            disconnected = oldChain.slice(commonIndex + 1);
            connected = chain.slice(commonIndex + 1);
            reorganization = disconnected.length > 0;
            this.canonicalChain = chain;
            this.canonicalTip = block;
            if (reorganization) this.reorganizationCount++;
        }

        return {
            accepted: true,
            canonicalChanged,
            forkDetected,
            reorganization,
            forkPoint,
            disconnected,
            connected,
            chain,
            cumulativeWork: work
        };
    }

    getChainTo(blockHash) {
        const chain = [];
        let current = this.blocks.get(blockHash);
        while (current) {
            chain.unshift(current);
            if (current.hash === this.genesisHash) return chain;
            current = this.blocks.get(current.previousHash);
        }
        return null;
    }

    getBlockchainAt(blockHash) {
        const chain = this.getChainTo(blockHash);
        if (!chain) return null;

        const blockchain = new Blockchain({
            initialBlockReward: this.initialBlockReward,
            halvingInterval: this.halvingInterval
        });
        for (const block of chain.slice(1)) blockchain.addBlock(block);
        return blockchain;
    }

    getBestChain() {
        return this.canonicalChain.slice();
    }

    getCumulativeWork(blockHash) {
        return this.chainWork.get(blockHash) ?? 0;
    }

    getForkData() {
        const parentHashes = new Set(Array.from(this.blocks.values(), block => block.previousHash));
        const tips = Array.from(this.blocks.values()).filter(block => !parentHashes.has(block.hash));
        const branches = tips.map(tip => {
            const chain = this.getChainTo(tip.hash);
            const forkPoint = ChainManager.findCommonAncestor(this.canonicalChain, chain);
            const forkIndex = chain.findIndex(block => block.hash === forkPoint.hash);
            return {
                tip,
                chain,
                branchBlocks: chain.slice(forkIndex + 1),
                forkPoint,
                cumulativeWork: this.getCumulativeWork(tip.hash),
                canonical: tip.hash === this.canonicalTip.hash
            };
        });
        return {
            forkCount: this.forkCount,
            reorganizationCount: this.reorganizationCount,
            canonicalTip: this.canonicalTip,
            canonicalWork: this.getCumulativeWork(this.canonicalTip.hash),
            branches
        };
    }

    static calculateBlockWork(block) {
        return Block.calculateWork(block.difficulty);
    }

    static calculateChainWork(chain) {
        return chain.reduce((total, block) => total + ChainManager.calculateBlockWork(block), 0);
    }

    static findCommonAncestor(firstChain, secondChain) {
        const secondByHeight = new Map(secondChain.map(block => [block.height, block]));
        for (let index = firstChain.length - 1; index >= 0; index--) {
            const block = firstChain[index];
            if (secondByHeight.get(block.height)?.hash === block.hash) return block;
        }
        return firstChain[0];
    }
}

module.exports = ChainManager;
