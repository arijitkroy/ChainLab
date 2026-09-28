"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { connectSimulationSocket, getTransactions } from "@/lib/api";

export default function TransactionsPage() {
    const [transactions, setTransactions] = useState([]);
    const [filter, setFilter] = useState("");
    const [status, setStatus] = useState("all");
    const [error, setError] = useState("");

    useEffect(() => {
        let active = true;
        let lastKey = "";
        async function refresh() {
            try {
                const data = await getTransactions();
                if (active) {
                    setTransactions(data.transactions);
                    setError("");
                }
            } catch (fetchError) {
                if (active) setError(fetchError.message);
            }
        }
        refresh();
        const socket = connectSimulationSocket(snapshot => {
            const key = `${snapshot.networkHeight}:${snapshot.nodes.reduce((total, node) => total + node.mempoolSize, 0)}`;
            if (key !== lastKey) {
                lastKey = key;
                refresh();
            }
        });
        return () => { active = false; socket.close(); };
    }, []);

    const filtered = transactions.filter(transaction => {
        const query = filter.toLowerCase();
        const matchesText = !query || transaction.id.toLowerCase().includes(query) ||
            transaction.outputs.some(output => output.address.toLowerCase().includes(query)) ||
            transaction.inputs.some(input => input.txId.toLowerCase().includes(query) || input.address?.toLowerCase().includes(query));
        return matchesText && (status === "all" || transaction.status === status);
    });
    const pendingCount = transactions.filter(transaction => transaction.status === "unconfirmed").length;

    return (
        <main className="min-h-screen bg-black text-white">
            <div className="mx-auto max-w-7xl px-6 py-8">
                <p className="text-sm text-zinc-500"><Link href="/" className="hover:text-white">Dashboard</Link> / Transactions</p>
                <h1 className="mt-2 text-2xl font-semibold">Transaction History</h1>
                <p className="mt-1 text-sm text-zinc-500">Confirmed transactions and unconfirmed mempool entries.</p>
                {error && <p role="alert" className="mt-5 text-sm text-red-400">{error}</p>}

                <section className="mt-6 grid grid-cols-2 gap-px border border-zinc-800 bg-zinc-800 sm:grid-cols-3">
                    <Summary label="All transactions" value={transactions.length} />
                    <Summary label="Unconfirmed" value={pendingCount} />
                    <Summary label="Confirmed" value={transactions.length - pendingCount} />
                </section>

                <div className="my-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <p className="text-xs text-zinc-500">{filtered.length} results</p>
                    <div className="grid gap-3 sm:grid-cols-[minmax(240px,1fr)_160px]">
                        <label className="text-xs text-zinc-500">Search ID, input, or address<input value={filter} onChange={event => setFilter(event.target.value)} className="mt-1 block w-full border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white" /></label>
                        <label className="text-xs text-zinc-500">Status<select value={status} onChange={event => setStatus(event.target.value)} className="mt-1 block w-full border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white"><option value="all">All</option><option value="confirmed">Confirmed</option><option value="unconfirmed">Unconfirmed</option></select></label>
                    </div>
                </div>

                <div className="divide-y divide-zinc-800 border-y border-zinc-800">
                    {filtered.length ? filtered.map(transaction => <TransactionRow key={transaction.id} transaction={transaction} />) : <p className="py-12 text-center text-sm text-zinc-500">No transactions match this view.</p>}
                </div>
            </div>
        </main>
    );
}

function TransactionRow({ transaction }) {
    return (
        <details className="py-4">
            <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3">
                <span className="min-w-0 break-all font-mono text-xs text-zinc-300">{transaction.id}</span>
                <span className="flex gap-4 text-xs text-zinc-500"><span>{transaction.coinbase ? "Coinbase" : `${transaction.fee.toFixed(3)} BTC fee`}</span><span>{transaction.status}</span><span>{transaction.confirmations} conf.</span></span>
            </summary>
            <div className="mt-4 grid gap-5 border-l border-zinc-800 pl-4 sm:grid-cols-2">
                <div><h3 className="mb-2 text-xs uppercase text-zinc-500">Inputs</h3>{transaction.inputs.map((input, index) => <p key={`${input.txId}:${input.outputIndex}:${index}`} className="mb-2 break-all text-xs text-zinc-400">{input.address ?? input.txId} · {input.amount === null || input.amount === undefined ? "Coinbase" : `${input.amount.toFixed(3)} BTC`}</p>)}</div>
                <div><h3 className="mb-2 text-xs uppercase text-zinc-500">Outputs</h3>{transaction.outputs.map((output, index) => <p key={`${output.address}:${index}`} className="mb-2 flex justify-between gap-3 text-xs"><span className="break-all text-zinc-400">{output.address}</span><span className="shrink-0 font-mono">{output.amount.toFixed(3)} BTC</span></p>)}</div>
                <p className="text-xs text-zinc-500">{transaction.status === "confirmed" ? `Block #${transaction.blockHeight}` : "In mempool"}</p>
            </div>
        </details>
    );
}

function Summary({ label, value }) {
    return <div className="bg-black px-4 py-3"><p className="text-xs text-zinc-500">{label}</p><p className="mt-1 text-lg font-semibold">{value}</p></div>;
}
