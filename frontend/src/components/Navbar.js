"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { connectSimulationSocket } from "@/lib/api";

const routeGroups = [
    ["Overview", [["Dashboard", "/"], ["Network", "/network"], ["Statistics", "/statistics"], ["Timeline", "/timeline"]]],
    ["Chain", [["Blockchain", "/blockchain"], ["Transactions", "/transactions"], ["Mempool", "/mempool"], ["UTXOs", "/utxos"], ["Wallets", "/wallets"]]],
    ["Labs", [["Mining", "/mining"], ["Mining race", "/race"], ["Merkle", "/merkle"], ["Hash", "/hash"], ["Block header", "/header-lab"], ["Difficulty", "/difficulty"], ["Rewards", "/rewards"], ["Forks", "/forks"]]],
    ["Attack lab", [["Double spend", "/attacks/double-spend"], ["51% attack", "/attacks/51-percent"], ["Selfish mining", "/attacks/selfish-mining"]]]
];

const explanations = [
    ["Hash", "A fixed-length SHA-256 digest that changes when its input changes."],
    ["Nonce", "A block-header value miners vary while searching for a hash below the target."],
    ["Merkle root", "A single digest that commits to all transaction IDs in a block."],
    ["UTXO", "An unspent transaction output that can be referenced by a future transaction input."],
    ["Transaction input", "A reference to a previous unspent output being consumed by this transaction."],
    ["Transaction output", "A new amount locked to an address-like condition."],
    ["Coinbase", "The first block transaction that creates the allowed subsidy and collects fees."],
    ["Mempool", "A node’s pool of valid transactions that have not yet been confirmed in a block."],
    ["Difficulty", "A configurable leading-zero target that controls expected Proof-of-Work effort."],
    ["Proof-of-Work", "Repeated header hashing until a digest is numerically at or below the target."],
    ["Confirmation", "A transaction has one confirmation in its containing block; each later block adds one."],
    ["Fork", "Two valid branches share a parent block and compete to become canonical."],
    ["Cumulative work", "The sum of the proof-of-work assigned to every block in a chain."],
    ["Reorganization", "Replacing a local chain branch with a valid branch that has greater cumulative work."]
];

export default function Navbar() {
    const pathname = usePathname();
    const router = useRouter();
    const [explainMode, setExplainMode] = useState(false);
    const [connection, setConnection] = useState("connecting");
    const currentRoute = routeGroups.flatMap(([, routes]) => routes).find(([, href]) => href === pathname)?.[0] ?? "Dashboard";

    useEffect(() => {
        document.documentElement.dataset.explain = String(explainMode);
    }, [explainMode]);

    useEffect(() => {
        let active = true;
        const socket = connectSimulationSocket(() => {}, status => {
            if (active) setConnection(status);
        });
        return () => {
            active = false;
            socket.close();
        };
    }, []);

    function toggleExplain() {
        const next = !explainMode;
        setExplainMode(next);
        document.documentElement.dataset.explain = String(next);
    }

    return (
        <div className="sticky top-0 z-30 border-b border-zinc-800 bg-black/95 backdrop-blur">
            <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2.5 sm:px-6">
                <span className="shrink-0 text-sm font-semibold text-white">ChainLab</span>
                <label className="min-w-0 flex-1 sm:flex-none">
                    <span className="sr-only">Navigate to a page</span>
                    <select value={pathname} onChange={event => router.push(event.target.value)} aria-label={`Current page: ${currentRoute}`} className="w-full min-w-0 border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-zinc-500 sm:w-56">
                        {routeGroups.map(([group, routes]) => (
                            <optgroup key={group} label={group}>
                                {routes.map(([label, href]) => <option key={href} value={href}>{label}</option>)}
                            </optgroup>
                        ))}
                    </select>
                </label>
                <span className={`flex shrink-0 items-center gap-1.5 text-[10px] ${connection === "disconnected" ? "text-red-400" : "text-green-500"}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${connection === "disconnected" ? "bg-red-500" : "bg-green-500"}`} />
                    <span className="hidden sm:inline">{connection === "connected" ? "Live" : connection === "polling" ? "Polling" : connection === "connecting" ? "Connecting" : "Offline"}</span>
                </span>
                <label className="flex shrink-0 items-center gap-1.5 text-xs text-zinc-400">
                    <input type="checkbox" checked={explainMode} onChange={toggleExplain} className="accent-sky-500" />
                    Explain
                </label>
            </div>
            {explainMode && (
                <div className="border-t border-zinc-900 px-4 py-2 sm:px-6">
                    <div className="mx-auto grid max-w-7xl grid-cols-1 gap-x-5 gap-y-2 text-[10px] text-zinc-500 sm:grid-cols-2 lg:grid-cols-4">
                        {explanations.map(([term, definition]) => <p key={term}><span className="font-semibold text-sky-400">{term}:</span> {definition}</p>)}
                    </div>
                </div>
            )}
        </div>
    );
}
