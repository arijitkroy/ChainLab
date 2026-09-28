class MajorityAttackScenario {
    run({ attackerHashPower = 51, rounds = 100 } = {}) {
        if (!Number.isFinite(attackerHashPower) || attackerHashPower < 0 || attackerHashPower > 100) {
            throw new Error("Attacker hash power must be from 0 to 100 percent");
        }
        if (!Number.isInteger(rounds) || rounds < 1 || rounds > 10000) {
            throw new Error("Rounds must be from 1 to 10000");
        }

        const attackerBlocks = [];
        const honestBlocks = [];
        const progress = [];
        for (let round = 1; round <= rounds; round++) {
            (Math.random() * 100 < attackerHashPower ? attackerBlocks : honestBlocks).push(round);
            if (round % Math.max(1, Math.floor(rounds / 20)) === 0 || round === rounds) {
                progress.push({ round, attackerWork: attackerBlocks.length, honestWork: honestBlocks.length });
            }
        }

        const attackerWork = attackerBlocks.length;
        const honestWork = honestBlocks.length;
        const selectedChain = attackerWork > honestWork ? "attacker" : "honest";

        return {
            attackerHashPower,
            honestHashPower: 100 - attackerHashPower,
            rounds,
            attackerBlocks: attackerBlocks.length,
            honestBlocks: honestBlocks.length,
            attackerWork,
            honestWork,
            selectedChain,
            progress,
            explanation: "This simplified model only compares accumulated work. Majority hash power does not enable arbitrary coin creation or spending unrelated users’ coins."
        };
    }
}

module.exports = MajorityAttackScenario;
