"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { connectSimulationSocket, createCompetingBlocks, getForks, getSimulation, mineOnBranch } from "@/lib/api";

export default function ForksPage() {
    const [data, setData] = useState(null);
    const [simulation, setSimulation] = useState(null);
    const [selectedParent, setSelectedParent] = useState("");
    const [nodeId, setNodeId] = useState("node-2");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        let active = true;
        let latestEventSignature = "";

        async function refresh() {
            try {
                const next = await getForks();
                if (active) {
                    setData(next);
                    setSelectedParent(current => current || next.canonicalTip.hash);
                }
            } catch (fetchError) {
                if (active) setError(fetchError.message);
            }
        }

        getSimulation().then(current => {
            if (active) {
                setSimulation(current);
                setNodeId(current.nodes.find(node => node.role === "miner" && node.online)?.id ?? "");
            }
        }).catch(fetchError => setError(fetchError.message));
        refresh();

        const socket = connectSimulationSocket(current => {
            if (!active) return;
            setSimulation(current);
            const signature = current.events
                .filter(event => ["BLOCK_MINED", "FORK_DETECTED", "REORG_COMPLETED"].includes(event.type))
                .slice(-4)
                .map(event => `${event.type}:${event.timestamp}`)
                .join("|");
            if (signature !== latestEventSignature) {
                latestEventSignature = signature;
                refresh();
            }
        });
        return () => {
            active = false;
            socket.close();
        };
    }, []);

    async function runRace() {
        const miners = (simulation?.nodes ?? []).filter(node => node.online && node.role === "miner").slice(0, 2);
        if (miners.length < 2) {
            setError("Two online miners are required to create competing blocks.");
            return;
        }
        setBusy(true);
        setError("");
        try {
            await createCompetingBlocks(miners.map(node => node.id));
            await refreshForks();
        } catch (raceError) {
            setError(raceError.message);
        } finally {
            setBusy(false);
        }
    }

    async function extendBranch() {
        if (!nodeId || !selectedParent) return;
        setBusy(true);
        setError("");
        try {
            const result = await mineOnBranch(nodeId, selectedParent);
            setSelectedParent(result.result.block.hash);
            await refreshForks();
        } catch (mineError) {
            setError(mineError.message);
        } finally {
            setBusy(false);
        }
    }

    async function refreshForks() {
        const next = await getForks();
        setData(next);
    }

    const branches = data?.branches ?? [];
    const forkPoint = branches.find(branch => !branch.canonical)?.forkPoint;

    return (
        <main className="min-h-screen bg-black text-white">
            <div className="mx-auto max-w-7xl px-6 py-8">
                <p className="text-sm text-zinc-500"><Link href="/" className="hover:text-white">Dashboard</Link> / Forks</p>
                <h1 className="mt-2 text-2xl font-semibold">Forks & Chain Selection</h1>
                <p className="mt-1 max-w-3xl text-sm text-zinc-500">Competing valid branches are retained. The canonical branch is selected by cumulative proof-of-work, not block count.</p>
                {error && <p role="alert" className="mt-5 border border-red-900 bg-red-950/30 px-4 py-3 text-sm text-red-300">{error}</p>}

                <section className="mt-6 flex flex-wrap items-end justify-between gap-5 border-y border-zinc-800 py-4">
                    <div className="flex flex-wrap gap-8 text-sm">
                        <Metric label="Fork point" value={forkPoint ? `Block #${forkPoint.height}` : "No fork yet"} />
                        <Metric label="Forks detected" value={data?.forkCount ?? "..."} />
                        <Metric label="Reorganizations" value={data?.reorganizationCount ?? "..."} />
                        <Metric label="Canonical work" value={formatWork(data?.canonicalWork)} />
                    </div>
                    <button onClick={runRace} disabled={busy} className="bg-white px-3 py-2 text-sm font-medium text-black disabled:opacity-40">{busy ? "Mining competing blocks..." : "Create competing blocks"}</button>
                </section>

                <section className="mt-8">
                    <div className="mb-3 flex flex-wrap items-end justify-between gap-4">
                        <div><h2 className="font-semibold">Known branches</h2><p className="mt-1 text-xs text-zinc-500">Select a tip to mine an extension on that branch.</p></div>
                        <div className="flex gap-2">
                            <select value={selectedParent} onChange={event => setSelectedParent(event.target.value)} className="max-w-64 border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs font-mono">
                                {branches.map(branch => <option key={branch.tip.hash} value={branch.tip.hash}>#{branch.chainHeight} · {shortHash(branch.tip.hash)}{branch.canonical ? " · canonical" : " · side branch"}</option>)}
                            </select>
                            <select value={nodeId} onChange={event => setNodeId(event.target.value)} className="border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs">
                                {simulation?.nodes.filter(node => node.online && node.role === "miner").map(node => <option key={node.id} value={node.id}>{node.name}</option>)}
                            </select>
                            <button onClick={extendBranch} disabled={busy || !selectedParent || !nodeId} className="border border-zinc-700 px-3 py-2 text-xs text-zinc-200 disabled:opacity-40">Mine branch</button>
                        </div>
                    </div>

                    {branches.length ? (
                        <div className="grid gap-8 xl:grid-cols-2">
                            {branches.map(branch => (
                                <article key={branch.tip.hash} className={`border-t-2 pt-4 ${branch.canonical ? "border-green-500" : "border-yellow-500"}`}>
                                    <div className="flex flex-wrap justify-between gap-3">
                                        <h3 className="font-semibold">Chain {branch.canonical ? "A · canonical" : "B · competing"}</h3>
                                        <span className="text-xs text-zinc-500">height {branch.chainHeight} · work {formatWork(branch.cumulativeWork)}</span>
                                    </div>
                                    <p className="mt-2 text-xs text-zinc-500">Fork point: block #{branch.forkPoint.height} · tip {shortHash(branch.tip.hash)}</p>
                                    <ol className="mt-4 space-y-2 border-l border-zinc-800 pl-4">
                                        {(branch.chain ?? branch.branchBlocks ?? []).slice(-6).map(block => (
                                            <li key={block.hash} className="relative flex flex-wrap justify-between gap-2 text-xs">
                                                <span className="absolute -left-5.25 top-1 h-2 w-2 rounded-full bg-zinc-600" />
                                                <span>Block #{block.height} <span className="font-mono text-zinc-500">{shortHash(block.hash)}</span></span>
                                                <span className="text-zinc-600">+{formatWork(16 ** block.difficulty)} work</span>
                                            </li>
                                        ))}
                                    </ol>
                                    {(branch.branchBlocks ?? []).length > 0 && <p className="mt-3 text-xs text-zinc-500">Branch length after divergence: {branch.branchBlocks.length} blocks</p>}
                                </article>
                            ))}
                        </div>
                    ) : <p className="border-y border-zinc-800 py-12 text-center text-sm text-zinc-500">Loading branch state...</p>}
                </section>

                <p className="mt-8 text-xs text-zinc-600">Equal-work ties keep the current canonical tip until a branch gains more cumulative work. ChainLab’s difficulty target is configurable and educational.</p>
            </div>
        </main>
    );
}

function Metric({ label, value }) {
    return <div><p className="text-xs text-zinc-500">{label}</p><p className="mt-1 font-mono">{value}</p></div>;
}

function shortHash(hash) {
    return hash ? `${hash.slice(0, 10)}...${hash.slice(-6)}` : "-";
}

function formatWork(work) {
    return Number(work ?? 0).toLocaleString();
}
