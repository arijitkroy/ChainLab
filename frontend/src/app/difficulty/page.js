"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { connectSimulationSocket, getBlocks, getSimulation, setDifficultyAdjustmentInterval } from "@/lib/api";

const intervals = [10, 50, 100, 2016];

export default function DifficultyPage() {
    const [simulation, setSimulation] = useState(null);
    const [averageBlockTime, setAverageBlockTime] = useState(null);
    const [error, setError] = useState("");

    useEffect(() => {
        let active = true;
        let knownState = "";
        const refresh = async () => {
            try {
                const [state, chain] = await Promise.all([getSimulation(), getBlocks()]);
                if (active) {
                    knownState = `${state.networkHeight}:${state.difficulty}:${state.difficultyAdjustmentInterval}`;
                    setSimulation(state);
                    setAverageBlockTime(chain.summary.averageBlockTimeSeconds);
                }
            } catch (fetchError) {
                if (active) setError(fetchError.message);
            }
        };
        refresh();
        const socket = connectSimulationSocket(snapshot => {
            const nextState = `${snapshot.networkHeight}:${snapshot.difficulty}:${snapshot.difficultyAdjustmentInterval}`;
            if (nextState !== knownState) {
                knownState = nextState;
                refresh();
            }
        });
        return () => {
            active = false;
            socket.close();
        };
    }, []);

    async function changeInterval(event) {
        try {
            await setDifficultyAdjustmentInterval(Number(event.target.value));
            setSimulation(current => ({ ...current, difficultyAdjustmentInterval: Number(event.target.value) }));
            setError("");
        } catch (changeError) {
            setError(changeError.message);
        }
    }

    const adjustment = simulation?.events.slice().reverse().find(event => event.type === "DIFFICULTY_ADJUSTED");

    return (
        <main className="min-h-screen bg-black text-white">
            <div className="mx-auto max-w-6xl px-6 py-8">
                <p className="text-sm text-zinc-500"><Link href="/" className="hover:text-white">Dashboard</Link> / Difficulty Adjustment</p>
                <h1 className="mt-2 text-2xl font-semibold">Difficulty Adjustment</h1>
                <p className="mt-1 max-w-3xl text-sm text-zinc-500">The educational network retargets every configured number of blocks. Bitcoin targets about one block per 10 minutes; ChainLab uses a short interval for demonstrations.</p>
                {error && <p role="alert" className="mt-5 text-sm text-red-400">{error}</p>}

                <section className="mt-7 grid gap-8 md:grid-cols-[minmax(220px,0.7fr)_minmax(0,1.3fr)]">
                    <div>
                        <label className="block text-xs text-zinc-500">Adjustment interval
                            <select value={simulation?.difficultyAdjustmentInterval ?? 10} onChange={changeInterval} className="mt-1 block w-full border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-sm text-white">
                                {intervals.map(interval => <option key={interval} value={interval}>{interval.toLocaleString()} blocks</option>)}
                            </select>
                        </label>
                        <p className="mt-3 text-xs text-zinc-600">Lab target: {simulation?.targetBlockTimeSeconds ?? 10} seconds per block. Difficulty changes are clamped to levels 1–6.</p>
                    </div>
                    <div className="grid gap-x-6 border-y border-zinc-800 sm:grid-cols-2">
                        <Value label="Current difficulty" value={simulation?.difficulty ?? "..."} />
                        <Value label="Observed average block time" value={averageBlockTime === null ? "Waiting for samples" : `${averageBlockTime.toFixed(2)} sec`} />
                        <Value label="Previous difficulty" value={adjustment?.previousDifficulty ?? "No adjustment yet"} />
                        <Value label="Last adjustment ratio" value={adjustment ? `${adjustment.adjustmentRatio.toFixed(2)}×` : "-"} />
                        <Value label="Actual interval time" value={adjustment ? `${adjustment.elapsedSeconds.toFixed(2)} sec` : "-"} />
                        <Value label="Target interval time" value={adjustment ? `${(adjustment.targetBlockTimeSeconds * simulation.difficultyAdjustmentInterval).toFixed(2)} sec` : "-"} />
                        <Value label="New difficulty" value={adjustment?.difficulty ?? "-"} />
                        <Value label="Adjusted at height" value={adjustment?.height ?? "-"} />
                    </div>
                </section>
            </div>
        </main>
    );
}

function Value({ label, value }) {
    return <div className="border-b border-zinc-800 py-3"><p className="text-xs text-zinc-500">{label}</p><p className="mt-1 font-mono text-sm">{value}</p></div>;
}
