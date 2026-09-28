class ProofOfWork {
    constructor(difficulty = 4) {
        this.difficulty = difficulty;
    }

    mine(block) {
        block.difficulty = this.difficulty;

        const target = "0".repeat(this.difficulty);

        const start = process.hrtime.bigint();

        let attempts = 0;

        while (true) {
            block.hash = block.calculateHash();

            attempts++;

            if (block.hash.startsWith(target)) {
                break;
            }

            block.nonce++;
        }

        const end = process.hrtime.bigint();

        const elapsedMs = Number(end - start) / 1_000_000;

        const hashRate =
            elapsedMs > 0
                ? Math.round(attempts / (elapsedMs / 1000))
                : 0;

        return {
            block,
            attempts,
            elapsedMs,
            hashRate
        };
    }
}

module.exports = ProofOfWork;