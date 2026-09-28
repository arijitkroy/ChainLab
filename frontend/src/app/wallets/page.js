"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import TransactionBuilder from "@/components/TransactionBuilder";
import { connectSimulationSocket, createWallet, fundWallet, getTransactions, getUTXOs, getWallets } from "@/lib/api";

export default function WalletsPage() {
    const [wallets, setWallets] = useState([]);
    const [selectedId, setSelectedId] = useState("wallet-alice");
    const [utxos, setUtxos] = useState([]);
    const [transactions, setTransactions] = useState([]);
    const [name, setName] = useState("");
    const [notice, setNotice] = useState("");
    const [error, setError] = useState("");
    const [refreshKey, setRefreshKey] = useState(0);

    useEffect(() => {
        let active = true;
        let knownHeight = null;

        async function refresh() {
            try {
                const [walletData, utxoData] = await Promise.all([getWallets(), getUTXOs()]);
                if (!active) return;
                setWallets(walletData.wallets);
                setUtxos(utxoData.utxos);
                setError("");
            } catch (fetchError) {
                if (active) setError(fetchError.message);
            }
        }

        const socket = connectSimulationSocket(snapshot => {
            const stateKey = `${snapshot.networkHeight}:${snapshot.nodes.reduce((total, node) => total + node.mempoolSize, 0)}`;
            if (stateKey !== knownHeight) {
                knownHeight = stateKey;
                refresh();
                setRefreshKey(key => key + 1);
            }
        });
        refresh();

        return () => {
            active = false;
            socket.close();
        };
    }, []);

    const selectedWallet = wallets.find(wallet => wallet.walletId === selectedId);
    const selectedAddress = selectedWallet?.address;

    useEffect(() => {
        let active = true;
        if (!selectedAddress) return () => { active = false; };

        getTransactions(selectedAddress)
            .then(data => {
                if (active) setTransactions(data.transactions);
            })
            .catch(fetchError => {
                if (active) setError(fetchError.message);
            });

        return () => {
            active = false;
        };
    }, [selectedAddress, refreshKey]);

    async function handleCreate(event) {
        event.preventDefault();
        setError("");
        try {
            const result = await createWallet(name || "Wallet");
            const walletData = await getWallets();
            setWallets(walletData.wallets);
            setSelectedId(result.wallet.walletId);
            setName("");
            setNotice("Wallet created. Its private key is retained by the in-memory simulator and is never returned.");
        } catch (createError) {
            setError(createError.message);
        }
    }

    async function handleFund() {
        if (!selectedWallet) return;
        setError("");
        try {
            await fundWallet(selectedWallet.walletId, 10);
            setNotice("10 BTC transfer entered the mempool. Mine a block to confirm it.");
            setRefreshKey(key => key + 1);
        } catch (fundError) {
            setError(fundError.message);
        }
    }

    const walletUtxos = utxos.filter(utxo => utxo.address === selectedWallet?.address && utxo.status === "unspent");

    return (
        <main className="min-h-screen bg-black text-white">
            <div className="mx-auto max-w-7xl px-6 py-8">
                <p className="text-sm text-zinc-500"><Link href="/" className="hover:text-white">Dashboard</Link> / Wallets</p>
                <h1 className="mt-2 text-2xl font-semibold">Simulated Wallets</h1>
                <p className="mt-1 text-sm text-zinc-500">Keys are generated securely for this in-memory lab. Signing is simulated, not Bitcoin ECDSA.</p>

                {error && <p role="alert" className="mt-5 border border-red-900 bg-red-950/30 px-4 py-3 text-sm text-red-300">{error}</p>}
                {notice && <p role="status" className="mt-5 border border-green-900 bg-green-950/20 px-4 py-3 text-sm text-green-300">{notice}</p>}

                <div className="mt-7 grid gap-8 lg:grid-cols-[minmax(240px,0.8fr)_minmax(0,1.6fr)]">
                    <section>
                        <h2 className="mb-3 text-base font-semibold">Wallet list</h2>
                        <div className="divide-y divide-zinc-800 border-y border-zinc-800">
                            {wallets.map(wallet => (
                                <button key={wallet.walletId} onClick={() => setSelectedId(wallet.walletId)} aria-pressed={selectedId === wallet.walletId} className={`w-full px-3 py-4 text-left hover:bg-zinc-900 ${selectedId === wallet.walletId ? "bg-zinc-900" : ""}`}>
                                    <span className="flex justify-between gap-3">
                                        <span className="font-medium">{wallet.name}</span>
                                        <span className="font-mono text-sm">{wallet.balance.toFixed(3)} BTC</span>
                                    </span>
                                    <span className="mt-1 block break-all font-mono text-xs text-zinc-500">{wallet.address}</span>
                                </button>
                            ))}
                        </div>
                        <form onSubmit={handleCreate} className="mt-5 flex gap-2">
                            <input value={name} onChange={event => setName(event.target.value)} placeholder="Wallet name" aria-label="Wallet name" className="min-w-0 flex-1 border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-zinc-500" />
                            <button className="border border-zinc-700 px-3 py-2 text-sm hover:bg-zinc-900">Create</button>
                        </form>
                    </section>

                    <section className="min-w-0">
                        {selectedWallet ? (
                            <>
                                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-zinc-800 pb-5">
                                    <div className="min-w-0">
                                        <p className="text-xs text-zinc-500">Selected wallet</p>
                                        <h2 className="mt-1 text-xl font-semibold">{selectedWallet.name}</h2>
                                        <p className="mt-2 break-all font-mono text-sm text-zinc-300">{selectedWallet.address}</p>
                                        <p className="mt-2 break-all font-mono text-xs text-zinc-600">Public key · {selectedWallet.publicKey}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs text-zinc-500">Balance</p>
                                        <p className="mt-1 text-2xl font-semibold">{selectedWallet.balance.toFixed(3)} BTC</p>
                                        <p className="mt-1 text-xs text-zinc-500">{selectedWallet.utxoCount} unspent outputs</p>
                                    </div>
                                </div>

                                {selectedWallet.address !== "Alice" && (
                                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 py-4">
                                        <p className="text-sm text-zinc-400">Request a 10 BTC transfer from the educational faucet.</p>
                                        <button onClick={handleFund} className="border border-zinc-700 px-3 py-2 text-sm hover:bg-zinc-900">Receive 10 BTC</button>
                                    </div>
                                )}

                                <div className="py-6">
                                    <TransactionBuilder key={selectedWallet.address} initialFrom={selectedWallet.address} onCreated={() => {
                                        setNotice("Transaction broadcast to the network mempool.");
                                        setRefreshKey(key => key + 1);
                                    }} />
                                </div>
                            </>
                        ) : <p className="py-12 text-sm text-zinc-500">Loading wallets...</p>}
                    </section>
                </div>

                <div className="mt-8 grid gap-10 lg:grid-cols-2">
                    <section>
                        <h2 className="mb-3 text-base font-semibold">Wallet UTXOs</h2>
                        <div className="divide-y divide-zinc-800 border-y border-zinc-800">
                            {walletUtxos.length ? walletUtxos.map(utxo => (
                                <div key={`${utxo.txId}:${utxo.outputIndex}`} className="flex flex-wrap justify-between gap-2 py-3 text-sm">
                                    <span className="font-mono text-xs text-zinc-500">{shortHash(utxo.txId)}:{utxo.outputIndex}</span>
                                    <span>{utxo.amount.toFixed(3)} BTC</span>
                                </div>
                            )) : <p className="py-5 text-sm text-zinc-500">No unspent outputs for this wallet.</p>}
                        </div>
                    </section>

                    <section>
                        <h2 className="mb-3 text-base font-semibold">Transaction history</h2>
                        <div className="divide-y divide-zinc-800 border-y border-zinc-800">
                            {transactions.length ? transactions.map(transaction => (
                                <WalletTransactionRow key={transaction.id} transaction={transaction} address={selectedWallet?.address} />
                            )) : <p className="py-5 text-sm text-zinc-500">No confirmed or pending transactions.</p>}
                        </div>
                    </section>
                </div>
            </div>
        </main>
    );
}

function WalletTransactionRow({ transaction, address }) {
    const received = transaction.outputs.filter(output => output.address === address).reduce((total, output) => total + output.amount, 0);
    const sent = transaction.inputs.filter(input => input.address === address).reduce((total, input) => total + (input.amount ?? 0), 0);
    const net = received - sent;

    return (
        <div className="flex min-w-0 justify-between gap-4 py-3">
            <span className="min-w-0">
                <span className="block break-all font-mono text-xs text-zinc-400">{shortHash(transaction.id)}</span>
                <span className="mt-1 block text-xs text-zinc-600">{transaction.status} · {transaction.blockHeight === null ? "Pending" : `Block #${transaction.blockHeight}`}</span>
            </span>
            <span className={`shrink-0 text-sm ${net >= 0 ? "text-green-400" : "text-zinc-300"}`}>{net >= 0 ? "+" : ""}{net.toFixed(3)} BTC net</span>
        </div>
    );
}

function shortHash(hash) {
    return hash.length > 24 ? `${hash.slice(0, 14)}...${hash.slice(-6)}` : hash;
}
