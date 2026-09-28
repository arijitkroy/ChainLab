"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import NetworkGraph from "@/components/NetworkGraph";
import { connectSimulationSocket, createNode, getSimulation, setNodeOnline } from "@/lib/api";

export default function NetworkPage() {
    const [simulation, setSimulation] = useState(null);
    const [name, setName] = useState("");
    const [role, setRole] = useState("miner");
    const [hashRate, setHashRate] = useState("0.1");
    const [busyNode, setBusyNode] = useState(null);
    const [error, setError] = useState("");

    useEffect(() => {
        let active = true;
        getSimulation().then(data => { if (active) setSimulation(data); }).catch(fetchError => setError(fetchError.message));
        const socket = connectSimulationSocket(data => { if (active) setSimulation(data); });
        return () => {
            active = false;
            socket.close();
        };
    }, []);

    async function refresh() {
        const data = await getSimulation();
        setSimulation(data);
    }

    async function handleCreate(event) {
        event.preventDefault();
        setError("");
        try {
            await createNode({ name, role, hashRate: Number(hashRate) });
            setName("");
            await refresh();
        } catch (createError) {
            setError(createError.message);
        }
    }

    async function toggleNode(node) {
        setBusyNode(node.id);
        setError("");
        try {
            await setNodeOnline(node.id, !node.online);
            await refresh();
        } catch (nodeError) {
            setError(nodeError.message);
        } finally {
            setBusyNode(null);
        }
    }

    return (
        <main className="min-h-screen bg-black text-white">
            <div className="mx-auto max-w-7xl px-6 py-8">
                <p className="text-sm text-zinc-500"><Link href="/" className="hover:text-white">Dashboard</Link> / Network</p>
                <h1 className="mt-2 text-2xl font-semibold">Peer-to-Peer Network</h1>
                <p className="mt-1 text-sm text-zinc-500">Nodes exchange transactions and blocks over the simulated peer graph.</p>
                {error && <p role="alert" className="mt-5 border border-red-900 bg-red-950/30 px-4 py-3 text-sm text-red-300">{error}</p>}

                {simulation && <div className="mt-6"><NetworkGraph nodes={simulation.nodes} events={simulation.events} /></div>}

                <section className="mt-8 grid gap-10 lg:grid-cols-[minmax(240px,0.7fr)_minmax(0,1.3fr)]">
                    <div>
                        <h2 className="mb-3 font-semibold">Add node</h2>
                        <form onSubmit={handleCreate} className="space-y-3 border-y border-zinc-800 py-4">
                            <label className="block text-xs text-zinc-500">Name<input required value={name} onChange={event => setName(event.target.value)} className="mt-1 block w-full border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white" /></label>
                            <label className="block text-xs text-zinc-500">Role<select value={role} onChange={event => setRole(event.target.value)} className="mt-1 block w-full border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white"><option value="miner">Miner</option><option value="validator">Validator</option><option value="full-node">Full node</option><option value="light-node">Light node</option></select></label>
                            {role === "miner" && <label className="block text-xs text-zinc-500">Relative hash power<input type="number" min="0.01" max="100" step="0.05" value={hashRate} onChange={event => setHashRate(event.target.value)} className="mt-1 block w-full border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white" /></label>}
                            <button className="w-full bg-white px-3 py-2 text-sm font-medium text-black">Connect node</button>
                        </form>
                    </div>

                    <section>
                        <h2 className="mb-3 font-semibold">Node status</h2>
                        <div className="divide-y divide-zinc-800 border-y border-zinc-800">
                            {(simulation?.nodes ?? []).map(node => (
                                <div key={node.id} className="flex flex-wrap items-center justify-between gap-4 py-4">
                                    <div className="min-w-0">
                                        <p className="font-medium">{node.name} <span className="ml-2 text-xs capitalize text-zinc-500">{node.role.replaceAll("-", " ")}</span></p>
                                        <p className="mt-1 text-xs text-zinc-500">Height {node.localHeight} · {node.peers.length} peers · {node.mempoolSize} pending · {node.miningPower} hash power</p>
                                    </div>
                                    <button onClick={() => toggleNode(node)} disabled={busyNode === node.id} className={`border px-3 py-2 text-xs disabled:opacity-40 ${node.online ? "border-zinc-700 text-zinc-300" : "border-green-900 text-green-400"}`}>
                                        {busyNode === node.id ? "Updating..." : node.online ? "Take offline" : "Reconnect & sync"}
                                    </button>
                                </div>
                            ))}
                        </div>
                    </section>
                </section>

                <section className="mt-9 border-t border-zinc-800 pt-5">
                    <h2 className="mb-3 font-semibold">Network events</h2>
                    <div className="divide-y divide-zinc-900">
                        {(simulation?.events ?? []).slice().reverse().slice(0, 24).map((event, index) => <EventLine key={`${event.type}:${event.timestamp}:${index}`} event={event} />)}
                    </div>
                </section>
                <p className="mt-6 text-xs text-zinc-600">Validators run the same simplified block and UTXO checks but have no mining power. Light-node roles are illustrative; networking is not Bitcoin’s production protocol.</p>
            </div>
        </main>
    );
}

function EventLine({ event }) {
    const detail = event.transactionId ?? event.blockHash ?? event.peerId ?? event.nodeId;
    return <div className="flex flex-wrap justify-between gap-2 py-2 text-xs"><span className="text-zinc-400">{event.type.replaceAll("_", " ")} · {event.from ? `${event.from} → ` : ""}{event.nodeId ?? "network"}</span><span className="font-mono text-zinc-600">{detail ?? ""} · {new Date(event.timestamp).toLocaleTimeString()}</span></div>;
}
