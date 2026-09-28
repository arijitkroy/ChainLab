class TransactionInput {
    constructor({ txId, outputIndex, signature = null, publicKey = null }) {
        this.txId = txId;
        this.outputIndex = outputIndex;
        this.signature = signature;
        this.publicKey = publicKey;
    }
}

module.exports = TransactionInput;
