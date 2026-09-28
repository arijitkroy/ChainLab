"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { connectSimulationSocket, getMempool } from "@/lib/api";

export default function MempoolPage() {
    const [data, setData] = useState(null);
    const [filter, setFilter] = useState("");
    const [error, setError] = useState("");

    useEffect(() => {
        let active = true;
        let knownSize = null;

        async function refresh() {
            try {
                const next = await getMempool();
                if (active) {
                    setData(next);
                    setError("");
                }
            } catch (fetchError) {
                if (active) setError(fetchError.message);
            }
        }

        const socket = connectSimulationSocket(snapshot => {
            const size = snapshot.nodes.reduce((total, node) => total + node.mempoolSize, 0);
            if (size !== knownSize) {
                knownSize = size;
                refresh();
            }
        });
        refresh();

        return () => {
            active = false;
            socket.close();
        };
    }, []);

    const transactions = (data?.transactions ?? []).filter(transaction =>
        transaction.id.toLowerCase().includes(filter.toLowerCase()) ||
        transaction.inputs.some(input => input.txId.toLowerCase().includes(filter.toLowerCase())) ||
        transaction.outputs.some(output => output.address.toLowerCase().includes(filter.toLowerCase()))
    );

    return (
        <main className="min-h-screen bg-black text-white">
            <div className="mx-auto max-w-7xl px-6 py-8">
                <p className="text-sm text-zinc-500"><Link href="/" className="hover:text-white">Dashboard</Link> / Mempool</p>
                <h1 className="mt-2 text-2xl font-semibold">Mempool</h1>
                <p className="mt-1 text-sm text-zinc-500">Valid unconfirmed transactions accepted by the canonical node.</p>

                {error && <p role="alert" className="mt-5 border border-red-900 bg-red-950/30 px-4 py-3 text-sm text-red-300">{error}</p>}

                <section aria-label="Mempool summary" className="mt-6 grid grid-cols-2 gap-px border border-zinc-800 bg-zinc-800 sm:grid-cols-3">
                    <SummaryValue label="Transactions" value={data?.summary.count ?? "..."} />
                    <SummaryValue label="Aggregate fees" value={data ? `${data.summary.totalFees.toFixed(3)} BTC` : "..."} />
                    <SummaryValue label="Max entries" value="500" />
                </section>

                <div className="my-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
                    <div>
                        <h2 className="font-semibold">Unconfirmed transactions</h2>
                        <p className="mt-1 text-xs text-zinc-500">{transactions.length} shown</p>
                    </div>
                    <label className="text-xs text-zinc-500">
                        Filter by ID, input, or output address
                        <input value={filter} onChange={event => setFilter(event.target.value)} className="mt-1 block w-full border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:border-zinc-500 sm:w-80" />
                    </label>
                </div>

                {transactions.length ? (
                    <div className="divide-y divide-zinc-800 border-y border-zinc-800">
                        {transactions.map(transaction => <TransactionRow key={transaction.id} transaction={transaction} />)}
                    </div>
                ) : (
                    <p className="border-y border-zinc-800 py-12 text-center text-sm text-zinc-500">
                        {data ? "No transactions match the filter." : "Loading mempool..."}
                    </p>
                )}
            </div>
        </main>
    );
}

function TransactionRow({ transaction }) {
    return (
        <details className="py-4">
            <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3">
                <span className="min-w-0 break-all font-mono text-xs text-zinc-300">{transaction.id}</span>
                <span className="flex shrink-0 gap-4 text-xs text-zinc-500">
                    <span>{transaction.fee.toFixed(3)} BTC fee</span>
                    <span>{transaction.feeRate.toFixed(8)} BTC/byte</span>
                    <span>{formatAge(transaction.ageSeconds)}</span>
                </span>
            </summary>
            <div className="mt-4 grid gap-5 border-l border-zinc-800 pl-4 sm:grid-cols-2">
                <div>
                    <h3 className="mb-2 text-xs uppercase text-zinc-500">Inputs</h3>
                    {transaction.inputs.map((input, index) => (
                        <p key={`${input.txId}:${input.outputIndex}:${index}`} className="mb-2 break-all font-mono text-xs text-zinc-400">
                            {input.txId}:{input.outputIndex}
                        </p>
                    ))}
                </div>
                <div>
                    <h3 className="mb-2 text-xs uppercase text-zinc-500">Outputs</h3>
                    {transaction.outputs.map((output, index) => (
                        <p key={`${output.address}:${index}`} className="mb-2 flex justify-between gap-3 text-xs">
                            <span className="break-all text-zinc-400">{output.address}</span>
                            <span className="shrink-0 font-mono">{output.amount.toFixed(3)} BTC</span>
                        </p>
                    ))}
                </div>
                <p className="text-xs text-yellow-500">Status: unconfirmed</p>
            </div>
        </details>
    );
}

function SummaryValue({ label, value }) {
    return <div className="bg-black px-4 py-3"><p className="text-xs text-zinc-500">{label}</p><p className="mt-1 text-lg font-semibold">{value}</p></div>;
}

function formatAge(seconds) {
    if (seconds < 60) return `${Math.floor(seconds)}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}
