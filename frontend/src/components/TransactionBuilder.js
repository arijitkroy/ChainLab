"use client";

import { useEffect, useState } from "react";
import { createTransaction, getWallets } from "@/lib/api";

export default function TransactionBuilder({ onCreated, initialFrom = "Alice" }) {
    const [from, setFrom] = useState(initialFrom);
    const [to, setTo] = useState("Bob");
    const [amount, setAmount] = useState("1");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [wallets, setWallets] = useState([]);

    useEffect(() => {
        let active = true;
        getWallets()
            .then(data => {
                if (!active) return;
                setWallets(data.wallets);
                setFrom(current => data.wallets.some(wallet => wallet.address === current)
                    ? current
                    : data.wallets[0]?.address ?? initialFrom
                );
            })
            .catch(fetchError => {
                if (active) setError(fetchError.message);
            });

        return () => {
            active = false;
        };
    }, [initialFrom]);

    async function submit(event) {
        event.preventDefault();

        setLoading(true);
        setError("");

        try {
            const data = await createTransaction({ from, to, amount: Number(amount) });
            onCreated?.(data.transaction);
            setAmount("1");
        } catch (error) {
            setError(error.message);
        } finally {
            setLoading(false);
        }
    }

    return (
        <form onSubmit={submit} className="border border-zinc-800 bg-zinc-950 rounded-xl p-6">
            <div className="mb-5">
                <h2 className="text-lg font-semibold">Create Transaction</h2>
                <p className="text-sm text-zinc-500 mt-1">Create and broadcast a UTXO transaction.</p>
            </div>

            <div className="space-y-4">
                <label className="block">
                    <span className="text-sm text-zinc-500">From wallet</span>
                    {wallets.length ? (
                        <select value={from} onChange={event => setFrom(event.target.value)} className="mt-2 w-full rounded-lg border border-zinc-800 bg-black px-3 py-2.5 text-sm outline-none focus:border-zinc-500">
                            {wallets.map(wallet => (
                                <option key={wallet.walletId} value={wallet.address}>
                                    {wallet.name} · {wallet.balance.toFixed(3)} BTC
                                </option>
                            ))}
                        </select>
                    ) : <span className="mt-2 block text-sm text-zinc-600">Loading wallets...</span>}
                </label>
                <Field label="To" value={to} onChange={setTo} />
                <Field label="Amount" type="number" step="0.001" value={amount} onChange={setAmount} />
            </div>

            <p className="mt-4 text-xs text-zinc-600">Uses simulated signatures, not Bitcoin ECDSA.</p>

            {error && (
                <div className="mt-4 rounded-lg border border-red-900 bg-red-950/30 p-3 text-sm text-red-400">
                    {error}
                </div>
            )}

            <button disabled={loading} className="mt-5 w-full rounded-lg bg-white text-black py-2.5 font-medium disabled:opacity-50">
                {loading
                    ? "Broadcasting..."
                    : "Broadcast Transaction"}
            </button>
        </form>
    );
}

function Field({ label, value, onChange, type = "text", step }) {
    return (
        <label className="block">
            <span className="text-sm text-zinc-500">{label}</span>

            <input type={type} step={step} value={value} onChange={event => onChange(event.target.value)} className="mt-2 w-full rounded-lg border border-zinc-800 bg-black px-3 py-2.5 text-sm outline-none focus:border-zinc-500" />
        </label>
    );
}