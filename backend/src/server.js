const express = require("express");
const cors = require("cors");
const { WebSocketServer } = require("ws");
const Simulation = require("./simulation/Simulation");
const MiningRace = require("./simulation/MiningRace");
const DoubleSpendScenario = require("./simulation/DoubleSpendScenario");
const MajorityAttackScenario = require("./simulation/MajorityAttackScenario");
const SelfishMiningScenario = require("./simulation/SelfishMiningScenario");
const MerkleTree = require("./blockchain/MerkleTree");

const simulation = new Simulation();
const expressApp = express();
const websocketServer = new WebSocketServer({ noServer: true, maxPayload: 65536 });
const websocketRoutes = new Map();

expressApp.use(cors());
expressApp.use(express.json({ limit: "1mb" }));

function sendHttpPayload(response, payload) {
    const normalized = payload?.success === false && typeof payload.error === "string"
        ? errorResponse(new Error(payload.error))
        : payload;
    return response.json(normalized);
}

function registerHttpRoute(method, path, handler) {
    expressApp[method](path, async (request, response) => {
        const reply = {
            code(statusCode) {
                response.status(statusCode);
                return this;
            },
            send(payload) {
                return sendHttpPayload(response, payload);
            }
        };

        try {
            const result = await handler(request, reply);
            if (!response.headersSent) sendHttpPayload(response, result ?? {});
        } catch (error) {
            const statusCode = error.statusCode && error.statusCode < 500 ? error.statusCode : 500;
            if (statusCode === 500) console.error(error);
            const safeError = statusCode === 500 ? new Error("Internal server error") : error;
            response.status(statusCode).json(errorResponse(safeError, statusCode === 500 ? "INTERNAL_ERROR" : "INVALID_REQUEST"));
        }
    });
}

const app = {
    get(path, optionsOrHandler, handler) {
        if (typeof optionsOrHandler === "function") {
            registerHttpRoute("get", path, optionsOrHandler);
        } else if (optionsOrHandler?.websocket) {
            websocketRoutes.set(path, handler);
        }
    },
    post(path, handler) {
        registerHttpRoute("post", path, handler);
    }
};

function errorResponse(error, fallbackCode = "INVALID_REQUEST") {
        const message = error instanceof Error ? error.message : String(error);
        const code = /insufficient funds/i.test(message)
                ? "INSUFFICIENT_FUNDS"
                : /double spend|duplicate input|already spends/i.test(message)
                    ? "DOUBLE_SPEND"
                    : /node.*offline|no online/i.test(message)
                        ? "NODE_OFFLINE"
                        : /wallet/i.test(message)
                            ? "INVALID_WALLET"
                            : /mempool|rejected by all nodes/i.test(message)
                                ? "MEMPOOL_REJECTED"
                                : /block|proof-of-work|merkle/i.test(message)
                                    ? "INVALID_BLOCK"
                                    : fallbackCode;
        return { success: false, error: { code, message } };
}

