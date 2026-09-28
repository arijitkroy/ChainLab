"use client";

import { useState } from "react";
import { pauseSimulation, resetSimulation, setSimulationSpeed, startSimulation, stepSimulation, updateSimulationControls } from "@/lib/api";

const speedOptions = [0.25, 0.5, 1, 2, 5, 10];
const controlLabels = {
    miningEnabled: "Mining",
    transactionGeneration: "Generate transactions",
    blockPropagation: "Block propagation",
    networkFailures: "Network failures"
};

export default function SimulationControls({ simulation }) {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    async function run(action) {
        setBusy(true);
        setError("");
        try {
            await action();
        } catch (actionError) {
            setError(actionError.message);
        } finally {
            setBusy(false);
        }
    }

    async function toggle(name, value) {
        await run(() => updateSimulationControls({ [name]: value }));
    }

    const controls = simulation?.controls ?? {};

    return (
        <section aria-label="Simulation controls" className="border-y border-zinc-800 py-4">
            <div className="flex flex-wrap items-center gap-2">
                <button onClick={() => run(startSimulation)} disabled={busy || simulation?.running} className="border border-green-900 px-3 py-2 text-sm text-green-400 disabled:opacity-40">Start</button>
                <button onClick={() => run(pauseSimulation)} disabled={busy || !simulation?.running} className="border border-zinc-700 px-3 py-2 text-sm text-zinc-300 disabled:opacity-40">Pause</button>
                <button onClick={() => run(stepSimulation)} disabled={busy} className="border border-zinc-700 px-3 py-2 text-sm text-zinc-300 disabled:opacity-40">Step</button>
                <button onClick={() => window.confirm("Reset the in-memory blockchain simulation?") && run(resetSimulation)} disabled={busy} className="border border-red-900 px-3 py-2 text-sm text-red-400 disabled:opacity-40">Reset</button>
                <label className="ml-auto flex items-center gap-2 text-xs text-zinc-500">Speed
                    <select value={simulation?.speed ?? 1} onChange={event => run(() => setSimulationSpeed(Number(event.target.value)))} className="border border-zinc-800 bg-zinc-950 px-2 py-2 text-sm text-white">
                        {speedOptions.map(speed => <option key={speed} value={speed}>{speed}x</option>)}
                    </select>
                </label>
            </div>
            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
                {Object.entries(controlLabels).map(([key, label]) => (
                    <label key={key} className="flex items-center gap-2 text-xs text-zinc-400">
                        <input type="checkbox" checked={Boolean(controls[key])} onChange={event => toggle(key, event.target.checked)} disabled={busy} className="accent-green-500" />
                        {label}
                    </label>
                ))}
            </div>
            {error && <p role="alert" className="mt-3 text-xs text-red-400">{error}</p>}
        </section>
    );
}
