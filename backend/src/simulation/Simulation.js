const SimulatedNode = require("../network/SimulatedNode");
const ChainManager = require("../blockchain/ChainManager");
const Block = require("../blockchain/Block");
const Miner = require("../blockchain/Miner");
const DifficultyAdjustment = require("../blockchain/DifficultyAdjustment");
const { Transaction } = require("../blockchain/Transaction");
const Wallet = require("../blockchain/Wallet");

class Simulation {
    constructor() {
        this.nodes = new Map();
        this.events = [];
        this.running = false;
        this.speed = 1;
        this.controls = {
            miningEnabled: true,
            transactionGeneration: false,
            blockPropagation: true,
            networkFailures: false
        };
        this.controlTimer = null;
        this.stepInProgress = false;
        this.generation = 0;
        this.difficulty = 4;
        this.blockReward = 50;
        this.halvingInterval = 10;
        this.difficultyAdjustmentInterval = 10;
        this.targetBlockTimeSeconds = 10;
        this.difficultyAdjuster = new DifficultyAdjustment({
            interval: this.difficultyAdjustmentInterval,
            targetBlockTimeSeconds: this.targetBlockTimeSeconds
        });
        this.lastDifficultyAdjustmentHeight = 0;
        this.miner = new Miner();
        this.miningState = null;
        this.miningControllers = new Map();
        this.totalMiningAttempts = 0;
        this.wallets = new Map();
        this.forkCount = 0;
        this.reorganizationCount = 0;
        this.recordedForks = new Set();
        this.recordedReorganizations = new Set();
        this.recordedHalvings = new Set();
        const faucetWallet = new Wallet({ walletId: "wallet-alice", name: "Alice", address: "Alice" });
        this.wallets.set(faucetWallet.walletId, faucetWallet);

        this.createDefaultNetwork();
    }

    createWallet(name = "Wallet") {
        if (typeof name !== "string" || !name.trim() || name.length > 32) {
            throw new Error("Wallet name must be 1 to 32 characters");
        }
        const wallet = new Wallet({ name });
        this.wallets.set(wallet.walletId, wallet);
        return wallet;
    }

    getWallets() {
        const blockchain = this.getBestNode().blockchain;
        return Array.from(this.wallets.values(), wallet => {
            const utxos = blockchain.utxoSet.getUTXOsForAddress(wallet.address);
            return wallet.toPublicSummary(
                utxos.reduce((total, utxo) => total + utxo.amount, 0),
                utxos.length
            );
        });
    }

    fundWallet(walletId, amount = 10) {
        const wallet = this.wallets.get(walletId);
        if (!wallet) throw new Error("Wallet not found");
        if (wallet.address === "Alice") throw new Error("The faucet wallet is already funded");
        return this.createTransaction({ from: "Alice", to: wallet.address, amount });
    }

    createDefaultNetwork() {
        this.addNode("node-1", "Miner 1", 0.4, "Miner 1", "miner");
        this.addNode("node-2", "Miner 2", 0.3, "Miner 2", "miner");
        this.addNode("node-3", "Miner 3", 0.2, "Miner 3", "miner");
        this.addNode("node-4", "Miner 4", 0.1, "Miner 4", "miner");
        this.addNode("node-5", "Validator 1", 0, "Validator 1", "validator");
        this.addNode("node-6", "Validator 2", 0, "Validator 2", "validator");
        this.addNode("node-7", "Validator 3", 0, "Validator 3", "validator");
        this.addNode("node-8", "Light Node 1", 0, "Light Node 1", "light-node");

        this.connectNodes("node-1", "node-2");
        this.connectNodes("node-2", "node-3");
        this.connectNodes("node-3", "node-4");
        this.connectNodes("node-1", "node-4");
        this.connectNodes("node-1", "node-5");
        this.connectNodes("node-2", "node-5");
        this.connectNodes("node-2", "node-6");
        this.connectNodes("node-3", "node-6");
        this.connectNodes("node-3", "node-7");
        this.connectNodes("node-4", "node-7");
        this.connectNodes("node-5", "node-8");
        this.connectNodes("node-6", "node-8");
        this.connectNodes("node-7", "node-8");
    }

    addNode(
        id,
        name,
        hashRate,
        address,
        role = "miner",
        initialBlockReward = this.blockReward,
        halvingInterval = this.halvingInterval
    ) {
        const node =
            new SimulatedNode({
                id,
                name,
                hashRate,
                address,
                role,
                initialBlockReward,
                halvingInterval
            });

        this.nodes.set(id, node);

        return node;
    }