function getBlockchainExplorerData() {
    const blockchain = simulation.getBestNode().blockchain;
    const rawBlocks = blockchain.getBlocks();
    const outputHistory = new Map([
        ["GENESIS:0", { address: "Alice", amount: 50 }]
    ]);
    const nodeNames = new Map(
        Array.from(simulation.nodes.values(), node => [node.address, node.name])
    );

    const blocks = rawBlocks.map(block => {
        let fees = 0;
        const transactions = block.transactions.map(transaction => {
            const inputs = transaction.inputs.map(input => {
                const previousOutput = outputHistory.get(`${input.txId}:${input.outputIndex}`);

                return {
                    ...input,
                    address: previousOutput?.address ?? null,
                    amount: previousOutput?.amount ?? null
                };
            });
            const outputs = transaction.outputs.map((output, outputIndex) => ({
                ...output,
                outputIndex
            }));
            const inputValue = inputs.reduce((sum, input) => sum + (input.amount ?? 0), 0);
            const outputValue = outputs.reduce((sum, output) => sum + output.amount, 0);
            const fee = transaction.coinbase ? 0 : Math.max(0, inputValue - outputValue);

            fees += fee;
            outputs.forEach(output => {
                outputHistory.set(`${transaction.id}:${output.outputIndex}`, output);
            });

            return { ...transaction, inputs, outputs, inputValue, outputValue, fee };
        });
        const coinbase = transactions.find(transaction => transaction.coinbase);
        const minerAddress = coinbase?.outputs[0]?.address ?? null;
        const coinbaseValue = coinbase?.outputValue ?? 0;

        return {
            ...block,
            transactions,
            transactionCount: transactions.length,
            fees,
            reward: Math.max(0, coinbaseValue - fees),
            miner: minerAddress ? nodeNames.get(minerAddress) ?? minerAddress : "Genesis",
            minerAddress,
            sizeBytes: Buffer.byteLength(JSON.stringify(block), "utf8"),
            confirmations: rawBlocks.at(-1).height - block.height + 1
        };
    });

    const latestBlock = blocks.at(-1);
    const minedBlocks = blocks.slice(1);
    const blockTimeIntervals = minedBlocks.slice(1).map((block, index) =>
        (block.timestamp - minedBlocks[index].timestamp) / 1000
    );

    return {
        summary: {
            chainHeight: latestBlock.height,
            latestBlock: { height: latestBlock.height, hash: latestBlock.hash },
            totalBlocks: blocks.length,
            totalTransactions: blocks.reduce((total, block) => total + block.transactionCount, 0),
            difficulty: latestBlock.difficulty,
            miningReward: simulation.getCurrentReward(),
            averageBlockTimeSeconds: blockTimeIntervals.length
                ? blockTimeIntervals.reduce((total, interval) => total + interval, 0) / blockTimeIntervals.length
                : null
        },
        blocks
    };
}

function getUTXOExplorerData(addressFilter = "") {
    const blockchain = simulation.getBestNode().blockchain;
    const blocks = blockchain.getBlocks();
    const genesis = blocks[0];
    const outputHistory = new Map([
        ["GENESIS:0", {
            txId: "GENESIS",
            outputIndex: 0,
            address: "Alice",
            amount: 50,
            lockingCondition: { type: "ADDRESS", address: "Alice" },
            createdAt: genesis.timestamp,
            createdAtHeight: 0,
            blockHash: genesis.hash,
            spentAt: null,
            spentAtHeight: null
        }]
    ]);

    for (const block of blocks) {
        for (const transaction of block.transactions) {
            if (!transaction.coinbase) {
                for (const input of transaction.inputs) {
                    const key = `${input.txId}:${input.outputIndex}`;
                    const previousOutput = outputHistory.get(key);

                    if (previousOutput) {
                        previousOutput.spentAt = block.timestamp;
                        previousOutput.spentAtHeight = block.height;
                    }
                }
            }

            transaction.outputs.forEach((output, outputIndex) => {
                outputHistory.set(`${transaction.id}:${outputIndex}`, {
                    txId: transaction.id,
                    outputIndex,
                    address: output.address,
                    amount: output.amount,
                    lockingCondition: output.lockingCondition ?? {
                        type: "ADDRESS",
                        address: output.address
                    },
                    createdAt: block.timestamp,
                    createdAtHeight: block.height,
                    blockHash: block.hash,
                    spentAt: null,
                    spentAtHeight: null
                });
            });
        }
    }

    const liveUTXOs = new Map(
        blockchain.getUTXOs().map(utxo => [`${utxo.txId}:${utxo.outputIndex}`, utxo])
    );
    const now = Date.now();
    const normalizedFilter = addressFilter.toLowerCase();
    const utxos = Array.from(outputHistory.entries(), ([key, output]) => {
        const liveUTXO = liveUTXOs.get(key);
        const ageEnd = liveUTXO ? now : output.spentAt ?? now;

        return {
            ...output,
            lockingCondition: liveUTXO?.lockingCondition ?? output.lockingCondition,
            status: liveUTXO ? "unspent" : "spent",
            ageSeconds: Math.max(0, (ageEnd - output.createdAt) / 1000)
        };
    }).filter(utxo => !normalizedFilter || utxo.address.toLowerCase().includes(normalizedFilter));

    const currentUTXOs = Array.from(liveUTXOs.values());

    return {
        summary: {
            utxoCount: liveUTXOs.size,
            spentOutputCount: outputHistory.size - liveUTXOs.size,
            totalOutputCount: outputHistory.size,
            totalSupply: currentUTXOs.reduce((total, utxo) => total + utxo.amount, 0)
        },
        utxos
    };
}

