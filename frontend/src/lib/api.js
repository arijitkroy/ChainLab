const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000").replace(/\/+$/, "");
const WS_URL = API_URL.replace(/^http/, "ws");

export async function getBlocks() {
    const response = await fetch(`${API_URL}/api/blocks`, { cache: "no-store" });

    if (!response.ok) {
        throw new Error("Failed to fetch blockchain data");
    }

    return response.json();
}

export async function getUTXOs() {
    const response = await fetch(`${API_URL}/api/utxos`, { cache: "no-store" });

    if (!response.ok) {
        throw new Error("Failed to fetch UTXO data");
    }

    return response.json();
}

export async function getWallets() {
    const response = await fetch(`${API_URL}/api/wallets`, { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : data.error?.message ?? "Failed to fetch wallets");
    return data;
}

export async function getNodes() {
    const response = await fetch(`${API_URL}/api/nodes`, { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : data.error?.message ?? "Failed to fetch nodes");
    return data;
}

export async function createWallet(name) {
    return postJSON("/api/wallets", { name });
}

export async function createNode(options) {
    return postJSON("/api/nodes", options);
}

export async function setNodeOnline(nodeId, online) {
    const action = online ? "start" : "stop";
    return postJSON(`/api/nodes/${encodeURIComponent(nodeId)}/${action}`, {});
}

export async function fundWallet(walletId, amount = 10) {
    return postJSON(`/api/wallets/${encodeURIComponent(walletId)}/fund`, { amount });
}

export async function createTransaction({ from, to, amount }) {
    return postJSON("/api/transactions", { from, to, amount });
}

export async function getTransactions(address = "") {
    const query = address ? `?address=${encodeURIComponent(address)}` : "";
    const response = await fetch(`${API_URL}/api/transactions${query}`, { cache: "no-store" });
    if (!response.ok) throw new Error("Failed to fetch transactions");
    return response.json();
}

export async function getMempool() {
    const response = await fetch(`${API_URL}/api/mempool`, { cache: "no-store" });
    if (!response.ok) throw new Error("Failed to fetch mempool");
    return response.json();
}

export async function runMiningRace(miners, rounds = 1000) {
    const response = await fetch(`${API_URL}/api/race`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ miners, rounds })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "Mining race failed");
    return data;
}

export async function getForks() {
    const response = await fetch(`${API_URL}/api/forks`, { cache: "no-store" });
    if (!response.ok) throw new Error("Failed to fetch chain branches");
    return response.json();
}

export async function createCompetingBlocks(nodeIds) {
    return postJSON("/api/forks/simulate", { nodeIds });
}

export async function mineOnBranch(nodeId, parentHash) {
    return postJSON("/api/forks/mine", { nodeId, parentHash });
}

export async function runDoubleSpendScenario(options) {
    return postJSON("/api/attacks/double-spend/run", options);
}

export async function runMajorityAttack(options) {
    return postJSON("/api/attacks/51-percent/run", options);
}

export async function runSelfishMining(options) {
    return postJSON("/api/attacks/selfish-mining/run", options);
}

export async function setDifficulty(difficulty) {
    return postJSON("/api/simulation/difficulty", { difficulty });
}

export async function setDifficultyAdjustmentInterval(interval) {
    return postJSON("/api/simulation/difficulty-interval", { interval });
}

export async function startSimulation() {
    return postJSON("/api/simulation/start", {});
}

export async function pauseSimulation() {
    return postJSON("/api/simulation/pause", {});
}

export async function resetSimulation() {
    return postJSON("/api/simulation/reset", {});
}

export async function stepSimulation() {
    return postJSON("/api/simulation/step", {});
}

export async function setSimulationSpeed(speed) {
    return postJSON("/api/simulation/speed", { speed });
}

export async function updateSimulationControls(controls) {
    return postJSON("/api/simulation/controls", controls);
}

export async function setRewardSchedule(initialBlockReward, halvingInterval) {
    return postJSON("/api/simulation/reward-schedule", { initialBlockReward, halvingInterval });
}

export async function getMerkleTree(height) {
    const query = height === undefined ? "" : `?height=${encodeURIComponent(height)}`;
    const response = await fetch(`${API_URL}/api/merkle${query}`, { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "Failed to fetch Merkle tree");
    return data;
}

export async function generateMerkleProof(transactionId, height) {
    return postJSON("/api/merkle/proof", { transactionId, height });
}

export async function verifyMerkleProof(leaf, proof, root) {
    return postJSON("/api/merkle/verify", { leaf, proof, root });
}

export async function getSimulation() {
    const response = await fetch(`${API_URL}/api/simulation`, { cache: "no-store" });

    if (!response.ok) {
        throw new Error(
            "Failed to fetch simulation"
        );
    }

    return response.json();
}

export async function mineBlock(nodeId) {
    return postJSON("/api/simulation/mine", { nodeId });
}

async function postJSON(path, body) {
    const response = await fetch(`${API_URL}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
    });

    const data = await response.json();
    if (!response.ok || data.success === false) {
        const message = typeof data.error === "string" ? data.error : data.error?.message;
        throw new Error(message ?? "Request failed");
    }
    return data;
}

export function connectSimulationSocket(onMessage, onStatus = () => {}) {
    const socket = new WebSocket(`${WS_URL}/ws`);
    let snapshot = null;
    let closed = false;
    let polling = false;
    let pollTimer = null;

    async function pollSnapshot() {
        if (closed) return;
        try {
            const response = await fetch(`${API_URL}/api/simulation`, { cache: "no-store" });
            if (!response.ok) throw new Error("Simulation endpoint unavailable");
            snapshot = await response.json();
            onMessage(snapshot);
            onStatus("polling");
        } catch {
            onStatus("disconnected");
        }
        if (!closed) pollTimer = window.setTimeout(pollSnapshot, 1000);
    }

    function startPolling() {
        if (closed || polling) return;
        polling = true;
        onStatus("polling");
        pollSnapshot();
    }

    socket.onopen = () => onStatus("connected");
    socket.onclose = startPolling;
    socket.onerror = () => socket.close();

    socket.onmessage = event => {
        const message = JSON.parse(event.data);
        if (message.type === "SNAPSHOT") {
            snapshot = message.state;
        } else if (message.type === "UPDATE" && snapshot) {
            const events = [...(snapshot.events ?? []), ...(message.state.events ?? [])];
            const uniqueEvents = new Map(events.map(item => [
                `${item.type}:${item.timestamp}:${item.transactionId ?? item.blockHash ?? item.nodeId ?? ""}`,
                item
            ]));
            snapshot = { ...snapshot, ...message.state, events: Array.from(uniqueEvents.values()).slice(-50) };
        } else if (!message.type) {
            snapshot = message;
        }
        if (snapshot) onMessage(snapshot);
    };

    return {
        close() {
            closed = true;
            if (pollTimer) window.clearTimeout(pollTimer);
            socket.close();
        }
    };
}