    connectNodes(a, b) {
        const nodeA = this.nodes.get(a);
        const nodeB = this.nodes.get(b);

        if (
            !nodeA ||
            !nodeB
        ) {
            throw new Error("Node does not exist");
        }

        nodeA.connect(nodeB);
        nodeB.connect(nodeA);
        this.events.push({ type: "NODE_CONNECTED", nodeId: a, peerId: b, timestamp: Date.now() });
    }

    setNodeOnline(nodeId, online) {
        const node = this.nodes.get(nodeId);
        if (!node) throw new Error("Node not found");

        node.online = online;
        if (!online) {
            node.mining = false;
            this.miningControllers.get(nodeId)?.abort();
        }
        this.events.push({
            type: online ? "NODE_CONNECTED" : "NODE_DISCONNECTED",
            nodeId,
            timestamp: Date.now()
        });

        if (online) {
            const bestPeer = Array.from(this.nodes.values())
                .filter(candidate => candidate.id !== nodeId && candidate.online)
                .sort((left, right) => right.blockchain.totalWork - left.blockchain.totalWork)[0];
            const canonicalBlocks = bestPeer?.blockchain.getBlocks() ?? node.blockchain.getBlocks();
            const commonAncestor = ChainManager.findCommonAncestor(node.blockchain.getBlocks(), canonicalBlocks);
            for (const block of canonicalBlocks.slice(commonAncestor.height + 1)) {
                const acceptance = node.addBlock(block);
                if (!acceptance) break;
                this.recordChainEvents(nodeId, block, acceptance);
            }
            this.events.push({ type: "CHAIN_UPDATED", nodeId, height: node.blockchain.getHeight(), timestamp: Date.now() });
        }

        return node.getState();
    }

    getBestNode() {
        const nodes = Array.from(this.nodes.values()).filter(node => node.online);
        let best = null;

        for (const node of nodes.length ? nodes : this.nodes.values()) {
            if (!best) {
                best = node;
                continue;
            }

            if (node.blockchain.totalWork > best.blockchain.totalWork) {
                best = node;
            }
        }

        return best;
    }

    getNetworkTip() {
        return this.getBestNode().blockchain.getLatestBlock();
    }

    setDifficulty(difficulty) {
        if (!Number.isInteger(difficulty) || difficulty < 1 || difficulty > 6) {
            throw new Error("Difficulty must be an integer from 1 to 6");
        }
        this.difficulty = difficulty;
        this.events.push({ type: "DIFFICULTY_UPDATED", difficulty, timestamp: Date.now() });
        return this.difficulty;
    }

    startSimulation() {
        if (this.running) return this.getState();
        this.running = true;
        this.events.push({ type: "SIMULATION_STARTED", timestamp: Date.now() });
        this.scheduleSimulationStep();
        return this.getState();
    }

    pauseSimulation() {
        this.running = false;
        if (this.controlTimer) clearTimeout(this.controlTimer);
        this.controlTimer = null;
        this.events.push({ type: "SIMULATION_PAUSED", timestamp: Date.now() });
        return this.getState();
    }

    scheduleSimulationStep() {
        if (!this.running) return;
        this.controlTimer = setTimeout(async () => {
            try {
                await this.stepSimulation();
            } catch (error) {
                this.events.push({ type: "SIMULATION_ERROR", message: error.message, timestamp: Date.now() });
            } finally {
                this.scheduleSimulationStep();
            }
        }, Math.max(250, 5000 / this.speed));
    }

    async stepSimulation() {
        if (this.stepInProgress) throw new Error("A simulation step is already running");
        if (!this.controls.miningEnabled) return { status: "mining-disabled" };
        const miners = Array.from(this.nodes.values()).filter(node =>
            node.online && node.role === "miner" && !node.mining && Number.isFinite(node.miningPower) && node.miningPower > 0
        );
        const totalPower = miners.reduce((total, node) => total + node.miningPower, 0);
        let draw = Math.random() * totalPower;
        const miner = miners.find(node => {
            draw -= node.miningPower;
            return draw < 0;
        });
        if (!miner) throw new Error("No online miner is available");

        this.stepInProgress = true;
        try {
            if (this.controls.networkFailures && Math.random() < 0.08) {
                const candidates = Array.from(this.nodes.values()).filter(node => node.id !== miner.id);
                if (candidates.length) {
                    const node = candidates[Math.floor(Math.random() * candidates.length)];
                    this.setNodeOnline(node.id, !node.online);
                }
            }
            if (this.controls.transactionGeneration && Math.random() < 0.5) {
                const recipients = Array.from(this.wallets.values()).filter(wallet => wallet.address !== "Alice");
                if (recipients.length) {
                    try {
                        const recipient = recipients[Math.floor(Math.random() * recipients.length)];
                        this.createTransaction({ from: "Alice", to: recipient.address, amount: 0.1 });
                    } catch {}
                }
            }
            return await this.mineBlock(miner.id);
        } finally {
            this.stepInProgress = false;
        }
    }

