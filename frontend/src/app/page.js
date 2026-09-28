"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { connectSimulationSocket, getBlocks, getMempool, getTransactions, getUTXOs, mineBlock, setNodeOnline } from "@/lib/api";
import TransactionBuilder from "@/components/TransactionBuilder";
import NetworkGraph from "@/components/NetworkGraph";
import SimulationControls from "@/components/SimulationControls";

export default function Home() {
    const [simulation, setSimulation] = useState(null);
    const [mining, setMining] = useState(false);
    const [dashboardData, setDashboardData] = useState(null);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");

    useEffect(() => {
        let active = true;
        let lastKey = "";
        async function refresh() {
            try {
                const [chain, mempool, utxos, transactions] = await Promise.all([
                    getBlocks(), getMempool(), getUTXOs(), getTransactions()
                ]);
                if (active) setDashboardData({ chain, mempool, utxos, transactions });
            } catch (fetchError) {
                if (active) setError(fetchError.message);
            }
        }

        const socket = connectSimulationSocket(data => {
            if (!active) return;
            setSimulation(data);
            const key = `${data.networkHeight}:${data.nodes.reduce((total, node) => total + node.mempoolSize, 0)}:${data.nodes.map(node => node.online).join("")}`;
            if (key !== lastKey) {
                lastKey = key;
                refresh();
            }
        });

        return () => {
            active = false;
            socket.close();
        };
    }, []);

    async function handleMine(nodeId) {
        setMining(true);

        try {
            await mineBlock(nodeId);
        } catch (mineError) {
            setError(mineError.message);
        } finally {
            setMining(false);
        }
    }

    async function handleNodeToggle(node) {
        try {
            await setNodeOnline(node.id, !node.online);
            setError("");
        } catch (nodeError) {
            setError(nodeError.message);
        }
    }

    if (!simulation) {
        return (
            <main className="min-h-screen bg-black text-white flex items-center justify-center">
                Loading ChainLab...
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-black text-white">
            <div className="max-w-7xl mx-auto px-6 pt-7 sm:px-8">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold">Dashboard</h1>
                        <p className="text-sm text-zinc-500">Interactive Bitcoin-inspired blockchain simulator</p>
                    </div>

                    <div className="flex items-center gap-4">
                        <span className={`w-2 h-2 rounded-full ${simulation.nodes.some(node => node.online) ? "bg-green-500" : "bg-red-500"}`} />
                        <span className="text-sm text-zinc-400">{simulation.nodes.some(node => node.online) ? "Network Online" : "Network Offline"}</span>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-8 py-8">
                {error && <p role="alert" className="mb-5 border border-red-900 bg-red-950/30 px-4 py-3 text-sm text-red-300">{error}</p>}
                {notice && <p role="status" className="mb-5 border border-green-900 bg-green-950/20 px-4 py-3 text-sm text-green-300">{notice}</p>}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <StatCard title="Active nodes" value={simulation.nodes.filter(node => node.online).length} />
                    <StatCard title="Network Height" value={simulation.networkHeight} />
                    <StatCard title="Difficulty" value={simulation.difficulty} />
                    <StatCard title="Block Reward" value={`${simulation.blockReward} BTC`} />
                    <StatCard title="Mempool" value={dashboardData?.mempool.summary.count ?? "..."} />
                    <StatCard title="UTXOs" value={dashboardData?.utxos.summary.utxoCount ?? "..."} />
                    <StatCard title="Simulated supply" value={`${(dashboardData?.utxos.summary.totalSupply ?? 0).toFixed(3)} BTC`} />
                    <StatCard title="Mining nodes" value={simulation.nodes.filter(node => node.online && node.role === "miner").length} />
                    <StatCard title="Validators" value={simulation.nodes.filter(node => node.online && node.role === "validator").length} />
                    <StatCard title="Relative hash power" value={simulation.nodes.filter(node => node.online && node.role === "miner").reduce((total, node) => total + node.miningPower, 0).toFixed(2)} />
                </div>

                <div className="mt-6">
                    <SimulationControls simulation={simulation} />
                </div>

                <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2">
                        <NetworkGraph nodes={simulation?.nodes || []} events={simulation?.events || []} />
                    </div>

                    <TransactionBuilder onCreated={() => setNotice("Transaction submitted to the network mempool.")} />
                </div>

                <section className="mt-8">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h2 className="text-lg font-semibold">Network Nodes</h2>
                            <p className="text-sm text-zinc-500">Local blockchain state</p>
                        </div>

                        <div className="text-right">
                            <p className="text-xs text-zinc-600">Canonical Tip</p>
                            <p className="text-xs font-mono text-zinc-400">{simulation.networkTipShort}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {simulation.nodes.map(node => (
                            <NodeCard key={node.id} node={node} mining={mining} onMine={handleMine} onToggle={handleNodeToggle} />
                        ))}
                    </div>
                </section>

                <section className="mt-8">
                    <h2 className="text-lg font-semibold mb-4">Recent Events</h2>

                    <div className="border border-zinc-800 rounded-xl overflow-hidden">
                        {simulation.events.slice().reverse().slice(0, 10).map((event, index) => (
                            <EventRow key={index} event={event} />
                        ))}
                    </div>
                </section>

                <section className="mt-8 grid gap-10 lg:grid-cols-2">
                    <div>
                        <div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">Latest blocks</h2><Link href="/blockchain" className="text-xs text-sky-400 hover:text-sky-300">Open explorer</Link></div>
                        <div className="divide-y divide-zinc-800 border-y border-zinc-800">
                            {(dashboardData?.chain.blocks ?? []).slice(-5).reverse().map(block => <Link key={block.hash} href="/blockchain" className="flex justify-between gap-4 py-3 text-sm hover:bg-zinc-950"><span>Block #{block.height} · {block.transactionCount} tx</span><span className="font-mono text-xs text-zinc-500">{block.hash.slice(0, 14)}...</span></Link>)}
                        </div>
                    </div>
                    <div>
                        <div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">Latest transactions</h2><Link href="/transactions" className="text-xs text-sky-400 hover:text-sky-300">View history</Link></div>
                        <div className="divide-y divide-zinc-800 border-y border-zinc-800">
                            {(dashboardData?.transactions.transactions ?? []).slice(0, 5).map(transaction => <Link key={transaction.id} href="/transactions" className="flex justify-between gap-4 py-3 text-xs hover:bg-zinc-950"><span className="break-all font-mono text-zinc-400">{transaction.id.slice(0, 18)}...</span><span className={transaction.status === "confirmed" ? "text-green-400" : "text-yellow-400"}>{transaction.status}</span></Link>)}
                        </div>
                    </div>
                </section>
            </div>
        </main>
    );
}

function StatCard({ title, value }) {
    return (
        <div className="border border-zinc-800 bg-zinc-950 rounded-xl p-5">
            <p className="text-sm text-zinc-500">{title}</p>
            <p className="mt-2 text-2xl font-semibold">{value}</p>
        </div>
    );
}

function NodeCard({ node, mining, onMine, onToggle }) {
    return (
        <div className="border border-zinc-800 bg-zinc-950 rounded-xl p-5">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="font-semibold">{node.name}</h3>
                    <p className="text-xs capitalize text-zinc-600">{node.role.replaceAll("-", " ")} · {node.id}</p>
                </div>

                <span className={`px-2 py-1 rounded text-xs ${node.mining ? "bg-yellow-950 text-yellow-400" : "bg-zinc-900 text-zinc-500"}`}>
                    {node.mining
                        ? "MINING"
                        : "IDLE"}
                </span>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-6">
                <Metric label="Hashrate" value={`${node.hashRate}x`} />
                <Metric label="Local Height" value={node.localHeight} />
                <Metric label="Balance" value={`${node.balance} BTC`} />
                <Metric label="Mempool" value={node.mempoolSize} />
                <Metric label="Blocks Mined" value={node.stats.blocksMined} />
                <Metric label="Mining Attempts" value={node.stats.miningAttempts.toLocaleString()} />
                <Metric label="Peers" value={node.peers.length} />
            </div>

            <div className="mt-4">
                <p className="text-xs text-zinc-600">Tip</p>
                <p className="font-mono text-xs text-zinc-400 mt-1">{node.tipHashShort}</p>
            </div>

            <button disabled={mining || !node.online || node.role !== "miner"} onClick={() => onMine(node.id)} className="mt-6 w-full rounded-lg bg-white text-black py-2.5 font-medium hover:bg-zinc-200 disabled:opacity-40">
                {!node.online ? "Node Offline" : node.role !== "miner" ? node.role === "validator" ? "Validator" : node.role === "light-node" ? "Light node" : "Full node" : mining
                    ? "Mining..."
                    : "Mine Block"}
            </button>
            <button onClick={() => onToggle(node)} className="mt-2 w-full border border-zinc-800 py-2 text-xs text-zinc-400 hover:text-white">{node.online ? "Take node offline" : "Reconnect and sync"}</button>
        </div>
    );
}

function Metric({ label, value }) {
    return (
        <div>
            <p className="text-xs text-zinc-600">{label}</p>
            <p className="mt-1 font-medium">{value}</p>
        </div>
    );
}

function EventRow({ event }) {
        const label = event.type === "BLOCK_MINED"
                ? `Block #${event.height} mined`
                : event.type === "BLOCK_RECEIVED"
                    ? `Block #${event.height} received`
                    : event.type === "TRANSACTION_CREATED"
                        ? "Transaction created"
                        : event.type;

    return (
        <div className="px-5 py-3 border-b border-zinc-900 last:border-0 flex justify-between">
            <span className="text-sm">{label}</span>
            <span className="text-xs text-zinc-600">{new Date(event.timestamp).toLocaleTimeString()}</span>
        </div>
    );
}