function enrichPendingTransaction(transaction) {
    const utxoSet = simulation.getBestNode().blockchain.utxoSet;
    const inputs = transaction.inputs.map(input => ({
        ...input,
        ...utxoSet.getUTXO(input.txId, input.outputIndex)
    }));
    const sizeBytes = Buffer.byteLength(transaction.serialize(), "utf8");

    return {
        ...transaction,
        inputs,
        sizeBytes,
        feeRate: sizeBytes ? transaction.fee / sizeBytes : 0,
        ageSeconds: Math.max(0, (Date.now() - transaction.timestamp) / 1000),
        status: "unconfirmed"
    };
}

function getTransactionHistory(addressFilter = "") {
    const address = addressFilter.toLowerCase();
    const { blocks } = getBlockchainExplorerData();
    const confirmed = blocks.flatMap(block => block.transactions.map(transaction => ({
        ...transaction,
        blockHeight: block.height,
        confirmations: block.confirmations,
        status: "confirmed"
    })));
    const pending = simulation.getBestNode().mempool.getTransactions().map(transaction => ({
        ...enrichPendingTransaction(transaction),
        blockHeight: null,
        confirmations: 0
    }));
    const transactions = [...pending, ...confirmed].filter(transaction =>
        !address || transaction.outputs.some(output => output.address.toLowerCase().includes(address)) ||
        transaction.inputs.some(input => input.address?.toLowerCase().includes(address))
    );
    return { transactions };
}