    setSpeed(speed) {
        if (![0.25, 0.5, 1, 2, 5, 10].includes(speed)) throw new Error("Unsupported simulation speed");
        this.speed = speed;
        this.events.push({ type: "SIMULATION_SPEED_UPDATED", speed, timestamp: Date.now() });
        if (this.running) {
            clearTimeout(this.controlTimer);
            this.scheduleSimulationStep();
        }
        return this.speed;
    }

    setControls(changes) {
        for (const key of Object.keys(this.controls)) {
            if (typeof changes[key] === "boolean") this.controls[key] = changes[key];
        }
        this.events.push({ type: "SIMULATION_CONTROLS_UPDATED", controls: { ...this.controls }, timestamp: Date.now() });
        return { ...this.controls };
    }

    reset() {
        if (this.controlTimer) clearTimeout(this.controlTimer);
        this.generation++;
        for (const controller of this.miningControllers.values()) controller.abort();
        this.miningControllers.clear();
        this.controlTimer = null;
        this.running = false;
        this.stepInProgress = false;
        this.nodes = new Map();
        this.events = [];
        this.speed = 1;
        this.controls = { miningEnabled: true, transactionGeneration: false, blockPropagation: true, networkFailures: false };
        this.difficulty = 4;
        this.blockReward = 50;
        this.halvingInterval = 10;
        this.difficultyAdjustmentInterval = 10;
        this.difficultyAdjuster.interval = 10;
        this.lastDifficultyAdjustmentHeight = 0;
        this.miningState = null;
        this.totalMiningAttempts = 0;
        this.forkCount = 0;
        this.reorganizationCount = 0;
        this.recordedForks.clear();
        this.recordedReorganizations.clear();
        this.recordedHalvings.clear();
        this.wallets = new Map();
        const faucetWallet = new Wallet({ walletId: "wallet-alice", name: "Alice", address: "Alice" });
        this.wallets.set(faucetWallet.walletId, faucetWallet);
        this.createDefaultNetwork();
        this.events.push({ type: "SIMULATION_RESET", timestamp: Date.now() });
        return this.getState();
    }

    setDifficultyAdjustmentInterval(interval) {
        if (![10, 50, 100, 2016].includes(interval)) {
            throw new Error("Difficulty adjustment interval must be 10, 50, 100, or 2016 blocks");
        }
        this.difficultyAdjustmentInterval = interval;
        this.difficultyAdjuster.interval = interval;
        this.events.push({ type: "DIFFICULTY_INTERVAL_UPDATED", interval, timestamp: Date.now() });
        return interval;
    }

    setRewardSchedule(initialBlockReward, halvingInterval) {
        if (this.getNetworkTip().height > 0) throw new Error("Reset the simulation before changing the reward schedule");
        if (!Number.isFinite(initialBlockReward) || initialBlockReward <= 0) throw new Error("Initial reward must be positive");
        if (!Number.isInteger(halvingInterval) || halvingInterval < 2) throw new Error("Halving interval must be at least 2 blocks");

        this.blockReward = initialBlockReward;
        this.halvingInterval = halvingInterval;
        for (const node of this.nodes.values()) {
            node.blockchain.initialBlockReward = initialBlockReward;
            node.blockchain.halvingInterval = halvingInterval;
            node.chainManager.initialBlockReward = initialBlockReward;
            node.chainManager.halvingInterval = halvingInterval;
        }
        this.events.push({ type: "REWARD_SCHEDULE_UPDATED", initialBlockReward, halvingInterval, timestamp: Date.now() });
        return { initialBlockReward, halvingInterval };
    }

    getCurrentReward(height = this.getNetworkTip().height + 1) {
        return this.blockReward / 2 ** Math.floor(height / this.halvingInterval);
    }

