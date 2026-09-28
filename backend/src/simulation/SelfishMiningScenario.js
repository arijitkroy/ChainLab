class SelfishMiningScenario {
    run({ attackerHashPower = 0.3, propagationAdvantage = 0.5, rounds = 1000 } = {}) {
        if (!Number.isFinite(attackerHashPower) || attackerHashPower < 0 || attackerHashPower > 1) {
            throw new Error("Attacker hash power must be between 0 and 1");
        }
        if (!Number.isFinite(propagationAdvantage) || propagationAdvantage < 0 || propagationAdvantage > 1) {
            throw new Error("Propagation advantage must be between 0 and 1");
        }
        if (!Number.isInteger(rounds) || rounds < 1 || rounds > 100000) {
            throw new Error("Duration must be from 1 to 100000 rounds");
        }

        let privateLead = 0;
        let privateBlocks = 0;
        let attackerPublished = 0;
        let honestPublished = 0;
        let orphaned = 0;
        const progress = [];

        for (let round = 1; round <= rounds; round++) {
            if (Math.random() < attackerHashPower) {
                privateLead++;
                privateBlocks++;
                if (privateLead >= 2) {
                    attackerPublished += privateLead;
                    privateLead = 0;
                }
            } else if (privateLead === 0) {
                honestPublished++;
            } else if (privateLead === 1) {
                if (Math.random() < propagationAdvantage) {
                    attackerPublished++;
                    orphaned++;
                } else {
                    honestPublished++;
                    orphaned++;
                }
                privateLead = 0;
            } else {
                attackerPublished += privateLead;
                honestPublished++;
                orphaned++;
                privateLead = Math.max(0, privateLead - 1);
            }

            if (round % Math.max(1, Math.floor(rounds / 20)) === 0 || round === rounds) {
                progress.push({ round, attackerPublished, honestPublished, privateLead, orphaned });
            }
        }

        const canonicalBlocks = attackerPublished + honestPublished;
        return {
            attackerHashPower,
            propagationAdvantage,
            rounds,
            privateBlocks,
            attackerPublished,
            honestPublished,
            orphaned,
            canonicalBlocks,
            attackerRevenue: canonicalBlocks ? attackerPublished / canonicalBlocks : 0,
            honestRevenue: canonicalBlocks ? honestPublished / canonicalBlocks : 0,
            progress,
            model: "simplified educational experiment"
        };
    }
}

module.exports = SelfishMiningScenario;
