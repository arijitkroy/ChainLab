class Miner {
    calculateTarget(difficulty) {
        if (!Number.isInteger(difficulty) || difficulty < 0 || difficulty > 64) {
            throw new RangeError("Difficulty must be an integer from 0 to 64");
        }
        const maximum = (1n << 256n) - 1n;
        return (maximum >> BigInt(difficulty * 4)).toString(16).padStart(64, "0");
    }

    calculateHash(block) {
        return block.calculateHash();
    }

    isValidProof(hash, target) {
        return /^[a-f0-9]{64}$/i.test(hash) && BigInt(`0x${hash}`) <= BigInt(`0x${target}`);
    }

    async mineBlock(block, { difficulty = block.difficulty, onProgress = () => {}, progressInterval = 50000, signal } = {}) {
        const target = this.calculateTarget(difficulty);
        const start = process.hrtime.bigint();
        block.difficulty = difficulty;
        let attempts = 0;
        let lastProgress = 0;

        while (true) {
            if (signal?.aborted) throw new Error("Mining cancelled");
            block.hash = this.calculateHash(block);
            attempts++;

            if (this.isValidProof(block.hash, target)) break;
            block.nonce++;

            if (attempts % 4096 === 0) {
                if (attempts - lastProgress >= progressInterval) {
                    lastProgress = attempts;
                    const elapsedMs = Number(process.hrtime.bigint() - start) / 1_000_000;
                    onProgress({
                        nonce: block.nonce,
                        hashAttempts: attempts,
                        hashRate: Math.round(attempts / Math.max(elapsedMs / 1000, 0.001)),
                        elapsedTime: elapsedMs,
                        target,
                        currentHash: block.hash
                    });
                }
                await new Promise(resolve => setImmediate(resolve));
            }
        }

        const elapsedMs = Number(process.hrtime.bigint() - start) / 1_000_000;
        return {
            block,
            target,
            successfulHash: block.hash,
            attempts,
            elapsedMs,
            hashRate: Math.round(attempts / Math.max(elapsedMs / 1000, 0.001))
        };
    }
}

module.exports = Miner;
