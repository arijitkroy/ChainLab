"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { connectSimulationSocket, getBlocks, getMempool, getSimulation, getUTXOs } from "@/lib/api";

export default function StatisticsPage() {
    const [stats, setStats] = useState(null);
    const [error, setError] = useState("");

    useEffect(() => {
        let active = true;
        let lastKey = "";
        async function refresh() {
            try {
                const [simulation, chain, mempool, utxos] = await Promise.all([getSimulation(), getBlocks(), getMempool(), getUTXOs()]);
                if (!active) return;
                const blocks = chain.blocks;
                const averageTransactions = blocks.length ? chain.summary.totalTransactions / blocks.length : 0;
                const averageSize = blocks.length ? blocks.reduce((total, block) => total + block.sizeBytes, 0) / blocks.length : 0;
                setStats({
                    height: chain.summary.chainHeight,
                    blocks: chain.summary.totalBlocks,
                    transactions: chain.summary.totalTransactions,
                    supply: utxos.summary.totalSupply,
                    averageBlockTime: chain.summary.averageBlockTimeSeconds,
                    averageTransactions,
                    averageSize,
                    difficulty: simulation.difficulty,
                    hashPower: simulation.nodes.filter(node => node.online && node.role === "miner").reduce((total, node) => total + node.miningPower, 0),
                    miningAttempts: simulation.totalMiningAttempts,
                    mempoolSize: mempool.summary.count,
                    utxoCount: utxos.summary.utxoCount,
                    forkCount: simulation.forkCount,
                    reorganizationCount: simulation.reorganizationCount,
                    recentBlocks: blocks.slice(-8)
                });
                setError("");
            } catch (fetchError) {
                if (active) setError(fetchError.message);
            }
        }
        refresh();
        const socket = connectSimulationSocket(snapshot => {
            const key = `${snapshot.networkHeight}:${snapshot.nodes.reduce((total, node) => total + node.mempoolSize, 0)}`;
            if (key !== lastKey) {
                lastKey = key;
                refresh();
            }
        });
        return () => { active = false; socket.close(); };
    }, []);

    const cards = stats ? [
        ["Chain height", stats.height], ["Total blocks", stats.blocks], ["Transactions", stats.transactions],
        ["Simulated BTC", `${stats.supply.toFixed(3)} BTC`], ["Average block time", stats.averageBlockTime === null ? "-" : `${stats.averageBlockTime.toFixed(2)} sec`],
        ["Average txs / block", stats.averageTransactions.toFixed(2)], ["Average block size", `${Math.round(stats.averageSize).toLocaleString()} bytes`],
        ["Difficulty", stats.difficulty], ["Online miner power", stats.hashPower.toFixed(2)],
        ["Mining attempts", stats.miningAttempts.toLocaleString()], ["Mempool", stats.mempoolSize], ["UTXO count", stats.utxoCount],
        ["Fork count", stats.forkCount], ["Reorganizations", stats.reorganizationCount]
    ] : [];

    return (
        <main className="min-h-screen bg-black text-white">
            <div className="mx-auto max-w-7xl px-6 py-8">
                <p className="text-sm text-zinc-500"><Link href="/" className="hover:text-white">Dashboard</Link> / Statistics</p>
                <h1 className="mt-2 text-2xl font-semibold">Blockchain Statistics</h1>
                <p className="mt-1 text-sm text-zinc-500">Live metrics from the canonical simulated chain.</p>
                {error && <p role="alert" className="mt-5 text-sm text-red-400">{error}</p>}

                <section aria-label="Network metrics" className="mt-6 grid grid-cols-2 gap-px border border-zinc-800 bg-zinc-800 sm:grid-cols-3 xl:grid-cols-4">
                    {cards.length ? cards.map(([label, value]) => <Metric key={label} label={label} value={value} />) : <p className="bg-black px-4 py-8 text-sm text-zinc-500">Loading statistics...</p>}
                </section>

                <section className="mt-9 border-t border-zinc-800 pt-5">
                    <h2 className="mb-4 font-semibold">Transactions per recent block</h2>
                    <div className="flex h-48 items-end gap-3 border-b border-zinc-800 pb-2">
                        {(stats?.recentBlocks ?? []).map(block => {
                            const maximum = Math.max(1, ...stats.recentBlocks.map(item => item.transactionCount));
                            const height = Math.max(6, block.transactionCount / maximum * 160);
                            return <div key={block.hash} className="flex min-w-0 flex-1 flex-col items-center gap-2"><span className="text-[10px] text-zinc-500">{block.transactionCount}</span><div className="w-full bg-sky-600" style={{ height: `${height}px` }} /><span className="text-[10px] text-zinc-600">#{block.height}</span></div>;
                        })}
                    </div>
                </section>
                <p className="mt-6 text-xs text-zinc-600">Hash power is a relative simulation value, not a real-world hash-rate estimate.</p>
            </div>
        </main>
    );
}

function Metric({ label, value }) {
    return <div className="bg-black px-4 py-3"><p className="text-xs text-zinc-500">{label}</p><p className="mt-1 text-lg font-semibold">{value}</p></div>;
}
