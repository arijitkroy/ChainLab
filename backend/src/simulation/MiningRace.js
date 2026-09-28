class MiningRace {
    run(miners, rounds = 1000) {
        if (!Array.isArray(miners) || !miners.length) throw new Error("At least one miner is required");
        if (!Number.isInteger(rounds) || rounds < 1 || rounds > 100000) throw new Error("Rounds must be from 1 to 100000");

        const participants = miners.map(miner => {
            const hashRate = Number(miner.hashRate);
            if (!Number.isFinite(hashRate) || hashRate < 0) throw new Error("Miner hash power must be non-negative");
            return { id: String(miner.id), name: String(miner.name ?? miner.id), hashRate, blocksWon: 0, attempts: 0 };
        });
        const totalPower = participants.reduce((total, miner) => total + miner.hashRate, 0);
        if (totalPower <= 0) throw new Error("Total hash power must be greater than zero");

        for (let round = 0; round < rounds; round++) {
            for (const miner of participants) miner.attempts++;
            let draw = Math.random() * totalPower;
            const winner = participants.find(miner => {
                draw -= miner.hashRate;
                return draw < 0;
            }) ?? participants.at(-1);
            winner.blocksWon++;
        }

        return {
            rounds,
            totalPower,
            miners: participants.map(miner => ({
                ...miner,
                estimatedProbability: miner.hashRate / totalPower,
                successRate: miner.blocksWon / miner.attempts
            }))
        };
    }
}

module.exports = MiningRace;
