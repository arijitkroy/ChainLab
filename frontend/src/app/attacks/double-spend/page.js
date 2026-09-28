"use client";

import { useState } from "react";
import Link from "next/link";
import { runDoubleSpendScenario } from "@/lib/api";

export default function DoubleSpendPage() {
    const [amount, setAmount] = useState(10);
    const [difficulty, setDifficulty] = useState(1);
    const [result, setResult] = useState(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    async function run() {
        setBusy(true);
        setError("");
        try {
            setResult(await runDoubleSpendScenario({ amount: Number(amount), difficulty: Number(difficulty) }));
        } catch (runError) {
            setError(runError.message);
        } finally {
            setBusy(false);
        }
    }

    return (
        <main className="min-h-screen bg-black text-white">
            <div className="mx-auto max-w-6xl px-6 py-8">
                <p className="text-sm text-zinc-500"><Link href="/" className="hover:text-white">Dashboard</Link> / Attack Lab / Double spend</p>
                <h1 className="mt-2 text-2xl font-semibold">Double-Spend Simulator</h1>
                <p className="mt-1 max-w-3xl text-sm text-zinc-500">Two isolated nodes accept conflicting spends of the same UTXO. The experiment then extends one branch until cumulative work triggers a reorganization.</p>
                <p className="mt-3 border-l-2 border-yellow-500 pl-3 text-xs text-yellow-400">Controlled scenario only. The live ChainLab network and its UTXOs are not modified.</p>
                {error && <p role="alert" className="mt-4 text-sm text-red-400">{error}</p>}

                <section className="mt-7 flex flex-wrap items-end gap-4 border-y border-zinc-800 py-4">
                    <label className="text-xs text-zinc-500">Spend amount<input type="number" min="0.01" max="49.998" step="0.001" value={amount} onChange={event => setAmount(event.target.value)} className="mt-1 block w-36 border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white" /></label>
                    <label className="text-xs text-zinc-500">Difficulty<select value={difficulty} onChange={event => setDifficulty(event.target.value)} className="mt-1 block border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white">{[1, 2, 3].map(level => <option key={level}>{level}</option>)}</select></label>
                    <button onClick={run} disabled={busy} className="bg-white px-4 py-2 text-sm font-medium text-black disabled:opacity-50">{busy ? "Mining branches..." : "Run double-spend"}</button>
                </section>

                {result && (
                    <div className="mt-8 space-y-8">
                        <section>
                            <h2 className="mb-3 font-semibold">Conflicting transactions</h2>
                            <p className="mb-3 text-xs text-zinc-500">Shared input: {result.spentUtxo.address} · {result.spentUtxo.amount} BTC · {result.spentUtxo.txId}:{result.spentUtxo.outputIndex}</p>
                            <div className="grid gap-6 md:grid-cols-2">
                                {result.transactions.map((transaction, index) => (
                                    <article key={transaction.id} className="border-t border-zinc-700 pt-3">
                                        <p className="text-sm font-semibold">Transaction {index ? "B" : "A"}: Alice → {transaction.recipient} · {result.amount} BTC</p>
                                        <p className="mt-2 break-all font-mono text-xs text-zinc-500">{transaction.id}</p>
                                        <p className={`mt-2 text-xs uppercase ${transaction.status === "confirmed" ? "text-green-400" : "text-red-400"}`}>{transaction.status}</p>
                                    </article>
                                ))}
                            </div>
                        </section>

                        <section className="border-y border-zinc-800 py-4">
                            <h2 className="mb-3 font-semibold">Node-specific mempools</h2>
                            <div className="flex flex-wrap gap-6">{result.nodeMempools.map(node => <p key={node.node} className="text-sm text-zinc-300">{node.node}: <span className="text-green-400">accepted independently</span></p>)}</div>
                        </section>

                        <section className="grid gap-8 md:grid-cols-2">
                            <div><h2 className="mb-2 font-semibold">First confirmation</h2><p className="text-sm text-zinc-400">{result.firstConfirmed.recipient} was first included in block #{result.firstConfirmed.height}.</p><p className="mt-2 break-all font-mono text-xs text-zinc-600">{result.firstConfirmed.blockHash}</p></div>
                            <div><h2 className="mb-2 font-semibold">Chain selection</h2><p className="text-sm text-zinc-400">Fork point #{result.reorganization.forkPoint}. The competing branch gained more cumulative work.</p><p className="mt-2 text-sm text-yellow-400">Reorganization: {result.reorganization.occurred ? "completed" : "not triggered"}</p></div>
                        </section>
                        <p className="border-l-2 border-sky-600 pl-3 text-sm text-zinc-400">{result.explanation}</p>
                    </div>
                )}
            </div>
        </main>
    );
}