    getTotalSimulatedIssuance() {
        const blocks = this.getBestNode().blockchain.getBlocks();
        return 50 + blocks.slice(1).reduce((total, block) => total + this.getCurrentReward(block.height), 0);
    }

    createTransaction({ from, to, amount }) {
        if (
            typeof from !== "string" || !from.trim() ||
            typeof to !== "string" || !to.trim() ||
            from.length > 128 || to.length > 128 ||
            !Number.isFinite(amount) || amount <= 0
        ) {
            throw new Error("Transaction requires valid sender, recipient, and positive amount");
        }

        const sourceNode = Array.from(this.nodes.values()).find(node => node.online);
        if (!sourceNode) throw new Error("No online nodes are available");
        const wallet = Array.from(this.wallets.values()).find(candidate => candidate.address === from);
        if (!wallet) throw new Error("Sender address is not associated with a wallet");

        const utxos = sourceNode.blockchain.utxoSet.getUTXOsForAddress(from);

        let selected = [];
        let total = 0;

        for (const utxo of utxos) {
            selected.push(utxo);
            total += utxo.amount;

            if (
                total >= amount
            ) {
                break;
            }
        }

        if (
            total < amount
        ) {
            throw new Error(`Insufficient funds for ${from}`);
        }

        const fee = 0.001;

        if (
            total <
            amount + fee
        ) {
            throw new Error("Insufficient funds for amount + fee");
        }

        const outputs = [
            {
                address: to,
                amount
            }
        ];

        const change = total - amount - fee;

        if (change > 0) {
            outputs.push({
                address: from,
                amount: change
            });
        }

        const transaction = new Transaction({
            inputs: selected.map(utxo => {
                const input = { txId: utxo.txId, outputIndex: utxo.outputIndex };
                const message = JSON.stringify({ input, outputs, fee });
                return {
                    ...input,
                    signature: wallet.createSimulatedSignature(message),
                    publicKey: wallet.publicKey
                };
            }),
            outputs,
            fee
        });

        if (!this.broadcastTransaction(sourceNode.id, transaction)) {
            throw new Error("Transaction was rejected by all nodes");
        }

        this.events.push({
            type: "TRANSACTION_CREATED",
            transactionId: transaction.id,
            from,
            to,
            amount,
            fee,
            timestamp: Date.now()
        });

        return transaction;
    }

    broadcastTransaction(originId, transaction) {
        const visited = new Set();
        const queue = [{ nodeId: originId, from: null }];
        let acceptedCount = 0;

        while (
            queue.length
        ) {
            const { nodeId: currentId, from } = queue.shift();

            if (visited.has(currentId)) {
                continue;
            }

            visited.add(currentId);

            const node = this.nodes.get(currentId);

            if (!node || !node.online) {
                continue;
            }

            if (node.addTransaction(transaction).accepted) {
                acceptedCount++;
                if (from) this.events.push({
                    type: "TRANSACTION_RECEIVED",
                    from,
                    nodeId: currentId,
                    transactionId: transaction.id,
                    timestamp: Date.now()
                });
            }

            for (const peerId of node.peers) {
                if (!visited.has(peerId)) {
                    queue.push({ nodeId: peerId, from: currentId });
                }
            }
        }

        return acceptedCount;
    }

