"use client";

import { useRef, useState } from "react";

export default function NetworkGraph({ nodes = [], events = [] }) {
    const [selectedNodeId, setSelectedNodeId] = useState(null);
    const [hoveredNodeId, setHoveredNodeId] = useState(null);
    const [draggingNodeId, setDraggingNodeId] = useState(null);
    const [manualPositions, setManualPositions] = useState({});
    const canvasRef = useRef(null);
    const dragRef = useRef(null);
    const suppressClickRef = useRef(false);
    const columns = Math.min(4, Math.max(1, nodes.length));
    const rows = Math.ceil(nodes.length / columns);
    const graphHeight = Math.max(420, rows * 140 + 140);
    const positions = nodes.map((node, index) => {
        const row = Math.floor(index / columns);
        const column = index % columns;
        const nodesInRow = Math.min(columns, nodes.length - row * columns);
        return {
            id: node.id,
            x: manualPositions[node.id]?.x ?? ((column + 0.5) / nodesInRow) * 100,
            y: manualPositions[node.id]?.y ?? ((row + 1) / (rows + 1)) * 100
        };
    });
    const positionById = new Map(positions.map(position => [position.id, position]));
    const activeNodeId = hoveredNodeId ?? selectedNodeId;
    const selectedNode = nodes.find(node => node.id === selectedNodeId);
    const peerNames = selectedNode
        ? selectedNode.peers.map(peerId => nodes.find(node => node.id === peerId)?.name ?? peerId)
        : [];
    const edges = nodes.flatMap(node => (node.peers ?? [])
        .filter(peerId => node.id < peerId)
        .map(peerId => ({ source: node, target: nodes.find(candidate => candidate.id === peerId) }))
        .filter(edge => edge.target)
    );
    const packet = events.slice().reverse().find(event =>
        ["TRANSACTION_RECEIVED", "BLOCK_RECEIVED"].includes(event.type) && event.from && event.nodeId
    );
    const packetStart = packet && positionById.get(packet.from);
    const packetEnd = packet && positionById.get(packet.nodeId);

    function startDragging(event, node, position) {
        if (event.button !== 0) return;
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        dragRef.current = {
            nodeId: node.id,
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            originX: position.x,
            originY: position.y,
            moved: false
        };
        setDraggingNodeId(node.id);
    }

    function moveNode(event) {
        const drag = dragRef.current;
        const bounds = canvasRef.current?.getBoundingClientRect();
        if (!drag || drag.pointerId !== event.pointerId || !bounds) return;

        const deltaX = event.clientX - drag.startX;
        const deltaY = event.clientY - drag.startY;
        if (Math.abs(deltaX) + Math.abs(deltaY) > 4) drag.moved = true;

        const x = Math.min(94, Math.max(6, ((event.clientX - bounds.left) / bounds.width) * 100));
        const y = Math.min(88, Math.max(12, ((event.clientY - bounds.top) / bounds.height) * 100));
        setManualPositions(current => ({ ...current, [drag.nodeId]: { x, y } }));
    }

    function stopDragging(event) {
        const drag = dragRef.current;
        if (!drag || drag.pointerId !== event.pointerId) return;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }
        if (drag.moved) {
            suppressClickRef.current = true;
            window.setTimeout(() => { suppressClickRef.current = false; }, 0);
        }
        dragRef.current = null;
        setDraggingNodeId(null);
    }

    return (
        <section className="border border-zinc-800 bg-zinc-950">
          <div ref={canvasRef} onPointerMove={moveNode} className="relative overflow-hidden" style={{ height: `${graphHeight}px` }}>
            <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="Peer-to-peer node connections">
                {edges.map(({ source, target }) => {
                    const start = positionById.get(source.id);
                    const end = positionById.get(target.id);
                    const highlighted = activeNodeId === source.id || activeNodeId === target.id;
                    return <line key={`${source.id}:${target.id}`} x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke={!source.online || !target.online ? "#18181b" : highlighted ? "#38bdf8" : "#3f3f46"} strokeWidth={highlighted ? "1" : "0.5"} strokeDasharray={source.online && target.online ? undefined : "2 2"} className={activeNodeId && !highlighted ? "opacity-30" : "opacity-100"} />;
                })}
                {packetStart && packetEnd && (
                    <circle r="1.2" fill={packet.type === "BLOCK_RECEIVED" ? "#facc15" : "#38bdf8"}>
                        <animateMotion key={`${packet.type}:${packet.timestamp}`} path={`M ${packetStart.x} ${packetStart.y} L ${packetEnd.x} ${packetEnd.y}`} dur="1s" repeatCount="2" />
                    </circle>
                )}
            </svg>

            {nodes.map((node, index) => {
                const position = positions[index];
                const stateClass = !node.online
                    ? "border-zinc-700 bg-zinc-950"
                                        : node.reorganizing
                                            ? "border-red-500 bg-red-950/40"
                    : node.mining
                      ? "border-yellow-500 bg-yellow-950/40"
                      : node.validating
                        ? "border-sky-500 bg-sky-950/40"
                                                : node.receivingBlock
                                                    ? "border-blue-500 bg-blue-950/40"
                                                    : node.receivingTransaction
                                                        ? "border-cyan-500 bg-cyan-950/40"
                                                        : node.forked
                                                            ? "border-orange-500 bg-orange-950/30"
                        : "border-green-900 bg-zinc-900";
                const dotClass = !node.online
                    ? "bg-zinc-600"
                                        : node.reorganizing
                                            ? "bg-red-400"
                    : node.mining
                      ? "bg-yellow-400"
                      : node.validating
                        ? "bg-sky-400"
                                                : node.receivingBlock
                                                    ? "bg-blue-400"
                                                    : node.receivingTransaction
                                                        ? "bg-cyan-400"
                                                        : node.forked
                                                            ? "bg-orange-400"
                        : "bg-green-500";

                return (
                    <button
                        key={node.id}
                        type="button"
                        aria-pressed={selectedNodeId === node.id}
                        aria-label={`${node.name}, ${node.online ? "online" : "offline"}, height ${node.localHeight}, ${node.peers.length} peers`}
                        title={`Drag to move ${node.name}; click to inspect`}
                        onPointerDown={event => startDragging(event, node, position)}
                        onPointerUp={stopDragging}
                        onPointerCancel={stopDragging}
                        onClick={event => {
                            if (suppressClickRef.current) {
                                event.preventDefault();
                                return;
                            }
                            setSelectedNodeId(current => current === node.id ? null : node.id);
                        }}
                        onMouseEnter={() => setHoveredNodeId(node.id)}
                        onMouseLeave={() => setHoveredNodeId(null)}
                        onFocus={() => setHoveredNodeId(node.id)}
                        onBlur={() => setHoveredNodeId(null)}
                        className={`absolute -translate-x-1/2 -translate-y-1/2 touch-none rounded-full p-0 text-white ${draggingNodeId === node.id ? "z-20 cursor-grabbing" : "cursor-grab transition-transform hover:scale-105"} focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400 ${selectedNodeId === node.id ? "z-10 scale-105 ring-2 ring-sky-400 ring-offset-2 ring-offset-zinc-950" : ""}`}
                        style={{ left: `${position.x}%`, top: `${position.y}%`, width: "clamp(56px, 10vw, 92px)" }}
                    >
                        <span className={`flex aspect-square w-full flex-col items-center justify-center rounded-full border text-center ${stateClass}`}>
                            <span className={`mb-2 h-2.5 w-2.5 rounded-full ${dotClass}`} />
                            <span className="max-w-21 truncate text-[10px] font-semibold">{node.name}</span>
                            <span className="mt-1 text-[9px] capitalize text-zinc-500">{node.role?.replaceAll("-", " ")}</span>
                            <span className="mt-1 text-[9px] text-zinc-600">Height {node.localHeight}</span>
                        </span>
                    </button>
                );
            })}

            <div className="absolute left-4 top-4">
                <p className="text-sm font-semibold">P2P Network</p>
                <p className="text-[10px] text-zinc-500">Drag to arrange · click to inspect</p>
            </div>
            <div className="absolute bottom-3 left-4 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-zinc-500">
                <span className="text-green-400">Online</span><span className="text-yellow-400">Mining</span><span className="text-sky-400">Validating</span><span className="text-blue-400">Block</span><span className="text-cyan-400">Transaction</span><span className="text-orange-400">Forked</span><span className="text-red-400">Reorg</span><span className="text-zinc-600">Offline</span>
            </div>
          </div>
          {selectedNode && (
              <div className="grid gap-x-6 gap-y-3 border-t border-zinc-800 px-4 py-3 text-xs sm:grid-cols-2 lg:grid-cols-4" aria-live="polite">
                  <NodeDetail label="Selected node" value={`${selectedNode.name} · ${selectedNode.role.replaceAll("-", " ")}`} />
                  <NodeDetail label="Status" value={`${selectedNode.online ? "Online" : "Offline"} · height ${selectedNode.localHeight}`} />
                  <NodeDetail label="Mining power" value={selectedNode.role === "miner" ? `${selectedNode.miningPower} relative` : "Validator / observer"} />
                  <NodeDetail label="Balance / mempool" value={`${Number(selectedNode.balance).toFixed(3)} BTC · ${selectedNode.mempoolSize} pending`} />
                  <div className="sm:col-span-2 lg:col-span-4">
                      <p className="text-zinc-500">Peers</p>
                      <p className="mt-1 text-zinc-200">{peerNames.length ? peerNames.join(" · ") : "No peers"}</p>
                  </div>
              </div>
          )}
        </section>
    );
}

function NodeDetail({ label, value }) {
    return <div><p className="text-zinc-500">{label}</p><p className="mt-1 text-zinc-200">{value}</p></div>;
}