function start() {
    app.get("/", async () => ({
        name: "ChainLab",
        version: "1.0.0",
        status: "running"
    }));

    app.get("/api/simulation", async () => simulation.getState());

    app.post("/api/simulation/start", async () => ({ success: true, state: simulation.startSimulation() }));
    app.post("/api/simulation/pause", async () => ({ success: true, state: simulation.pauseSimulation() }));
    app.post("/api/simulation/reset", async () => ({ success: true, state: simulation.reset() }));

    app.post("/api/simulation/step", async (request, reply) => {
        try {
            return { success: true, result: await simulation.stepSimulation() };
        } catch (error) {
            return reply.code(400).send({ success: false, error: error.message });
        }
    });

    app.post("/api/simulation/speed", async (request, reply) => {
        try {
            return { success: true, speed: simulation.setSpeed(Number(request.body?.speed)) };
        } catch (error) {
            return reply.code(400).send({ success: false, error: error.message });
        }
    });

    app.post("/api/simulation/controls", async request => ({
        success: true,
        controls: simulation.setControls(request.body ?? {})
    }));

    app.get("/api/nodes", async () => ({ nodes: simulation.getState().nodes }));

    app.post("/api/race", async (request, reply) => {
        try {
            return new MiningRace().run(request.body?.miners, Number(request.body?.rounds ?? 1000));
        } catch (error) {
            return reply.code(400).send({ success: false, error: error.message });
        }
    });

    app.post("/api/attacks/double-spend/run", async (request, reply) => {
        try {
            return await new DoubleSpendScenario().run({
                amount: Number(request.body?.amount ?? 10),
                difficulty: Number(request.body?.difficulty ?? 1)
            });
        } catch (error) {
            return reply.code(400).send({ success: false, error: error.message });
        }
    });

    app.post("/api/attacks/51-percent/run", async (request, reply) => {
        try {
            return new MajorityAttackScenario().run({
                attackerHashPower: Number(request.body?.attackerHashPower ?? 51),
                rounds: Number(request.body?.rounds ?? 100)
            });
        } catch (error) {
            return reply.code(400).send({ success: false, error: error.message });
        }
    });

    app.post("/api/attacks/selfish-mining/run", async (request, reply) => {
        try {
            return new SelfishMiningScenario().run({
                attackerHashPower: Number(request.body?.attackerHashPower ?? 0.3),
                propagationAdvantage: Number(request.body?.propagationAdvantage ?? 0.5),
                rounds: Number(request.body?.rounds ?? 1000)
            });
        } catch (error) {
            return reply.code(400).send({ success: false, error: error.message });
        }
    });

    app.get("/api/forks", async () => {
        const manager = simulation.getBestNode().chainManager;
        return {
            forkCount: simulation.forkCount,
            reorganizationCount: simulation.reorganizationCount,
            canonicalTip: manager.canonicalTip,
            canonicalWork: manager.getCumulativeWork(manager.canonicalTip.hash),
            branches: manager.getForkData().branches.map(branch => ({
                tip: branch.tip,
                chain: branch.chain,
                forkPoint: branch.forkPoint,
                branchBlocks: branch.branchBlocks,
                chainHeight: branch.tip.height,
                cumulativeWork: branch.cumulativeWork,
                canonical: branch.canonical
            }))
        };
    });

    app.post("/api/forks/simulate", async (request, reply) => {
        const minerIds = request.body?.nodeIds ?? Array.from(simulation.nodes.values())
            .filter(node => node.online && node.role === "miner")
            .slice(0, 2)
            .map(node => node.id);
        if (!Array.isArray(minerIds) || minerIds.length < 2 || new Set(minerIds).size !== minerIds.length) {
            return reply.code(400).send({ success: false, error: "Choose at least two different miner nodes" });
        }

        try {
            const results = await Promise.all(minerIds.map(nodeId => simulation.mineBlock(nodeId)));
            return { success: true, blocks: results.map(result => result.block) };
        } catch (error) {
            return reply.code(400).send({ success: false, error: error.message });
        }
    });

    app.post("/api/forks/mine", async (request, reply) => {
        try {
            const { nodeId, parentHash } = request.body ?? {};
            const result = await simulation.mineBlock(nodeId, parentHash);
            return { success: true, result };
        } catch (error) {
            return reply.code(400).send({ success: false, error: error.message });
        }
    });

    app.post("/api/nodes", async (request, reply) => {
        try {
            const { name, role = "validator", hashRate = 0.1 } = request.body ?? {};
            if (typeof name !== "string" || !name.trim() || name.length > 64) throw new Error("Node name must be 1 to 64 characters");
            if (!["miner", "validator", "full-node", "light-node"].includes(role)) throw new Error("Invalid node role");
            const numericHashRate = Number(hashRate);
            if (!Number.isFinite(numericHashRate) || numericHashRate < 0 || numericHashRate > 100) throw new Error("Hash rate must be from 0 to 100");

            const id = `node-${Array.from(simulation.nodes.keys()).length + 1}`;
            const node = simulation.addNode(id, name.trim(), role === "miner" ? numericHashRate : 0, request.body?.address ?? name.trim(), role);
            const peer = Array.from(simulation.nodes.values()).find(candidate => candidate.id !== id && candidate.online);
            if (peer) {
                simulation.connectNodes(id, peer.id);
                simulation.setNodeOnline(id, true);
            }
            return { success: true, node: node.getState() };
        } catch (error) {
            return reply.code(400).send({ success: false, error: error.message });
        }
    });

    app.post("/api/nodes/:id/start", async (request, reply) => {
        try {
            return { success: true, node: simulation.setNodeOnline(request.params.id, true) };
        } catch (error) {
            return reply.code(404).send({ success: false, error: error.message });
        }
    });

    app.post("/api/nodes/:id/stop", async (request, reply) => {
        try {
            return { success: true, node: simulation.setNodeOnline(request.params.id, false) };
        } catch (error) {
            return reply.code(404).send({ success: false, error: error.message });
        }
    });

    app.post("/api/simulation/difficulty", async (request, reply) => {
        try {
            return { success: true, difficulty: simulation.setDifficulty(Number(request.body?.difficulty)) };
        } catch (error) {
            return reply.code(400).send({ success: false, error: error.message });
        }
    });

    app.post("/api/simulation/difficulty-interval", async (request, reply) => {
        try {
            const interval = simulation.setDifficultyAdjustmentInterval(Number(request.body?.interval));
            return { success: true, interval };
        } catch (error) {
            return reply.code(400).send({ success: false, error: error.message });
        }
    });

    app.post("/api/simulation/reward-schedule", async (request, reply) => {
        try {
            const schedule = simulation.setRewardSchedule(
                Number(request.body?.initialBlockReward),
                Number(request.body?.halvingInterval)
            );
            return { success: true, schedule };
        } catch (error) {
            return reply.code(400).send({ success: false, error: error.message });
        }
    });

    app.get("/api/wallets", async () => ({ wallets: simulation.getWallets() }));

    app.get("/api/wallets/:walletId", async (request, reply) => {
        const wallet = simulation.getWallets().find(candidate => candidate.walletId === request.params.walletId);
        if (!wallet) return reply.code(404).send({ success: false, error: "Wallet not found" });
        const utxos = getUTXOExplorerData(wallet.address).utxos;
        const transactions = getTransactionHistory(wallet.address).transactions;
        return { wallet, utxos, transactions };
    });

    app.post("/api/wallets", async request => {
        try {
            const wallet = simulation.createWallet(request.body?.name ?? "Wallet");
            return {
                success: true,
                wallet: simulation.getWallets().find(candidate => candidate.walletId === wallet.walletId)
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    app.post("/api/wallets/:walletId/fund", async (request, reply) => {
        try {
            const amount = Number(request.body?.amount ?? 10);
            const transaction = simulation.fundWallet(request.params.walletId, amount);
            return { success: true, transaction };
        } catch (error) {
            return reply.code(400).send({ success: false, error: error.message });
        }
    });

    app.get("/api/transactions", async request => {
        const address = String(request.query.address ?? "");
        return getTransactionHistory(address);
    });

    app.get("/api/transactions/:id", async (request, reply) => {
        const { blocks } = getBlockchainExplorerData();
        const confirmed = blocks.flatMap(block => block.transactions);
        const pendingTransaction = simulation.getBestNode().mempool.getTransaction(request.params.id);
        const pending = pendingTransaction ? enrichPendingTransaction(pendingTransaction) : null;
        const transaction = confirmed.find(candidate => candidate.id === request.params.id) ?? pending;

        if (!transaction) return reply.code(404).send({ success: false, error: "Transaction not found" });
        return { transaction };
    });

    app.get("/api/merkle", async (request, reply) => {
        const blocks = simulation.getBestNode().blockchain.getBlocks();
        const height = request.query.height === undefined
            ? blocks.at(-1).height
            : Number(request.query.height);
        const block = blocks.find(candidate => candidate.height === height);

        if (!Number.isInteger(height) || !block) {
            return reply.code(404).send({ success: false, error: "Block not found" });
        }

        const tree = new MerkleTree(block.transactions);
        return {
            blockHeight: block.height,
            blockHash: block.hash,
            transactionIds: tree.leaves,
            levels: tree.levels,
            root: tree.getRoot()
        };
    });

    app.post("/api/merkle/proof", async (request, reply) => {
        const blocks = simulation.getBestNode().blockchain.getBlocks();
        const height = request.body?.height === undefined ? blocks.at(-1).height : Number(request.body.height);
        const block = blocks.find(candidate => candidate.height === height);
        if (!block) return reply.code(404).send({ success: false, error: "Block not found" });

        const tree = new MerkleTree(block.transactions);
        const transactionIndex = tree.leaves.indexOf(request.body?.transactionId);
        if (transactionIndex < 0) {
            return reply.code(404).send({ success: false, error: "Transaction not found in block" });
        }

        const proof = tree.getProof(transactionIndex);
        return {
            leaf: tree.leaves[transactionIndex],
            proof,
            root: tree.getRoot(),
            valid: MerkleTree.verifyProof(tree.leaves[transactionIndex], proof, tree.getRoot())
        };
    });

    app.post("/api/merkle/verify", async request => {
        const { leaf, proof, root } = request.body ?? {};
        const valid = typeof leaf === "string" && Array.isArray(proof) && typeof root === "string"
            ? MerkleTree.verifyProof(leaf, proof, root)
            : false;
        return { valid };
    });

    app.post("/api/transactions", async request => {
        try {
            const { from, to, amount } = request.body;
            const transaction = simulation.createTransaction({ from, to, amount });

            return { success: true, transaction };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    const mineBlockHandler = async request => {
        try {
            const { nodeId } = request.body;
            const result = await simulation.mineBlock(nodeId);

            return { success: true, result };
        } catch (error) {
            return { success: false, error: error.message };
        }
    };

    app.post("/api/simulation/mine", mineBlockHandler);
    app.post("/api/mine", mineBlockHandler);

    app.get("/api/blocks", async () => getBlockchainExplorerData());

    app.get("/api/blocks/:height", async (request, reply) => {
        const height = Number(request.params.height);
        const { blocks } = getBlockchainExplorerData();
        const block = blocks.find(candidate => candidate.height === height);

        if (!Number.isInteger(height) || !block) {
            return reply.code(404).send({ success: false, error: "Block not found" });
        }

        return { block };
    });

    app.get("/api/blocks/hash/:hash", async (request, reply) => {
        const { blocks } = getBlockchainExplorerData();
        const block = blocks.find(candidate => candidate.hash === request.params.hash);
        if (!block) return reply.code(404).send({ success: false, error: "Block not found" });
        return { block };
    });

    app.get("/api/utxos", async request => {
        const address = String(request.query.address ?? "").trim();
        return getUTXOExplorerData(address);
    });

    app.get("/api/mempool", async () => {
        const transactions = simulation.getBestNode().mempool.getTransactions().map(enrichPendingTransaction);

        return {
            summary: {
                count: transactions.length,
                totalFees: transactions.reduce((total, transaction) => total + transaction.fee, 0)
            },
            transactions
        };
    });

    app.get("/ws", { websocket: true }, socket => {
        const initialState = simulation.getState();
        socket.send(JSON.stringify({ type: "SNAPSHOT", state: initialState }));
        let lastSignature = JSON.stringify({
            height: initialState.networkHeight,
            nodes: initialState.nodes.map(node => [node.id, node.online, node.mining, node.validating, node.mempoolSize, node.localHeight]),
            mining: initialState.mining,
            controls: initialState.controls,
            event: initialState.events.at(-1)
        });

        const interval = setInterval(() => {
            if (socket.readyState === 1) {
                const state = simulation.getState();
                const latestEvent = state.events.at(-1);
                const signature = JSON.stringify({
                    height: state.networkHeight,
                    nodes: state.nodes.map(node => [node.id, node.online, node.mining, node.validating, node.mempoolSize, node.localHeight]),
                    mining: state.mining && [state.mining.status, state.mining.hashAttempts, state.mining.currentHash],
                    controls: state.controls,
                    event: latestEvent && [latestEvent.type, latestEvent.timestamp]
                });
                if (signature !== lastSignature) {
                    lastSignature = signature;
                    socket.send(JSON.stringify({
                        type: "UPDATE",
                        state: {
                            running: state.running,
                            speed: state.speed,
                            controls: state.controls,
                            difficulty: state.difficulty,
                            blockReward: state.blockReward,
                            forkCount: state.forkCount,
                            reorganizationCount: state.reorganizationCount,
                            networkHeight: state.networkHeight,
                            networkTip: state.networkTip,
                            networkTipShort: state.networkTipShort,
                            mining: state.mining,
                            halvingInterval: state.halvingInterval,
                            initialBlockReward: state.initialBlockReward,
                            nextHalvingHeight: state.nextHalvingHeight,
                            blocksUntilHalving: state.blocksUntilHalving,
                            totalSimulatedIssuance: state.totalSimulatedIssuance,
                            totalMiningAttempts: state.totalMiningAttempts,
                            difficultyAdjustmentInterval: state.difficultyAdjustmentInterval,
                            targetBlockTimeSeconds: state.targetBlockTimeSeconds,
                            nodes: state.nodes,
                            events: state.events.slice(-10)
                        }
                    }));
                }
            }
        }, 500);

        socket.on("close", () => clearInterval(interval));
        }
    );

    expressApp.use((request, response) => {
        response.status(404).json(errorResponse(new Error("Route not found"), "NOT_FOUND"));
    });
    expressApp.use((error, request, response, next) => {
        const statusCode = error.statusCode && error.statusCode < 500 ? error.statusCode : 500;
        if (statusCode === 500) console.error(error);
        const safeError = statusCode === 500 ? new Error("Internal server error") : error;
        response.status(statusCode).json(errorResponse(safeError, statusCode === 500 ? "INTERNAL_ERROR" : "INVALID_REQUEST"));
    });

    if (process.env.VERCEL !== "1") {
        const port = Number(process.env.PORT ?? 4000);
        const host = process.env.HOST ?? "0.0.0.0";
        const server = expressApp.listen(port, host, () => {
            console.log(`ChainLab backend running on http://localhost:${port}`);
        });
        server.on("upgrade", (request, socket, head) => {
            const pathname = new URL(request.url, "http://localhost").pathname;
            const handler = websocketRoutes.get(pathname);
            if (!handler) {
                socket.destroy();
                return;
            }
            websocketServer.handleUpgrade(request, socket, head, client => {
                try {
                    handler(client, request);
                } catch {
                    client.close();
                }
            });
        });
    }
}

start();
module.exports = expressApp;