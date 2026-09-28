"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { connectSimulationSocket, getBlocks } from "@/lib/api";

export default function BlockchainExplorer() {
    const [data, setData] = useState(null);
    const [selectedHeight, setSelectedHeight] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        let active = true;
        let knownHeight = null;

        async function refresh() {
            try {
                const next = await getBlocks();
                if (!active) return;

                knownHeight = next.summary.chainHeight;
                setData(next);
                setSelectedHeight(current =>
                    current !== null && next.blocks.some(block => block.height === current)
                        ? current
                        : next.summary.chainHeight
                );
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

    const selectedBlock = data?.blocks.find(block => block.height === selectedHeight);

    return (
        <main className="min-h-screen bg-black text-white">
            <div className="mx-auto max-w-7xl px-6 py-8">
                <div className="mb-6">
                    <p className="text-sm text-zinc-500"><Link href="/" className="hover:text-white">Dashboard</Link> / Explorer</p>
                    <h1 className="mt-2 text-2xl font-semibold">Blockchain</h1>
                    <p className="mt-1 text-sm text-zinc-500">Inspect blocks, Proof-of-Work data, and transaction flows. Six confirmations is a common convention, not a protocol requirement.</p>
                </div>

                {error && (
                    <div role="alert" className="mb-5 flex items-center justify-between border border-red-900 bg-red-950/30 px-4 py-3 text-sm text-red-300">
                        <span>{error}. Check that the backend is running.</span>
                        <button onClick={() => window.location.reload()} className="underline underline-offset-4">Retry</button>
                    </div>
                )}

                <section aria-label="Chain summary" className="mb-8 grid grid-cols-2 gap-px border border-zinc-800 bg-zinc-800 md:grid-cols-3 xl:grid-cols-6">
                    <SummaryValue label="Chain height" value={data?.summary.chainHeight ?? "..."} />
                    <SummaryValue label="Total blocks" value={data?.summary.totalBlocks ?? "..."} />
                    <SummaryValue label="Transactions" value={data?.summary.totalTransactions ?? "..."} />
                    <SummaryValue label="Difficulty" value={data?.summary.difficulty ?? "..."} />
                    <SummaryValue label="Mining reward" value={data ? `${data.summary.miningReward} BTC` : "..."} />
                    <SummaryValue label="Avg. block time" value={formatDuration(data?.summary.averageBlockTimeSeconds)} />
                </section>

                {loading && !data ? (
                    <p className="py-16 text-center text-sm text-zinc-500">Loading blockchain...</p>
                ) : data && (
                    <div className="grid gap-8 lg:grid-cols-[minmax(260px,0.8fr)_minmax(0,2fr)]">
                        <section aria-labelledby="blocks-heading">
                            <div className="mb-3 flex items-center justify-between">
                                <h2 id="blocks-heading" className="text-base font-semibold">Blocks</h2>
                                <span className="text-xs text-zinc-500">{data.blocks.length} total</span>
                            </div>
                            <ol className="max-h-180 divide-y divide-zinc-800 overflow-y-auto border-y border-zinc-800">
                                {[...data.blocks].reverse().map(block => (
                                    <li key={block.height}>
                                        <button
                                            onClick={() => setSelectedHeight(block.height)}
                                            aria-pressed={selectedHeight === block.height}
                                            className={`w-full px-3 py-4 text-left transition-colors hover:bg-zinc-900 ${selectedHeight === block.height ? "bg-zinc-900" : ""}`}
                                        >
                                            <span className="flex items-center justify-between gap-3">
                                                <span className="font-medium">Block #{block.height}</span>
                                                <span className="text-xs text-zinc-500">{block.confirmations} conf.</span>
                                            </span>
                                            <span className="mt-1 block font-mono text-xs text-zinc-500">{shortHash(block.hash)}</span>
                                            <span className="mt-2 flex justify-between text-xs text-zinc-600">
                                                <span>{block.transactionCount} tx</span>
                                                <span>{formatTimestamp(block.timestamp)}</span>
                                            </span>
                                        </button>
                                    </li>
                                ))}
                            </ol>
                        </section>

                        {selectedBlock ? <BlockInspector block={selectedBlock} /> : (
                            <section className="border-y border-zinc-800 py-12 text-center text-sm text-zinc-500">
                                Select a block to inspect its contents.
                            </section>
                        )}
                    </div>
                )}
            </div>
        </main>
    );
}

function BlockInspector({ block }) {
    return (
        <section aria-labelledby="block-title" className="min-w-0">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div>
                    <p className="text-xs uppercase text-zinc-500">Block inspector</p>
                    <h2 id="block-title" className="mt-1 text-xl font-semibold">Block #{block.height}</h2>
                </div>
                <span className={`border px-2 py-1 text-xs ${block.confirmations >= 6 ? "border-green-900 text-green-400" : "border-yellow-900 text-yellow-400"}`}>{block.confirmations} confirmations</span>
            </div>

            <dl className="grid gap-x-6 border-y border-zinc-800 sm:grid-cols-2">
                <HashValue label="Block hash" value={block.hash} />
                <HashValue label="Previous block hash" value={block.previousHash} />
                <HashValue label="Merkle root" value={block.merkleRoot} />
                <DetailValue label="Timestamp" value={formatTimestamp(block.timestamp, true)} />
                <DetailValue label="Version" value={block.version} mono />
                <DetailValue label="Nonce" value={block.nonce} mono />
                <DetailValue label="Difficulty" value={block.difficulty} />
                <DetailValue label="Miner" value={block.miner} />
                <DetailValue label="Transaction count" value={block.transactionCount} />
                <DetailValue label="Block reward" value={`${formatAmount(block.reward)} BTC`} />
                <DetailValue label="Transaction fees" value={`${formatAmount(block.fees)} BTC`} />
                <DetailValue label="Block size" value={`${block.sizeBytes.toLocaleString()} bytes`} />
                <DetailValue label="Confirmations" value={block.confirmations} />
            </dl>

            <div className="mt-6">
                <div className="mb-3 flex items-baseline justify-between">
                    <h3 className="text-base font-semibold">Transactions</h3>
                    <span className="text-xs text-zinc-500">{block.transactionCount} in this block</span>
                </div>
                {block.transactions.length ? (
                    <div className="divide-y divide-zinc-800 border-y border-zinc-800">
                        {block.transactions.map(transaction => <TransactionDetails key={transaction.id} transaction={transaction} />)}
                    </div>
                ) : (
                    <p className="border-y border-zinc-800 py-6 text-sm text-zinc-500">The genesis block has no transactions.</p>
                )}
            </div>
        </section>
    );
}

function TransactionDetails({ transaction }) {
    return (
        <details className="group py-3">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                <span className="min-w-0">
                    <span className="mr-2 text-xs text-zinc-500">{transaction.coinbase ? "COINBASE" : "TRANSACTION"}</span>
                    <span className="font-mono text-xs text-zinc-300">{shortHash(transaction.id)}</span>
                </span>
                <span className="shrink-0 text-xs text-zinc-500">Fee {formatAmount(transaction.fee)} BTC</span>
            </summary>
            <div className="mt-4 space-y-4 border-l border-zinc-800 pl-4">
                <HashValue label="Transaction ID" value={transaction.id} />
                <div>
                    <h4 className="mb-2 text-xs font-semibold uppercase text-zinc-500">Inputs</h4>
                    {transaction.inputs.length ? transaction.inputs.map((input, index) => (
                        <div key={`${input.txId}:${input.outputIndex}:${index}`} className="mb-2 text-xs">
                            {transaction.coinbase ? (
                                <p className="text-zinc-400">Coinbase issuance (no previous UTXO)</p>
                            ) : (
                                <>
                                    <p className="font-mono text-zinc-300">{shortHash(input.txId)}:{input.outputIndex}</p>
                                    <p className="mt-1 text-zinc-500">{input.address ?? "Unknown address"} · {input.amount === null ? "Unknown amount" : `${formatAmount(input.amount)} BTC`}</p>
                                </>
                            )}
                        </div>
                    )) : <p className="text-xs text-zinc-500">No inputs</p>}
                </div>
                <div>
                    <h4 className="mb-2 text-xs font-semibold uppercase text-zinc-500">Outputs</h4>
                    {transaction.outputs.map(output => (
                        <div key={output.outputIndex} className="mb-2 flex flex-wrap justify-between gap-2 text-xs">
                            <span className="text-zinc-400">#{output.outputIndex} · {output.address}</span>
                            <span className="font-mono text-zinc-300">{formatAmount(output.amount)} BTC</span>
                        </div>
                    ))}
                </div>
                <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-zinc-500">
                    <span>Input value: {transaction.coinbase ? "New issuance" : `${formatAmount(transaction.inputValue)} BTC`}</span>
                    <span>Output value: {formatAmount(transaction.outputValue)} BTC</span>
                    <span>Fee: {formatAmount(transaction.fee)} BTC</span>
                    <span>Coinbase: {transaction.coinbase ? "Yes" : "No"}</span>
                </div>
            </div>
        </details>
    );
}

function SummaryValue({ label, value }) {
    return (
        <div className="bg-black px-4 py-3">
            <dt className="text-xs text-zinc-500">{label}</dt>
            <dd className="mt-1 text-lg font-semibold">{value}</dd>
        </div>
    );
}

function DetailValue({ label, value, mono = false }) {
    return (
        <div className="min-w-0 border-b border-zinc-800 py-3">
            <dt className="text-xs text-zinc-500">{label}</dt>
            <dd className={`mt-1 wrap-break-word text-sm text-zinc-200 ${mono ? "font-mono" : ""}`}>{value}</dd>
        </div>
    );
}

function HashValue({ label, value }) {
    return (
        <div className="min-w-0 border-b border-zinc-800 py-3 sm:col-span-2">
            <dt className="text-xs text-zinc-500">{label}</dt>
            <dd className="mt-1 flex min-w-0 items-start justify-between gap-3">
                <span className="break-all font-mono text-xs text-zinc-300">{value}</span>
                <CopyButton value={value} label={label} />
            </dd>
        </div>
    );
}

function CopyButton({ value, label }) {
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
        <button type="button" onClick={copy} aria-label={`Copy ${label}`} title={`Copy ${label}`} className="shrink-0 text-xs text-zinc-500 hover:text-white focus-visible:ring-1 focus-visible:ring-zinc-400">
            {copied ? "Copied" : "Copy"}
        </button>
    );
}

function shortHash(hash) {
    return hash.length > 20 ? `${hash.slice(0, 12)}...${hash.slice(-6)}` : hash;
}

function formatTimestamp(timestamp, includeDate = false) {
    return new Date(timestamp).toLocaleString(undefined, includeDate
        ? { dateStyle: "medium", timeStyle: "medium" }
        : { timeStyle: "medium" }
    );
}

function formatDuration(seconds) {
    if (seconds === null || seconds === undefined) return "Waiting for blocks";
    if (seconds < 60) return `${seconds.toFixed(1)} sec`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60);
    return `${minutes}m ${remainingSeconds}s`;
}

function formatAmount(amount) {
    return Number(amount ?? 0).toFixed(3);
}
