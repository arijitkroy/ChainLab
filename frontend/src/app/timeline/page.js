"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getBlocks, getSimulation } from "@/lib/api";

export default function TimelinePage() {
    const [items, setItems] = useState([]);
    const [blocks, setBlocks] = useState([]);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [playing, setPlaying] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        let active = true;
        Promise.all([getSimulation(), getBlocks()]).then(([simulation, chain]) => {
            if (!active) return;
            setBlocks(chain.blocks);
            const timeline = [
                { type: "GENESIS", timestamp: chain.blocks[0].timestamp, height: 0, blockHash: chain.blocks[0].hash },
                ...simulation.events.filter(event => event.type !== "MINING_PROGRESS")
            ].sort((left, right) => left.timestamp - right.timestamp);
            let currentHeight = 0;
            const withState = timeline.map(item => {
                if (Number.isInteger(item.height)) currentHeight = item.height;
                return { ...item, stateHeight: currentHeight };
            });
            setItems(withState);
            setSelectedIndex(Math.max(0, withState.length - 1));
        }).catch(fetchError => setError(fetchError.message));
        return () => { active = false; };
    }, []);

    useEffect(() => {
        if (!playing) return undefined;
        const interval = window.setInterval(() => {
            setSelectedIndex(index => {
                if (index >= items.length - 1) {
                    setPlaying(false);
                    return index;
                }
                return index + 1;
            });
        }, 700);
        return () => window.clearInterval(interval);
    }, [playing, items.length]);

    const selected = items[selectedIndex];
    const selectedBlock = blocks.find(block => block.height === selected?.stateHeight);

    return (
        <main className="min-h-screen bg-black text-white">
            <div className="mx-auto max-w-6xl px-6 py-8">
                <p className="text-sm text-zinc-500"><Link href="/" className="hover:text-white">Dashboard</Link> / Timeline</p>
                <h1 className="mt-2 text-2xl font-semibold">Blockchain Timeline</h1>
                <p className="mt-1 text-sm text-zinc-500">Scrub through recorded simulation events and inspect the canonical block at that point.</p>
                {error && <p role="alert" className="mt-5 text-sm text-red-400">{error}</p>}

                <section className="mt-8 border-y border-zinc-800 py-6">
                    <div className="flex items-center justify-between gap-4"><span className="text-xs text-zinc-500">Event {items.length ? selectedIndex + 1 : 0} / {items.length}</span><button onClick={() => setPlaying(value => !value)} disabled={!items.length} className="border border-zinc-700 px-3 py-2 text-sm disabled:opacity-40">{playing ? "Pause" : "Play timeline"}</button></div>
                    <input type="range" min="0" max={Math.max(0, items.length - 1)} value={selectedIndex} onChange={event => { setPlaying(false); setSelectedIndex(Number(event.target.value)); }} className="mt-5 w-full accent-sky-500" />
                    {selected && (
                        <div className="mt-6 grid gap-8 sm:grid-cols-2">
                            <div><p className="text-xs uppercase text-zinc-500">Selected event</p><h2 className="mt-2 text-lg font-semibold">{selected.type.replaceAll("_", " ")}</h2><p className="mt-2 text-sm text-zinc-400">{selected.height === undefined ? "Simulation event" : `Block #${selected.height}`}</p><p className="mt-1 text-xs text-zinc-500">{new Date(selected.timestamp).toLocaleString()}</p></div>
                            <div><p className="text-xs uppercase text-zinc-500">Canonical state preview</p><p className="mt-2 text-lg font-semibold">Height {selected.stateHeight}</p><p className="mt-2 break-all font-mono text-xs text-zinc-400">{selectedBlock?.hash ?? "Genesis state"}</p><Link href={`/blockchain`} className="mt-3 inline-block text-xs text-sky-400 hover:text-sky-300">Open explorer</Link></div>
                        </div>
                    )}
                </section>

                <ol className="mt-7 divide-y divide-zinc-800 border-y border-zinc-800">
                    {[...items].reverse().slice(0, 30).map((item, index) => {
                        const actualIndex = items.length - 1 - index;
                        return <li key={`${item.type}:${item.timestamp}:${index}`}><button onClick={() => { setPlaying(false); setSelectedIndex(actualIndex); }} className={`flex w-full justify-between gap-4 py-3 text-left text-sm ${actualIndex === selectedIndex ? "text-white" : "text-zinc-500"}`}><span>{item.type.replaceAll("_", " ")} · height {item.stateHeight}</span><span className="shrink-0 text-xs">{new Date(item.timestamp).toLocaleTimeString()}</span></button></li>;
                    })}
                </ol>
            </div>
        </main>
    );
}
