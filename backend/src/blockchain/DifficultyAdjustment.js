class DifficultyAdjustment {
    constructor({ interval = 10, targetBlockTimeSeconds = 10, minimum = 1, maximum = 6 } = {}) {
        this.interval = interval;
        this.targetBlockTimeSeconds = targetBlockTimeSeconds;
        this.minimum = minimum;
        this.maximum = maximum;
    }

    adjust(blocks, currentDifficulty, interval = this.interval) {
        if (!Number.isInteger(interval) || interval < 2) throw new RangeError("Adjustment interval must be at least 2 blocks");
        if (blocks.length <= interval) return { adjusted: false, difficulty: currentDifficulty };

        const window = blocks.slice(-(interval + 1));
        const elapsedSeconds = Math.max(0, (window.at(-1).timestamp - window[0].timestamp) / 1000);
        const targetSeconds = interval * this.targetBlockTimeSeconds;
        const rawRatio = elapsedSeconds > 0 ? targetSeconds / elapsedSeconds : 4;
        const adjustmentRatio = Math.min(4, Math.max(0.25, rawRatio));
        const difficultyDelta = Math.log(adjustmentRatio) / Math.log(16);
        const difficulty = Math.min(this.maximum, Math.max(this.minimum, Math.round(currentDifficulty + difficultyDelta)));

        return {
            adjusted: difficulty !== currentDifficulty,
            difficulty,
            previousDifficulty: currentDifficulty,
            elapsedSeconds,
            averageBlockTimeSeconds: elapsedSeconds / interval,
            targetBlockTimeSeconds: this.targetBlockTimeSeconds,
            adjustmentRatio
        };
    }
}

module.exports = DifficultyAdjustment;
