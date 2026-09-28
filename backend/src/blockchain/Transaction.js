const crypto = require("crypto");
const TransactionInput = require("./TransactionInput");
const TransactionOutput = require("./TransactionOutput");

class Transaction {
    constructor({
        inputs = [],
        outputs = [],
        fee = 0,
        coinbase = false,
        timestamp = Date.now()
    }) {
        this.inputs = inputs.map(input => input instanceof TransactionInput ? input : new TransactionInput(input));
        this.outputs = outputs.map(output => output instanceof TransactionOutput ? output : new TransactionOutput(output));
        this.coinbase = coinbase;
        this.timestamp = timestamp;
        this.fee = fee;
        this.id = this.calculateTransactionHash();
    }

    serialize() {
        return JSON.stringify({
            coinbase: this.coinbase,
            fee: this.fee,
            inputs: this.inputs.map(input => ({
                txId: input.txId,
                outputIndex: input.outputIndex,
                signature: input.signature,
                publicKey: input.publicKey
            })),
            outputs: this.outputs.map(output => ({
                address: output.address,
                amount: output.amount
            })),
            timestamp: this.timestamp
        });
    }

    calculateTransactionHash() {
        return crypto.createHash("sha256").update(this.serialize()).digest("hex");
    }

    calculateHash() {
        return this.calculateTransactionHash();
    }

    calculateFee(utxoSet) {
        if (this.isCoinbase()) return 0;

        const inputValue = this.inputs.reduce((total, input) => {
            const utxo = utxoSet.getUTXO(input.txId, input.outputIndex);
            if (!utxo) throw new Error(`Referenced UTXO ${input.txId}:${input.outputIndex} does not exist`);
            return total + utxo.amount;
        }, 0);
        const outputValue = this.outputs.reduce((total, output) => total + output.amount, 0);

        return inputValue - outputValue;
    }

    validate(utxoSet, spentInBlock = new Set()) {
        return Transaction.validate(this, utxoSet, spentInBlock);
    }

    isCoinbase() {
        return this.coinbase;
    }

    static validate(transaction, utxoSet, spentInBlock = new Set()) {
        if (transaction.coinbase) {
            return { valid: false, reason: "Coinbase transactions are only valid as the first block transaction" };
        }
        if (!Array.isArray(transaction.inputs) || !Array.isArray(transaction.outputs)) {
            return { valid: false, reason: "Transaction inputs and outputs must be arrays" };
        }
        if (transaction.inputs.length > 100 || transaction.outputs.length > 100) {
            return { valid: false, reason: "Transaction exceeds the input or output limit" };
        }
        const serializedSize = Buffer.byteLength(transaction.serialize?.() ?? JSON.stringify(transaction), "utf8");
        if (serializedSize > 100_000) return { valid: false, reason: "Transaction exceeds the maximum size" };
        if (!transaction.inputs.length) return { valid: false, reason: "Transaction has no inputs" };
        if (!transaction.outputs.length) return { valid: false, reason: "Transaction has no outputs" };

        if (transaction.outputs.some(output =>
            !output || typeof output.address !== "string" || !output.address.trim() || output.address.length > 128 ||
            !Number.isFinite(output.amount) || output.amount <= 0
        )) {
            return { valid: false, reason: "Transaction outputs must have an address and positive finite amount" };
        }

        let inputValue = 0;
        const localSpent = new Set();

        for (const input of transaction.inputs) {
            if (!input || typeof input.txId !== "string" || !input.txId || input.txId.length > 128 || !Number.isInteger(input.outputIndex) || input.outputIndex < 0) {
                return { valid: false, reason: "Transaction input is malformed" };
            }

            const key = `${input.txId}:${input.outputIndex}`;
            if (localSpent.has(key)) return { valid: false, reason: "Duplicate input" };
            if (spentInBlock.has(key)) return { valid: false, reason: "Double spend detected" };
            localSpent.add(key);

            const utxo = utxoSet.getUTXO(input.txId, input.outputIndex);
            if (!utxo) return { valid: false, reason: "Referenced UTXO does not exist" };
            if (!Number.isFinite(utxo.amount) || utxo.amount <= 0) {
                return { valid: false, reason: "Referenced UTXO has an invalid amount" };
            }
            inputValue += utxo.amount;
        }

        const outputValue = transaction.outputs.reduce((total, output) => total + output.amount, 0);
        if (outputValue > inputValue) return { valid: false, reason: "Outputs exceed inputs" };

        const fee = inputValue - outputValue;
        if (!Number.isFinite(transaction.fee) || transaction.fee < 0 || Math.abs(fee - transaction.fee) > 1e-8) {
            return { valid: false, reason: "Declared transaction fee does not match inputs and outputs" };
        }

        return { valid: true, fee };
    }

    static createCoinbase(minerAddress, reward, extraData = "") {
        return new Transaction({
            inputs: [
                {
                    txId: "COINBASE",
                    outputIndex: -1
                }
            ],

            outputs: [
                {
                    address: minerAddress,
                    amount: reward
                }
            ],

            coinbase: true
        });
    }
}

module.exports = {
    Transaction,
    TransactionInput,
    TransactionOutput
};