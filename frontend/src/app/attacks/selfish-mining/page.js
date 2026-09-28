"use client";

import { useState } from "react";
import Link from "next/link";
import { runSelfishMining } from "@/lib/api";

export default function SelfishMiningPage() {
    const [attackerHashPower, setAttackerHashPower] = useState(30);
    const [propagationAdvantage, setPropagationAdvantage] = useState(50);
    const [rounds, setRounds] = useState(1000);
    const [result, setResult] = useState(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    async function run() {
        setBusy(true);
        setError("");
        try {
            setResult(await runSelfishMining({
                attackerHashPower: Number(attackerHashPower) / 100,
                propagationAdvantage: Number(propagationAdvantage) / 100,
                rounds: Number(rounds)
            }));
        } catch (runError) {
            setError(runError.message);
        } finally {
            setBusy(false);
        }
    }

    return (
        <main className="min-h-screen bg-black text-white">
            <div className="mx-auto max-w-6xl px-6 py-8">
                <p className="text-sm text-zinc-500"><Link href="/" className="hover:text-white">Dashboard</Link> / Attack Lab / Selfish mining</p>
                <h1 className="mt-2 text-2xl font-semibold">Selfish-Mining Experiment</h1>
                <p className="mt-1 max-w-3xl text-sm text-zinc-500">A simplified lead-and-publish model. It is an educational experiment, not a complete strategic or network simulation.</p>
                {error && <p role="alert" className="mt-4 text-sm text-red-400">{error}</p>}

                <section className="mt-7 grid gap-9 md:grid-cols-[minmax(250px,0.7fr)_minmax(0,1.3fr)]">
                    <div className="space-y-5 border-y border-zinc-800 py-4">
                        <Range label="Attacker hash power" value={attackerHashPower} onChange={setAttackerHashPower} />
                        <Range label="Propagation advantage" value={propagationAdvantage} onChange={setPropagationAdvantage} />
                        <label className="block text-xs text-zinc-500">Simulation duration (rounds)<input type="number" min="1" max="100000" value={rounds} onChange={event => setRounds(event.target.value)} className="mt-1 block w-full border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white" /></label>
                        <button onClick={run} disabled={busy} className="w-full bg-white px-3 py-2.5 text-sm font-medium text-black disabled:opacity-50">{busy ? "Simulating..." : "Run experiment"}</button>
                    </div>
                    <section>
                        <h2 className="mb-4 font-semibold">Published and canonical blocks</h2>
                        {result ? (
                            <>
                                <div className="grid grid-cols-2 gap-px border border-zinc-800 bg-zinc-800 sm:grid-cols-3">
                                    <Metric label="Private blocks" value={result.privateBlocks} />
                                    <Metric label="Attacker published" value={result.attackerPublished} />
                                    <Metric label="Honest published" value={result.honestPublished} />
                                    <Metric label="Orphaned" value={result.orphaned} />
                                    <Metric label="Attacker revenue" value={`${(result.attackerRevenue * 100).toFixed(1)}%`} />
                                    <Metric label="Honest revenue" value={`${(result.honestRevenue * 100).toFixed(1)}%`} />
                                </div>
                                <div className="mt-6 border-y border-zinc-800 py-4">
                                    {result.progress.slice(-12).map((point, index) => <p key={index} className="flex justify-between gap-3 py-1 text-xs text-zinc-500"><span>Round {point.round} · private lead {point.privateLead}</span><span>{point.attackerPublished} attacker / {point.honestPublished} honest published</span></p>)}
                                </div>
                            </>
                        ) : <p className="border-y border-zinc-800 py-12 text-center text-sm text-zinc-500">Run a scenario to compare revenues.</p>}
                    </section>
                </section>
            </div>
        </main>
    );
}

function Range({ label, value, onChange }) {
    return <label className="block text-xs text-zinc-500">{label} · {value}%<input type="range" min="0" max="100" value={value} onChange={event => onChange(Number(event.target.value))} className="mt-2 block w-full accent-sky-500" /></label>;
}

function Metric({ label, value }) {
    return <div className="bg-black px-3 py-3"><p className="text-xs text-zinc-500">{label}</p><p className="mt-1 font-mono text-sm">{value}</p></div>;
}
