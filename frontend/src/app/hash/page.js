"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function HashLab() {
    const [original, setOriginal] = useState("ChainLab demonstrates SHA-256 avalanche behavior.");
    const [comparison, setComparison] = useState("ChainLab demonstrates SHA-256 avalanche behavior!");
    const [hashes, setHashes] = useState(null);

    useEffect(() => {
        let active = true;
        Promise.all([sha256(original), sha256(comparison)]).then(([first, second]) => {
            if (active) setHashes([first, second]);
        });
        return () => { active = false; };
    }, [original, comparison]);

    const changedPositions = hashes
        ? Array.from(hashes[0], (character, index) => character !== hashes[1][index] ? index : -1).filter(index => index >= 0)
        : [];

    return (
        <main className="min-h-screen bg-black text-white">
            <div className="mx-auto max-w-6xl px-6 py-8">
                <p className="text-sm text-zinc-500"><Link href="/" className="hover:text-white">Dashboard</Link> / Hash Lab</p>
                <h1 className="mt-2 text-2xl font-semibold">SHA-256 Hash Lab</h1>
                <p className="mt-1 text-sm text-zinc-500">Change one character and compare every hexadecimal position.</p>

                <div className="mt-7 grid gap-6 md:grid-cols-2">
                    <HashInput label="Original data" value={original} onChange={setOriginal} />
                    <HashInput label="Modified data" value={comparison} onChange={setComparison} />
                </div>

                <section aria-label="Hash comparison" className="mt-8 border-y border-zinc-800 py-5">
                    <div className="mb-5 flex flex-wrap items-baseline justify-between gap-3">
                        <h2 className="font-semibold">Avalanche comparison</h2>
                        <p className="text-sm text-red-400">{changedPositions.length} of 64 hex positions changed</p>
                    </div>
                    {hashes ? (
                        <div className="space-y-3 overflow-x-auto">
                            <HashRow label="Original" hash={hashes[0]} comparison={hashes[1]} />
                            <HashRow label="Modified" hash={hashes[1]} comparison={hashes[0]} />
                        </div>
                    ) : <p className="text-sm text-zinc-500">Calculating hashes...</p>}
                    <p className="mt-5 max-w-3xl text-xs text-zinc-500">A SHA-256 digest is fixed at 256 bits. A tiny input change produces an unrelated-looking digest; this is useful for detecting changes in block data.</p>
                </section>
            </div>
        </main>
    );
}

function HashInput({ label, value, onChange }) {
    return (
        <label className="block text-sm text-zinc-400">
            {label}
            <textarea value={value} onChange={event => onChange(event.target.value)} rows={5} className="mt-2 block w-full resize-y border border-zinc-800 bg-zinc-950 p-3 font-mono text-sm text-white outline-none focus:border-zinc-500" />
        </label>
    );
}

function HashRow({ label, hash, comparison }) {
    return (
        <div className="grid min-w-165 grid-cols-[90px_minmax(0,1fr)] gap-3">
            <span className="text-xs text-zinc-500">{label}</span>
            <code className="break-all font-mono text-sm">
                {Array.from(hash, (character, index) => <span key={index} className={character !== comparison[index] ? "bg-red-950 text-red-300" : "text-zinc-300"}>{character}</span>)}
            </code>
        </div>
    );
}

async function sha256(value) {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}
