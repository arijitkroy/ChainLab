"use client";

import { useState } from "react";
import Link from "next/link";
import { runMiningRace } from "@/lib/api";

const initialMiners = [
    { id: "miner-1", name: "Miner 1", hashRate: 40 },
    { id: "miner-2", name: "Miner 2", hashRate: 30 },
    { id: "miner-3", name: "Miner 3", hashRate: 20 },
    { id: "miner-4", name: "Miner 4", hashRate: 10 }
];

export default function MiningRacePage() {
    const [miners, setMiners] = useState(initialMiners);
    const [rounds, setRounds] = useState(1000);
    const [result, setResult] = useState(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    async function run() {
        setBusy(true);
        setError("");
        try {
            setResult(await runMiningRace(miners, Number(rounds)));
        } catch (runError) {
            setError(runError.message);
        } finally {
            setBusy(false);
        }
    }

    return (
        <main className="min-h-screen bg-black text-white">
            <div className="mx-auto max-w-6xl px-6 py-8">
                <p className="text-sm text-zinc-500"><Link href="/" className="hover:text-white">Dashboard</Link> / Mining Race</p>
                <h1 className="mt-2 text-2xl font-semibold">Mining Race</h1>
                <p className="mt-1 max-w-3xl text-sm text-zinc-500">A probabilistic educational model: each round selects one winner in proportion to configured hash power. These values do not represent Bitcoin mining economics.</p>
                {error && <p role="alert" className="mt-5 text-sm text-red-400">{error}</p>}

                <section className="mt-7 grid gap-8 lg:grid-cols-[minmax(260px,0.8fr)_minmax(0,1.4fr)]">
                    <div>
                        <h2 className="mb-3 font-semibold">Miner hash power</h2>
                        <div className="divide-y divide-zinc-800 border-y border-zinc-800">
                            {miners.map((miner, index) => (
                                <label key={miner.id} className="flex items-center justify-between gap-4 py-3 text-sm">
                                    <span>{miner.name}</span>
                                    <span className="flex items-center gap-2"><input type="number" min="0" max="100" step="1" value={miner.hashRate} onChange={event => setMiners(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, hashRate: Number(event.target.value) } : item))} className="w-20 border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-right font-mono" /><span className="text-zinc-500">%</span></span>
                                </label>
                            ))}
                        </div>
                        <label className="mt-5 block text-xs text-zinc-500">Rounds<input type="number" min="1" max="100000" value={rounds} onChange={event => setRounds(event.target.value)} className="mt-1 block w-full border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white" /></label>
                        <button onClick={run} disabled={busy} className="mt-4 w-full bg-white px-3 py-2.5 text-sm font-medium text-black disabled:opacity-50">{busy ? "Simulating..." : "Run race"}</button>
                        <p className="mt-3 text-xs text-zinc-600">Total configured power: {miners.reduce((total, miner) => total + miner.hashRate, 0)}%</p>
                    </div>

                    <section>
                        <h2 className="mb-3 font-semibold">Race results</h2>
                        {result ? (
                            <div className="divide-y divide-zinc-800 border-y border-zinc-800">
                                {result.miners.map(miner => (
                                    <div key={miner.id} className="py-4">
                                        <div className="flex justify-between gap-4 text-sm"><span>{miner.name}</span><span className="font-mono">{miner.blocksWon.toLocaleString()} wins</span></div>
                                        <div className="mt-2 h-2 bg-zinc-900"><div className="h-full bg-sky-500" style={{ width: `${miner.estimatedProbability * 100}%` }} /></div>
                                        <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-zinc-500"><span>Estimated {percent(miner.estimatedProbability)} · observed {percent(miner.successRate)}</span><span>{miner.attempts.toLocaleString()} attempts</span></div>
                                    </div>
                                ))}
                            </div>
                        ) : <p className="border-y border-zinc-800 py-12 text-center text-sm text-zinc-500">Run a race to compare expected and observed wins.</p>}
                    </section>
                </section>
            </div>
        </main>
    );
}

function percent(value) {
    return `${(value * 100).toFixed(1)}%`;
}
