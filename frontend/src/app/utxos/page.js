"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { connectSimulationSocket, getUTXOs } from "@/lib/api";

export default function UTXOExplorer() {
    const [data, setData] = useState(null);
    const [addressFilter, setAddressFilter] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        let active = true;
        let knownHeight = null;

        async function refresh() {
            try {
                const next = await getUTXOs();
                if (!active) return;
                setData(next);
                setError("");
            } catch (fetchError) {
                if (active) setError(fetchError.message);
            } finally {
                if (active) setLoading(false);
            }
        }

        const socket = connectSimulationSocket(snapshot => {
            if (snapshot.networkHeight !== knownHeight) {
                knownHeight = snapshot.networkHeight;
                refresh();
            }
        });

        refresh();
        return () => {
            active = false;
            socket.close();
        };
    }, []);

    const filteredUTXOs = (data?.utxos ?? []).filter(utxo => {
        const matchesAddress = utxo.address.toLowerCase().includes(addressFilter.trim().toLowerCase());
        return matchesAddress && (statusFilter === "all" || utxo.status === statusFilter);
    });

    return (
        <main className="min-h-screen bg-black text-white">
            <div className="mx-auto max-w-7xl px-6 py-8">
                <div className="mb-6">
                    <p className="text-sm text-zinc-500"><Link href="/" className="hover:text-white">Dashboard</Link> / UTXOs</p>
                    <h1 className="mt-2 text-2xl font-semibold">UTXO Explorer</h1>
                    <p className="mt-1 max-w-2xl text-sm text-zinc-500">ChainLab uses simplified address locks. Spent outputs remain visible in history; only unspent outputs contribute to simulated supply.</p>
                </div>

                {error && (
                    <div role="alert" className="mb-5 flex items-center justify-between border border-red-900 bg-red-950/30 px-4 py-3 text-sm text-red-300">
                        <span>{error}. Check that the backend is running.</span>
                        <button onClick={() => window.location.reload()} className="underline underline-offset-4">Retry</button>
                    </div>
                )}

                <section aria-label="UTXO summary" className="mb-7 grid grid-cols-2 gap-px border border-zinc-800 bg-zinc-800 sm:grid-cols-4">
                    <SummaryValue label="Unspent UTXOs" value={data?.summary.utxoCount ?? "..."} />
                    <SummaryValue label="Simulated supply" value={data ? `${formatAmount(data.summary.totalSupply)} BTC` : "..."} />
                    <SummaryValue label="Spent outputs" value={data?.summary.spentOutputCount ?? "..."} />
                    <SummaryValue label="Outputs in history" value={data?.summary.totalOutputCount ?? "..."} />
                </section>

                <section aria-labelledby="utxo-list-heading">
                    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                            <h2 id="utxo-list-heading" className="text-base font-semibold">Output history</h2>
                            <p className="mt-1 text-xs text-zinc-500">{filteredUTXOs.length} of {data?.utxos.length ?? 0} outputs</p>
                        </div>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(220px,1fr)_160px]">
                            <label className="text-xs text-zinc-500">
                                Filter address
                                <input
                                    type="search"
                                    value={addressFilter}
                                    onChange={event => setAddressFilter(event.target.value)}
                                    placeholder="Enter an address"
                                    className="mt-1 block w-full border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
                                />
                            </label>
                            <label className="text-xs text-zinc-500">
                                Status
                                <select value={statusFilter} onChange={event => setStatusFilter(event.target.value)} className="mt-1 block w-full border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white focus:border-zinc-500 focus:outline-none">
                                    <option value="all">All outputs</option>
                                    <option value="unspent">Unspent</option>
                                    <option value="spent">Spent</option>
                                </select>
                            </label>
                        </div>
                    </div>

                    {loading && !data ? (
                        <p className="border-y border-zinc-800 py-12 text-center text-sm text-zinc-500">Loading UTXO history...</p>
                    ) : filteredUTXOs.length ? (
                        <div className="divide-y divide-zinc-800 border-y border-zinc-800">
                            {filteredUTXOs.map(utxo => <UTXORow key={`${utxo.txId}:${utxo.outputIndex}`} utxo={utxo} />)}
                        </div>
                    ) : (
                        <p className="border-y border-zinc-800 py-12 text-center text-sm text-zinc-500">
                            {data?.utxos.length ? "No outputs match these filters." : "No outputs are available yet."}
                        </p>
                    )}
                </section>
            </div>
        </main>
    );
}

function UTXORow({ utxo }) {
    return (
        <article title={`Locking condition: ${JSON.stringify(utxo.lockingCondition)}`} className="grid grid-cols-2 gap-x-5 gap-y-4 py-4 sm:grid-cols-[minmax(0,1.5fr)_minmax(0,1.4fr)_90px_120px_110px_100px] sm:items-center">
            <Value label="Address">
                <span className="break-all text-sm text-zinc-200">{utxo.address}</span>
            </Value>
            <Value label="Transaction ID">
                <span className="flex min-w-0 items-start gap-2">
                    <span className="break-all font-mono text-xs text-zinc-400">{shortHash(utxo.txId)}</span>
                    <CopyButton value={utxo.txId} />
                </span>
            </Value>
            <Value label="Output index"><span className="font-mono text-sm">{utxo.outputIndex}</span></Value>
            <Value label="Amount"><span className="font-mono text-sm">{formatAmount(utxo.amount)} BTC</span></Value>
            <Value label="Age"><span className="text-sm text-zinc-400">{formatAge(utxo.ageSeconds)}</span></Value>
            <Value label="Status">
                <span className={`inline-flex items-center gap-2 text-xs ${utxo.status === "unspent" ? "text-green-400" : "text-zinc-500"}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${utxo.status === "unspent" ? "bg-green-500" : "bg-zinc-600"}`} />
                    {utxo.status}
                </span>
            </Value>
            {utxo.status === "spent" && utxo.spentAtHeight !== null && (
                <p className="col-span-2 text-xs text-zinc-600 sm:col-span-6">Spent in block #{utxo.spentAtHeight}</p>
            )}
        </article>
    );
}

function Value({ label, children }) {
    return (
        <div className="min-w-0">
            <p className="mb-1 text-[10px] uppercase text-zinc-600 sm:hidden">{label}</p>
            <p className="text-xs text-zinc-500 sm:hidden">{children}</p>
            <div className="hidden sm:block">
                <p className="mb-1 text-[10px] uppercase text-zinc-600">{label}</p>
                {children}
            </div>
        </div>
    );
}

function SummaryValue({ label, value }) {
    return (
        <div className="bg-black px-4 py-3">
            <p className="text-xs text-zinc-500">{label}</p>
            <p className="mt-1 text-lg font-semibold">{value}</p>
        </div>
    );
}

function CopyButton({ value }) {
    const [copied, setCopied] = useState(false);

    async function copy() {
        try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1200);
        } catch {
            setCopied(false);
        }
    }

    return (
        <button type="button" onClick={copy} aria-label="Copy transaction ID" title="Copy transaction ID" className="shrink-0 text-xs text-zinc-600 hover:text-white">
            {copied ? "Copied" : "Copy"}
        </button>
    );
}

function shortHash(hash) {
    return hash.length > 24 ? `${hash.slice(0, 14)}...${hash.slice(-6)}` : hash;
}

function formatAge(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (days) return `${days}d ${hours}h`;
    if (hours) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
}

function formatAmount(amount) {
    return Number(amount ?? 0).toFixed(3);
}
