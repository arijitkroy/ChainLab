"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const initialHeader = {
    version: 1,
    previousHash: "0".repeat(64),
    merkleRoot: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    timestamp: Date.now(),
    difficulty: 2,
    nonce: 0
};

export default function HeaderLab() {
    const [header, setHeader] = useState(initialHeader);
    const [hash, setHash] = useState("");

    useEffect(() => {
        let active = true;
        hashHeader(header).then(value => {
            if (active) setHash(value);
        });
        return () => { active = false; };
    }, [header]);

    function update(field, value) {
        setHeader(current => ({ ...current, [field]: field === "previousHash" || field === "merkleRoot" ? value : Number(value) }));
    }

    const difficulty = Math.max(0, Math.min(64, Math.trunc(Number(header.difficulty) || 0)));
    const target = "0".repeat(difficulty) + "f".repeat(64 - difficulty);
    const validProof = hash && BigInt(`0x${hash}`) <= BigInt(`0x${target}`);

    return (
        <main className="min-h-screen bg-black text-white">
            <div className="mx-auto max-w-5xl px-6 py-8">
                <p className="text-sm text-zinc-500"><Link href="/" className="hover:text-white">Dashboard</Link> / Block Header Lab</p>
                <h1 className="mt-2 text-2xl font-semibold">Block Header Lab</h1>
                <p className="mt-1 text-sm text-zinc-500">Edit any header field and recalculate the block hash immediately.</p>

                <section className="mt-7 grid gap-4 sm:grid-cols-2">
                    <HeaderInput label="Version" value={header.version} onChange={value => update("version", value)} />
                    <HeaderInput label="Timestamp (Unix ms)" value={header.timestamp} onChange={value => update("timestamp", value)} />
                    <HeaderInput label="Previous block hash" value={header.previousHash} onChange={value => update("previousHash", value)} mono />
                    <HeaderInput label="Merkle root" value={header.merkleRoot} onChange={value => update("merkleRoot", value)} mono />
                    <HeaderInput label="Difficulty" value={header.difficulty} onChange={value => update("difficulty", value)} type="number" />
                    <HeaderInput label="Nonce" value={header.nonce} onChange={value => update("nonce", value)} type="number" />
                </section>

                <section className="mt-8 border-y border-zinc-800 py-5">
                    <div className="flex flex-wrap justify-between gap-3">
                        <h2 className="font-semibold">SHA-256 block hash</h2>
                        <span className={`text-sm ${validProof ? "text-green-400" : "text-yellow-400"}`}>{validProof ? "Meets current target" : "Does not meet target"}</span>
                    </div>
                    <p className="mt-3 break-all font-mono text-sm text-zinc-200">{hash || "Calculating..."}</p>
                    <p className="mt-4 text-xs text-zinc-500">Target: <span className="break-all font-mono">{target}</span></p>
                    <p className="mt-3 text-xs text-zinc-500">This lab hashes version, previous hash, timestamp, Merkle root, difficulty, and nonce in a simplified header encoding.</p>
                </section>
            </div>
        </main>
    );
}

function HeaderInput({ label, value, onChange, mono = false, type = "text" }) {
    return (
        <label className="block min-w-0 text-xs text-zinc-500">
            {label}
            <input type={type} value={value} onChange={event => onChange(event.target.value)} className={`mt-1 block w-full border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-sm text-white outline-none focus:border-zinc-500 ${mono ? "font-mono" : ""}`} />
        </label>
    );
}

async function hashHeader(header) {
    const value = [header.version, header.previousHash, header.timestamp, header.merkleRoot, header.difficulty, header.nonce].join("|");
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}