    async mineBlock(nodeId, parentHash = null) {
        const generation = this.generation;
        const miner = this.nodes.get(nodeId);

        if (!miner) {
            throw new Error("Mining node not found");
        }
        if (!miner.online || miner.role !== "miner") throw new Error("Only online miner nodes can mine");
        if (miner.mining) throw new Error("This node is already mining");

        const tip = parentHash
            ? miner.chainManager.blocks.get(parentHash)
            : miner.blockchain.getLatestBlock();
        if (!tip) throw new Error("Selected branch tip was not found");
        const branchBlockchain = miner.chainManager.getBlockchainAt(tip.hash);
        const candidateUTXOs = branchBlockchain.utxoSet.clone();
        const spentInBlock = new Set();

        /*
         * Remove transactions that
         * are no longer valid against
         * the miner's UTXO set.
         */
        const validTransactions = [];
        let totalFees = 0;

        for (const transaction of miner.mempool.selectTransactionsForBlock()) {
            const validation = branchBlockchain.validateTransaction(transaction, candidateUTXOs, spentInBlock);
            if (validation.valid) {
                validTransactions.push(transaction);
                totalFees += validation.fee;
                for (const input of transaction.inputs) {
                    spentInBlock.add(`${input.txId}:${input.outputIndex}`);
                    candidateUTXOs.removeUTXO(input.txId, input.outputIndex);
                }
                transaction.outputs.forEach((output, index) => candidateUTXOs.addUTXO(transaction.id, index, output));
            }
        }

        const coinbase = Transaction.createCoinbase(miner.address, branchBlockchain.getBlockSubsidy(tip.height + 1) + totalFees);

        const transactions = [
            coinbase,
            ...validTransactions
        ];

        const block = new Block({
            height: tip.height + 1,
            previousHash: tip.hash,
            transactions,
            difficulty: this.difficulty
        });

        miner.mining = true;
        const controller = new AbortController();
        this.miningControllers.set(nodeId, controller);
        this.events.push({ type: "BLOCK_MINING_STARTED", nodeId, height: block.height, timestamp: Date.now() });
        let miningState = {
            status: "mining",
            nodeId,
            height: block.height,
            previousHash: block.previousHash,
            merkleRoot: block.merkleRoot,
            timestamp: block.timestamp,
            difficulty: this.difficulty,
            target: this.miner.calculateTarget(this.difficulty),
            nonce: block.nonce,
            currentHash: block.hash,
            hashAttempts: 0,
            hashRate: 0,
            elapsedTime: 0
        };
        this.miningState = miningState;

        let result;
        try {
            result = await this.miner.mineBlock(block, {
                difficulty: this.difficulty,
                signal: controller.signal,
                onProgress: progress => {
                    miningState = { ...miningState, ...progress };
                    if (this.miningState?.nodeId === nodeId) this.miningState = miningState;
                    this.events.push({
                        type: "MINING_PROGRESS",
                        nodeId,
                        height: block.height,
                        ...progress,
                        timestamp: Date.now()
                    });
                }
            });
        } catch (error) {
            if (generation === this.generation && this.miningState?.nodeId === nodeId) {
                this.miningState = { ...miningState, status: "failed", error: error.message };
            }
            throw error;
        } finally {
            miner.mining = false;
            if (this.miningControllers.get(nodeId) === controller) this.miningControllers.delete(nodeId);
        }

        if (generation !== this.generation) throw new Error("Simulation was reset during mining");

        miningState = {
            ...miningState,
            status: "found",
            nonce: result.block.nonce,
            currentHash: result.successfulHash,
            hashAttempts: result.attempts,
            hashRate: result.hashRate,
            elapsedTime: result.elapsedMs,
            target: result.target
        };
        if (this.miningState?.nodeId === nodeId) this.miningState = miningState;

        /*
         * Accept locally.
         */
        const acceptance = miner.acceptBlock(result.block);
        if (!acceptance) throw new Error("Mined block was rejected by the local chain manager");
        this.recordChainEvents(nodeId, result.block, acceptance);

        miner.stats.blocksMined++;
        miner.stats.miningAttempts += result.attempts;
        this.totalMiningAttempts += result.attempts;

        /*
         * Propagate.
         */
        if (this.controls.blockPropagation) {
            this.broadcastBlock(nodeId, result.block);
        } else {
            this.events.push({ type: "BLOCK_PROPAGATION_PAUSED", nodeId, blockHash: result.block.hash, height: result.block.height, timestamp: Date.now() });
        }

        this.events.push({
            type: "BLOCK_MINED",
            nodeId,
            blockHash: result.block.hash,
            height: result.block.height,
            transactions: result.block.transactions.length,
            attempts: result.attempts,
            elapsedMs: result.elapsedMs,
            hashRate: result.hashRate,
            target: result.target,
            timestamp: Date.now()
        });

        return result;
    }

    broadcastBlock(originId, block) {
        const visited = new Set();
        const queue = [{ nodeId: originId, from: null }];

        while (
            queue.length
        ) {
            const { nodeId: currentId, from } = queue.shift();

            if (visited.has(currentId)) {
                continue;
            }

            visited.add(currentId);

            const node = this.nodes.get(currentId);

            if (!node || !node.online) {
                continue;
            }

            if (
                currentId !== originId
            ) {
                const acceptance = node.addBlock(block);

                if (acceptance) {
                    this.recordChainEvents(currentId, block, acceptance);
                    this.events.push({
                            type: "BLOCK_RECEIVED",
                        from,
                            nodeId: currentId,
                            blockHash: block.hash,
                            height: block.height,
                            timestamp: Date.now()
                    });
                    this.events.push({
                        type: "BLOCK_VALIDATED",
                        nodeId: currentId,
                        blockHash: block.hash,
                        height: block.height,
                        timestamp: Date.now()
                    });
                }
            }

            for (const peerId of node.peers) {
                if (!visited.has(peerId)) {
                    queue.push({ nodeId: peerId, from: currentId });
                }
            }
        }
    }

