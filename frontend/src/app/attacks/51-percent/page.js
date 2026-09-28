"use client";

import { useState } from "react";
import Link from "next/link";
import { runMajorityAttack } from "@/lib/api";

export default function MajorityAttackPage() {
    const [attackerHashPower, setAttackerHashPower] = useState(51);
    const [rounds, setRounds] = useState(100);
    const [result, setResult] = useState(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    async function run() {
        setBusy(true);
        setError("");
        try {
            setResult(await runMajorityAttack({ attackerHashPower: Number(attackerHashPower), rounds: Number(rounds) }));
        } catch (runError) {
            setError(runError.message);
        } finally {
            setBusy(false);
        }
    }

    return (
        <main className="min-h-screen bg-black text-white">
            <div className="mx-auto max-w-6xl px-6 py-8">
                <p className="text-sm text-zinc-500"><Link href="/" className="hover:text-white">Dashboard</Link> / Attack Lab / Majority hash power</p>
                <h1 className="mt-2 text-2xl font-semibold">Majority Hash-Power Simulator</h1>
                <p className="mt-1 max-w-3xl text-sm text-zinc-500">Compare honest and attacker chain work in a bounded probabilistic experiment. This does not alter the live network.</p>
                <p className="mt-3 border-l-2 border-red-700 pl-3 text-xs text-red-300">Majority hash power does not permit arbitrary coin creation or spending unrelated users’ coins; it affects chain history and transaction ordering/reversal.</p>
                {error && <p role="alert" className="mt-4 text-sm text-red-400">{error}</p>}

                <section className="mt-7 grid gap-8 md:grid-cols-[minmax(240px,0.7fr)_minmax(0,1.3fr)]">
                    <div className="space-y-5 border-y border-zinc-800 py-4">
                        <label className="block text-xs text-zinc-500">Attacker hash power · {attackerHashPower}%<input type="range" min="0" max="100" value={attackerHashPower} onChange={event => setAttackerHashPower(Number(event.target.value))} className="mt-3 block w-full accent-red-500" /></label>
                        <label className="block text-xs text-zinc-500">Simulation rounds<input type="number" min="1" max="10000" value={rounds} onChange={event => setRounds(event.target.value)} className="mt-1 block w-full border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white" /></label>
                        <button onClick={run} disabled={busy} className="w-full bg-white px-3 py-2.5 text-sm font-medium text-black disabled:opacity-50">{busy ? "Simulating..." : "Run attack scenario"}</button>
                    </div>
                    <section>
                        <h2 className="mb-4 font-semibold">Cumulative work</h2>
                        {result ? (
                            <div className="space-y-5">
                                <WorkBar label="Honest chain" value={result.honestWork} max={Math.max(1, result.honestWork, result.attackerWork)} color="bg-sky-600" />
                                <WorkBar label="Attacker chain" value={result.attackerWork} max={Math.max(1, result.honestWork, result.attackerWork)} color="bg-red-600" />
                                <p className={`text-sm font-semibold ${result.selectedChain === "attacker" ? "text-red-400" : "text-sky-400"}`}>Selected chain: {result.selectedChain}</p>
                                <p className="text-xs text-zinc-500">{result.attackerBlocks} attacker blocks · {result.honestBlocks} honest blocks · {result.rounds} rounds</p>
                                <div className="flex h-24 items-end gap-1 border-b border-zinc-800 pb-2">{result.progress.map((point, index) => <span key={index} className="flex-1 bg-red-500/70" style={{ height: `${Math.max(4, point.attackerWork / Math.max(1, point.attackerWork + point.honestWork) * 88)}px` }} />)}</div>
                            </div>
                        ) : <p className="border-y border-zinc-800 py-12 text-center text-sm text-zinc-500">Configure hash power and run a scenario.</p>}
                    </section>
                </section>
            </div>
        </main>
    );
}

function WorkBar({ label, value, max, color }) {
    return <div><div className="flex justify-between text-sm"><span>{label}</span><span className="font-mono">{value}</span></div><div className="mt-2 h-3 bg-zinc-900"><div className={`h-full ${color}`} style={{ width: `${value / max * 100}%` }} /></div></div>;
}
