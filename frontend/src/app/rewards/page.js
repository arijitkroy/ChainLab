"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { connectSimulationSocket, getSimulation, setRewardSchedule } from "@/lib/api";

export default function RewardsPage() {
    const [simulation, setSimulation] = useState(null);
    const [initialReward, setInitialReward] = useState("50");
    const [interval, setInterval] = useState("10");
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");

    useEffect(() => {
        let active = true;
        getSimulation().then(data => {
            if (!active) return;
            setSimulation(data);
            setInitialReward(String(data.initialBlockReward ?? 50));
            setInterval(String(data.halvingInterval ?? 10));
        }).catch(fetchError => { if (active) setError(fetchError.message); });
        const socket = connectSimulationSocket(data => { if (active) setSimulation(data); });
        return () => {
            active = false;
            socket.close();
        };
    }, []);

    async function saveSchedule(event) {
        event.preventDefault();
        setError("");
        setNotice("");
        try {
            await setRewardSchedule(Number(initialReward), Number(interval));
            const updated = await getSimulation();
            setSimulation(updated);
            setNotice("Reward schedule updated. It applies to future blocks.");
        } catch (scheduleError) {
            setError(scheduleError.message);
        }
    }

    const reward = simulation?.blockReward ?? 50;
    const currentHalving = Math.floor(((simulation?.networkHeight ?? 0) + 1) / (simulation?.halvingInterval ?? 10));
    const scheduleInterval = Number(simulation?.halvingInterval ?? interval);

    return (
        <main className="min-h-screen bg-black text-white">
            <div className="mx-auto max-w-6xl px-6 py-8">
                <p className="text-sm text-zinc-500"><Link href="/" className="hover:text-white">Dashboard</Link> / Block Rewards</p>
                <h1 className="mt-2 text-2xl font-semibold">Block Reward & Halving</h1>
                <p className="mt-1 max-w-3xl text-sm text-zinc-500">This lab uses configurable educational heights. It is not Bitcoin mainnet’s issuance schedule.</p>
                {error && <p role="alert" className="mt-5 text-sm text-red-400">{error}</p>}
                {notice && <p role="status" className="mt-5 text-sm text-green-400">{notice}</p>}

                <section className="mt-7 grid grid-cols-2 gap-px border border-zinc-800 bg-zinc-800 sm:grid-cols-4">
                    <Value label="Current reward" value={`${reward} BTC`} />
                    <Value label="Halving number" value={currentHalving} />
                    <Value label="Blocks until next" value={simulation?.blocksUntilHalving ?? "..."} />
                    <Value label="Simulated issuance" value={`${(simulation?.totalSimulatedIssuance ?? 50).toFixed(3)} BTC`} />
                </section>

                <section className="mt-8 grid gap-10 md:grid-cols-[minmax(240px,0.8fr)_minmax(0,1.2fr)]">
                    <form onSubmit={saveSchedule} className="space-y-4 border-y border-zinc-800 py-4">
                        <h2 className="font-semibold">Reward schedule</h2>
                        <label className="block text-xs text-zinc-500">Initial reward<input type="number" min="0.001" step="0.001" value={initialReward} onChange={event => setInitialReward(event.target.value)} className="mt-1 block w-full border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white" /></label>
                        <label className="block text-xs text-zinc-500">Halving interval<input type="number" min="2" step="1" value={interval} onChange={event => setInterval(event.target.value)} className="mt-1 block w-full border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white" /></label>
                        <button className="w-full bg-white px-3 py-2 text-sm font-medium text-black">Apply schedule</button>
                        <p className="text-xs text-zinc-600">Changing the schedule requires resetting to genesis so prior blocks remain valid.</p>
                    </form>

                    <section>
                        <h2 className="mb-3 font-semibold">Reward progression</h2>
                        <div className="divide-y divide-zinc-800 border-y border-zinc-800">
                            {Array.from({ length: 8 }, (_, index) => {
                                const nextReward = Number(simulation?.initialBlockReward ?? initialReward) / (2 ** index);
                                const nextHeight = (index + 1) * scheduleInterval;
                                return <div key={index} className="flex justify-between gap-4 py-3 text-sm"><span>Halving {index} · from block #{index * scheduleInterval + 1}</span><span className="font-mono">{nextReward} BTC</span><span className="hidden text-xs text-zinc-600 sm:block">next at #{nextHeight}</span></div>;
                            })}
                        </div>
                    </section>
                </section>
            </div>
        </main>
    );
}

function Value({ label, value }) {
    return <div className="bg-black px-4 py-3"><p className="text-xs text-zinc-500">{label}</p><p className="mt-1 text-lg font-semibold">{value}</p></div>;
}