    getState() {
        const bestNode = this.getBestNode();
        const tip = bestNode.blockchain.getLatestBlock();

        return {
            running: this.running,
            speed: this.speed,
            controls: { ...this.controls },
            difficulty: this.difficulty,
            blockReward: this.getCurrentReward(tip.height + 1),
            initialBlockReward: this.blockReward,
            forkCount: this.forkCount,
            reorganizationCount: this.reorganizationCount,
            networkHeight: tip.height,
            networkTip: tip.hash,
            networkTipShort: `${tip.hash.slice(0, 16)}...`,
            mining: this.miningState,
            nodes: Array.from(this.nodes.values()).map(node => node.getState()),
            events: this.events.slice(-50),
            halvingInterval: this.halvingInterval,
            nextHalvingHeight: (Math.floor(tip.height / this.halvingInterval) + 1) * this.halvingInterval,
            blocksUntilHalving: Math.max(0, (Math.floor(tip.height / this.halvingInterval) + 1) * this.halvingInterval - tip.height - 1),
            difficultyAdjustmentInterval: this.difficultyAdjustmentInterval,
            targetBlockTimeSeconds: this.targetBlockTimeSeconds,
            totalSimulatedIssuance: this.getTotalSimulatedIssuance(),
            totalMiningAttempts: this.totalMiningAttempts
        };
    }

    recordChainEvents(nodeId, block, acceptance) {
        if (acceptance.canonicalChanged && block.height > 0 && block.height % this.halvingInterval === 0) {
            const halvingNumber = block.height / this.halvingInterval;
            if (!this.recordedHalvings.has(halvingNumber)) {
                this.recordedHalvings.add(halvingNumber);
                this.events.push({
                    type: "BLOCK_REWARD_HALVED",
                    nodeId,
                    height: block.height,
                    halvingNumber,
                    previousReward: this.getCurrentReward(block.height - 1),
                    newReward: this.getCurrentReward(block.height),
                    timestamp: Date.now()
                });
            }
        }

        if (
            acceptance.canonicalChanged &&
            block.height >= this.difficultyAdjustmentInterval + 1 &&
            (block.height - 1) % this.difficultyAdjustmentInterval === 0 &&
            block.height > this.lastDifficultyAdjustmentHeight
        ) {
            this.lastDifficultyAdjustmentHeight = block.height;
            const adjustment = this.difficultyAdjuster.adjust(acceptance.chain, this.difficulty);
            if (adjustment.adjusted) {
                this.difficulty = adjustment.difficulty;
                this.events.push({ type: "DIFFICULTY_ADJUSTED", height: block.height, ...adjustment, timestamp: Date.now() });
            }
        }

        if (acceptance.forkDetected) {
            const forkKey = `${block.previousHash}:${block.height}`;
            if (!this.recordedForks.has(forkKey)) {
                this.recordedForks.add(forkKey);
                this.forkCount++;
                this.events.push({
                    type: "FORK_DETECTED",
                    nodeId,
                    forkPoint: acceptance.forkPoint.height,
                    height: block.height,
                    blockHash: block.hash,
                    timestamp: Date.now()
                });
            }
        }

        if (acceptance.reorganization) {
            if (!this.recordedReorganizations.has(block.hash)) {
                this.recordedReorganizations.add(block.hash);
                this.reorganizationCount++;
                this.events.push({
                    type: "REORG_STARTED",
                    nodeId,
                    forkPoint: acceptance.forkPoint.height,
                    disconnected: acceptance.disconnected.map(item => item.hash),
                    connected: acceptance.connected.map(item => item.hash),
                    timestamp: Date.now()
                });
                this.events.push({
                    type: "REORG_COMPLETED",
                    nodeId,
                    height: block.height,
                    cumulativeWork: acceptance.cumulativeWork,
                    timestamp: Date.now()
                });
            }
        }
    }
}

module.exports = Simulation;