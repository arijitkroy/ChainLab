"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { connectSimulationSocket, getBlocks, getSimulation, mineBlock, setDifficulty } from "@/lib/api";

export default function MiningLab() {
    const [simulation, setSimulation] = useState(null);
    const [blocks, setBlocks] = useState([]);
    const [nodeId, setNodeId] = useState("node-1");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        let active = true;
        let knownHeight = null;

        async function refreshBlocks() {
            try {
                const result = await getBlocks();
                if (active) setBlocks(result.blocks);
            } catch (fetchError) {
                if (active) setError(fetchError.message);
            }
        }

        getSimulation().then(data => {
            if (active) {
                knownHeight = data.networkHeight;
                setSimulation(data);
                setNodeId(data.nodes.find(node => node.hashRate > 0)?.id ?? data.nodes[0]?.id ?? "");
            }
        }).catch(fetchError => setError(fetchError.message));
        refreshBlocks();

        const socket = connectSimulationSocket(data => {
            if (!active) return;
            setSimulation(data);
            if (data.networkHeight !== knownHeight) {
                knownHeight = data.networkHeight;
                refreshBlocks();
            }
        });
        return () => {
            active = false;
            socket.close();
        };
    }, []);

    const mining = simulation?.mining;
    const latestBlock = blocks.at(-1);

    async function handleMine() {
        setBusy(true);
        setError("");
        try {
            await mineBlock(nodeId);
        } catch (mineError) {
            setError(mineError.message);
        } finally {
            setBusy(false);
        }
    }

    async function handleDifficulty(event) {
        const nextDifficulty = Number(event.target.value);
        try {
            await setDifficulty(nextDifficulty);
            setSimulation(current => current ? { ...current, difficulty: nextDifficulty } : current);
        } catch (difficultyError) {
            setError(difficultyError.message);
        }
    }

    const currentBlock = mining ?? {
        height: (simulation?.networkHeight ?? 0) + 1,
        previousHash: latestBlock?.hash ?? "-",
        merkleRoot: "Waiting for mining",
        timestamp: latestBlock?.timestamp ?? null,
        difficulty: simulation?.difficulty ?? 4,
        target: targetForDifficulty(simulation?.difficulty ?? 4),
        nonce: 0,
        currentHash: "-",
        hashAttempts: 0,
        hashRate: 0,
        elapsedTime: 0,
        status: "ready"
    };

    return (
        <main className="min-h-screen bg-black text-white">
            <div className="mx-auto max-w-7xl px-6 py-8">
                <p className="text-sm text-zinc-500"><Link href="/" className="hover:text-white">Dashboard</Link> / Mining Lab</p>
                <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-semibold">Proof-of-Work Mining Lab</h1>
                        <p className="mt-1 text-sm text-zinc-500">Mining runs on the backend and yields progress in bounded batches.</p>
                    </div>
                    <div className="flex items-end gap-3">
                        <label className="text-xs text-zinc-500">Miner
                            <select value={nodeId} onChange={event => setNodeId(event.target.value)} className="mt-1 block border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white">
                                {simulation?.nodes.map(node => <option key={node.id} value={node.id}>{node.name}</option>)}
                            </select>
                        </label>
                        <label className="text-xs text-zinc-500">Difficulty
                            <select value={simulation?.difficulty ?? 4} onChange={handleDifficulty} className="mt-1 block border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white">
                                {[1, 2, 3, 4, 5, 6].map(level => <option key={level} value={level}>{level}</option>)}
                            </select>
                        </label>
                        <button onClick={handleMine} disabled={busy || !nodeId} className="bg-yellow-400 px-4 py-2 text-sm font-semibold text-black disabled:opacity-40">{busy ? "Mining..." : "Mine block"}</button>
                    </div>
                </div>

                {error && <p role="alert" className="mt-5 border border-red-900 bg-red-950/30 px-4 py-3 text-sm text-red-300">{error}</p>}

                <section className="mt-7 grid gap-x-8 border-y border-zinc-800 sm:grid-cols-2">
                    <MiningValue label="Current block" value={`#${currentBlock.height}`} />
                    <MiningValue label="Status" value={currentBlock.status.toUpperCase()} accent={currentBlock.status === "mining" ? "text-yellow-400" : "text-zinc-200"} />
                    <MiningValue label="Previous block hash" value={currentBlock.previousHash} mono />
                    <MiningValue label="Merkle root" value={currentBlock.merkleRoot} mono />
                    <MiningValue label="Timestamp" value={currentBlock.timestamp ? new Date(currentBlock.timestamp).toLocaleString() : "Awaiting candidate block"} />
                    <MiningValue label="Target" value={currentBlock.target} mono />
                    <MiningValue label="Nonce" value={currentBlock.nonce} mono />
                    <MiningValue label="Current hash" value={currentBlock.currentHash} mono />
                </section>

                <section aria-label="Mining progress" className="mt-7">
                    <div className="flex flex-wrap justify-between gap-4">
                        <ProgressValue label="Hash attempts" value={Number(currentBlock.hashAttempts).toLocaleString()} />
                        <ProgressValue label="Hash rate" value={`${Number(currentBlock.hashRate).toLocaleString()} H/s`} />
                        <ProgressValue label="Elapsed" value={`${(Number(currentBlock.elapsedTime) / 1000).toFixed(2)} sec`} />
                        <ProgressValue label="Successful hash" value={currentBlock.status === "found" ? "Found" : "Searching"} />
                    </div>
                    <div className="mt-5 flex h-20 items-end gap-1 border-b border-zinc-800 pb-2">
                        {Array.from({ length: 48 }, (_, index) => {
                            const nonce = Number(currentBlock.nonce || 0);
                            const height = 12 + ((nonce * (index + 7) + index * 31) % 55);
                            return <span key={index} className={`flex-1 ${currentBlock.status === "found" ? "bg-green-500" : "bg-yellow-500/70"}`} style={{ height: `${height}px` }} />;
                        })}
                    </div>
                    <p className="mt-3 text-xs text-zinc-500">Each difficulty step multiplies expected work by 16. This configurable target is for visualization, not Bitcoin mainnet.</p>
                </section>

                <section className="mt-9 border-t border-zinc-800 pt-5">
                    <h2 className="mb-3 text-base font-semibold">Mining events</h2>
                    <div className="divide-y divide-zinc-800">
                        {(simulation?.events ?? []).filter(event => event.type.startsWith("BLOCK_MINING") || event.type === "MINING_PROGRESS" || event.type === "BLOCK_MINED").slice().reverse().slice(0, 12).map((event, index) => (
                            <div key={`${event.type}:${event.timestamp}:${index}`} className="flex flex-wrap justify-between gap-2 py-2 text-xs">
                                <span className="text-zinc-300">{event.type.replaceAll("_", " ")} · {event.nodeId} · #{event.height}</span>
                                <span className="font-mono text-zinc-500">{event.hashAttempts ? `${event.hashAttempts.toLocaleString()} attempts` : new Date(event.timestamp).toLocaleTimeString()}</span>
                            </div>
                        ))}
                    </div>
                </section>
            </div>
        </main>
    );
}

function MiningValue({ label, value, mono = false, accent = "text-zinc-200" }) {
    return (
        <div className="min-w-0 border-b border-zinc-800 py-3">
            <p className="text-xs text-zinc-500">{label}</p>
            <p className={`mt-1 break-all text-sm ${mono ? "font-mono" : ""} ${accent}`}>{value}</p>
        </div>
    );
}

function ProgressValue({ label, value }) {
    return <div><p className="text-xs text-zinc-500">{label}</p><p className="mt-1 font-mono text-sm">{value}</p></div>;
}

function targetForDifficulty(difficulty) {
    const maximum = (1n << 256n) - 1n;
    return (maximum >> BigInt(difficulty * 4)).toString(16).padStart(64, "0");
}
