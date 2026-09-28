"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { generateMerkleProof, getMerkleTree, verifyMerkleProof } from "@/lib/api";

const initialTransactions = [
    "Alice pays Bob 1 BTC",
    "Bob pays Carol 0.2 BTC",
    "Miner receives the block reward",
    "Carol pays Dave 0.05 BTC"
];

export default function MerkleLab() {
    const [transactions, setTransactions] = useState(initialTransactions);
    const [tree, setTree] = useState(null);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [proofResult, setProofResult] = useState(null);
    const [chainTree, setChainTree] = useState(null);
    const [error, setError] = useState("");

    useEffect(() => {
        let active = true;
        buildDemoTree(transactions).then(result => {
            if (active) setTree(result);
        }).catch(buildError => {
            if (active) setError(buildError.message);
        });
        return () => { active = false; };
    }, [transactions]);

    useEffect(() => {
        getMerkleTree().then(setChainTree).catch(fetchError => setError(fetchError.message));
    }, []);

    async function generateProof() {
        if (!tree) return;
        const proof = makeProof(tree.levels, selectedIndex);
        const result = await verifyMerkleProof(tree.leaves[selectedIndex], proof, tree.root);
        setProofResult({ proof, valid: result.valid });
    }

    return (
        <main className="min-h-screen bg-black text-white">
            <div className="mx-auto max-w-7xl px-6 py-8">
                <p className="text-sm text-zinc-500"><Link href="/" className="hover:text-white">Dashboard</Link> / Merkle Lab</p>
                <h1 className="mt-2 text-2xl font-semibold">Merkle Tree Lab</h1>
                <p className="mt-1 text-sm text-zinc-500">Change a transaction and watch every parent hash up to the Merkle root change.</p>
                {error && <p role="alert" className="mt-5 text-sm text-red-400">{error}</p>}

                <section className="mt-7 grid gap-10 lg:grid-cols-[minmax(300px,0.9fr)_minmax(0,1.4fr)]">
                    <div>
                        <h2 className="mb-3 font-semibold">Transactions</h2>
                        <div className="space-y-3">
                            {transactions.map((value, index) => (
                                <label key={index} className="block text-xs text-zinc-500">
                                    Transaction {index + 1}
                                    <input value={value} onChange={event => setTransactions(current => current.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} className="mt-1 w-full border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-sm text-white outline-none focus:border-zinc-500" />
                                </label>
                            ))}
                        </div>
                        <button onClick={() => setTransactions(current => [...current, `New transaction ${current.length + 1}`])} className="mt-3 border border-zinc-700 px-3 py-2 text-sm hover:bg-zinc-900">Add transaction</button>
                        {tree && (
                            <div className="mt-7 border-t border-zinc-800 pt-4">
                                <p className="text-xs uppercase text-zinc-500">Merkle root</p>
                                <p className="mt-2 break-all font-mono text-sm text-green-400">{tree.root}</p>
                            </div>
                        )}
                    </div>

                    <section aria-label="Merkle tree levels">
                        <h2 className="mb-3 font-semibold">Pairwise hashing</h2>
                        {tree?.levels.map((level, levelIndex) => (
                            <div key={levelIndex} className="mb-5">
                                <p className="mb-2 text-xs uppercase text-zinc-500">{levelIndex === 0 ? "Transaction hashes" : levelIndex === tree.levels.length - 1 ? "Root" : `Level ${levelIndex}`}</p>
                                <div className="space-y-2">
                                    {level.map((hash, hashIndex) => (
                                        <div key={hashIndex} className={`border px-3 py-2 font-mono text-xs break-all ${levelIndex === tree.levels.length - 1 ? "border-green-900 text-green-400" : "border-zinc-800 text-zinc-400"}`}>
                                            {hash}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </section>
                </section>

                <section className="mt-10 border-t border-zinc-800 pt-6">
                    <div className="flex flex-wrap items-end justify-between gap-4">
                        <div>
                            <h2 className="font-semibold">Generate and verify proof</h2>
                            <p className="mt-1 text-xs text-zinc-500">Select a leaf; the lab builds a sibling path to the root.</p>
                        </div>
                        <div className="flex gap-2">
                            <select value={selectedIndex} onChange={event => setSelectedIndex(Number(event.target.value))} className="border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm">
                                {transactions.map((value, index) => <option key={index} value={index}>Transaction {index + 1}</option>)}
                            </select>
                            <button onClick={generateProof} disabled={!tree} className="bg-white px-3 py-2 text-sm font-medium text-black disabled:opacity-50">Generate proof</button>
                        </div>
                    </div>
                    {proofResult && (
                        <div className="mt-4 border-y border-zinc-800 py-4">
                            <p className={`text-sm ${proofResult.valid ? "text-green-400" : "text-red-400"}`}>{proofResult.valid ? "Proof verified against the current root." : "Proof verification failed."}</p>
                            <pre className="mt-3 overflow-x-auto text-xs text-zinc-400">{JSON.stringify(proofResult.proof, null, 2)}</pre>
                        </div>
                    )}
                </section>

                <section className="mt-10 border-t border-zinc-800 pt-6">
                    <h2 className="font-semibold">Latest canonical block</h2>
                    {chainTree ? (
                        <div className="mt-3 grid gap-4 sm:grid-cols-2">
                            <div><p className="text-xs text-zinc-500">Block #{chainTree.blockHeight} root</p><p className="mt-1 break-all font-mono text-xs text-zinc-300">{chainTree.root}</p></div>
                            <div><p className="text-xs text-zinc-500">Transaction leaves</p><p className="mt-1 text-sm text-zinc-300">{chainTree.transactionIds.length || "No transactions in this block"}</p></div>
                        </div>
                    ) : <p className="mt-2 text-sm text-zinc-500">Loading canonical block tree...</p>}
                </section>
            </div>
        </main>
    );
}

async function buildDemoTree(transactions) {
    const leaves = await Promise.all(transactions.filter(Boolean).map(sha256));
    if (!leaves.length) return { leaves: [], levels: [[]], root: await sha256("") };
    const levels = [leaves];
    while (levels.at(-1).length > 1) {
        const current = levels.at(-1);
        const next = [];
        for (let index = 0; index < current.length; index += 2) {
            next.push(await sha256(current[index] + (current[index + 1] ?? current[index])));
        }
        levels.push(next);
    }
    return { leaves, levels, root: levels.at(-1)[0] };
}

function makeProof(levels, leafIndex) {
    const proof = [];
    let index = leafIndex;
    for (const level of levels.slice(0, -1)) {
        proof.push({ hash: level[index ^ 1] ?? level[index], position: index % 2 ? "left" : "right" });
        index = Math.floor(index / 2);
    }
    return proof;
}

async function sha256(value) {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}
