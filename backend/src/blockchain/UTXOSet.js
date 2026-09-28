class UTXOSet {
    constructor() {
        this.utxos = new Map();
    }

    createKey(txId, outputIndex) {
        return `${txId}:${outputIndex}`;
    }

    addUTXO(txId, outputIndex, output) {
        if (!txId || !Number.isInteger(outputIndex) || outputIndex < 0) {
            throw new TypeError("A UTXO requires a transaction ID and non-negative output index");
        }

        if (typeof output?.address !== "string" || !output.address.trim() || output.address.length > 128 || !Number.isFinite(output.amount) || output.amount <= 0) {
            throw new TypeError("A UTXO requires an address and positive finite amount");
        }

        const key = this.createKey(txId, outputIndex);

        this.utxos.set(key, {
            txId,
            outputIndex,
            address: output.address,
            amount: output.amount,
            lockingCondition: output.lockingCondition ?? {
                type: "ADDRESS",
                address: output.address
            }
        });
    }

    removeUTXO(txId, outputIndex) {
        return this.utxos.delete(this.createKey(txId, outputIndex));
    }

    getUTXO(txId, outputIndex) {
        return this.utxos.get(this.createKey(txId, outputIndex));
    }

    hasUTXO(txId, outputIndex) {
        return this.utxos.has(this.createKey(txId, outputIndex));
    }

    getUTXOsForAddress(address) {
        return Array.from(this.utxos.values()).filter(utxo => utxo.address === address);
    }

    getBalance(address) {
        return this.getUTXOsForAddress(address).reduce((total, utxo) => total + utxo.amount, 0);
    }

    getAllUTXOs() {
        return Array.from(this.utxos.values());
    }

    add(txId, outputIndex, output) {
        return this.addUTXO(txId, outputIndex, output);
    }

    remove(txId, outputIndex) {
        return this.removeUTXO(txId, outputIndex);
    }

    get(txId, outputIndex) {
        return this.getUTXO(txId, outputIndex);
    }

    has(txId, outputIndex) {
        return this.hasUTXO(txId, outputIndex);
    }

    getByAddress(address) {
        return this.getUTXOsForAddress(address);
    }

    getAll() {
        return this.getAllUTXOs();
    }

    clone() {
        const copy = new UTXOSet();

        for (const utxo of this.utxos.values()) {
            copy.addUTXO(utxo.txId, utxo.outputIndex, {
                address: utxo.address,
                amount: utxo.amount,
                lockingCondition: { ...utxo.lockingCondition }
            });
        }

        return copy;
    }
}

module.exports = UTXOSet;