'use client';

import { useEffect, useRef, useState } from 'react';
import { DiagramCardinality, DiagramEdge, DiagramModel, DiagramNode, DiagramNodeKind } from '@/types';
import {
    appendDiagramActionEvent,
    createDiagramActionEvent,
    createDiagramNode,
    describeEdgeVector,
    describeNodeVector,
    DIAGRAM_NODE_LABELS,
    getMeriseLinkRule,
    normalizeDiagram,
} from '@/lib/diagram';

const CARDINALITY_OPTIONS: DiagramCardinality[] = ['0', '1', 'N', 'M'];
const NODE_WIDTH = 180;
const NODE_HEIGHT = 84;
type CardinalityValue = DiagramCardinality | '';

interface DiagramBuilderProps {
    value?: DiagramModel | null;
    onChange?: (value: DiagramModel) => void;
    readOnly?: boolean;
    title?: string;
    description?: string;
    variant?: 'default' | 'student';
    mode?: 'editor' | 'viewer';
}

function getNodeStyles(kind: DiagramNodeKind) {
    switch (kind) {
        case 'entity':
            return 'rounded-xl border-sky-400/70 bg-sky-500/15';
        case 'pseudo_entity':
            return 'rounded-xl border-dashed border-cyan-300/70 bg-cyan-500/10';
        case 'attribute':
            return 'rounded-full border-amber-300/80 bg-amber-500/10';
        case 'association':
            return 'rounded-[1.5rem] border-fuchsia-300/70 bg-fuchsia-500/10';
        case 'inheritance':
            return 'rounded-2xl border-emerald-300/70 bg-emerald-500/10';
        default:
            return 'rounded-xl border-slate-500 bg-slate-700/40';
    }
}

export default function DiagramBuilder({
    value,
    onChange,
    readOnly = false,
    title = 'Diagram Builder',
    description = 'Drag shapes into the canvas, then edit labels, attributes, and links.',
    variant = 'default',
    mode = 'editor',
}: DiagramBuilderProps) {
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
    const [draftAttribute, setDraftAttribute] = useState('');
    const [linkSource, setLinkSource] = useState('');
    const [linkTarget, setLinkTarget] = useState('');
    const [linkSourceCardinality, setLinkSourceCardinality] = useState<CardinalityValue>('');
    const [linkTargetCardinality, setLinkTargetCardinality] = useState<CardinalityValue>('');
    const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const [dragStartPosition, setDragStartPosition] = useState<{ x: number; y: number } | null>(null);
    const [isDropActive, setIsDropActive] = useState(false);
    const [isTouchDragging, setIsTouchDragging] = useState(false);
    const canvasRef = useRef<HTMLDivElement | null>(null);
    const isStudentVariant = variant === 'student';
    const isViewerMode = mode === 'viewer';

    const diagram = normalizeDiagram(value);
    const selectedNode = diagram.nodes.find((node) => node.id === selectedNodeId) || null;
    const selectedEdge = diagram.edges.find((edge) => edge.id === selectedEdgeId) || null;
    const linkSourceNode = diagram.nodes.find((node) => node.id === linkSource);
    const linkTargetNode = diagram.nodes.find((node) => node.id === linkTarget);
    const linkRule = getMeriseLinkRule(linkSourceNode?.kind, linkTargetNode?.kind);
    const selectedEdgeSource = selectedEdge ? diagram.nodes.find((node) => node.id === selectedEdge.source) : undefined;
    const selectedEdgeTarget = selectedEdge ? diagram.nodes.find((node) => node.id === selectedEdge.target) : undefined;
    const selectedEdgeRule = getMeriseLinkRule(selectedEdgeSource?.kind, selectedEdgeTarget?.kind);

    const commit = (next: DiagramModel) => {
        onChange?.(normalizeDiagram(next));
    };

    const commitWithEvent = (next: DiagramModel, event: ReturnType<typeof createDiagramActionEvent>) => {
        onChange?.(appendDiagramActionEvent(next, event));
    };

    const addNode = (kind: DiagramNodeKind, x: number, y: number) => {
        if (readOnly) return;
        const node = createDiagramNode(kind, Math.max(16, x), Math.max(16, y));
        commitWithEvent(
            { ...diagram, nodes: [...diagram.nodes, node] },
            createDiagramActionEvent('node_add', node.id, `Added ${DIAGRAM_NODE_LABELS[kind]} "${node.label}"`, [
                {
                    subjectType: 'node',
                    subjectId: node.id,
                    vector: describeNodeVector(node),
                },
            ])
        );
        setSelectedNodeId(node.id);
        setSelectedEdgeId(null);
    };

    const updateNode = (nodeId: string, patch: Partial<DiagramNode>) => {
        if (readOnly) return;
        commit({
            ...diagram,
            nodes: diagram.nodes.map((node) => (node.id === nodeId ? { ...node, ...patch } : node)),
        });
    };

    const logNodeUpdate = (nodeId: string, summary: string, patch: Partial<DiagramNode>) => {
        if (readOnly) return;
        const nextNodes = diagram.nodes.map((node) => (node.id === nodeId ? { ...node, ...patch } : node));
        const nextNode = nextNodes.find((node) => node.id === nodeId);
        if (!nextNode) return;
        commitWithEvent(
            { ...diagram, nodes: nextNodes },
            createDiagramActionEvent('node_update', nodeId, summary, [
                {
                    subjectType: 'node',
                    subjectId: nodeId,
                    vector: describeNodeVector(nextNode),
                },
            ])
        );
    };

    const deleteNode = (nodeId: string) => {
        if (readOnly) return;
        const deletedNode = diagram.nodes.find((node) => node.id === nodeId);
        const deletedEdges = diagram.edges.filter((edge) => edge.source === nodeId || edge.target === nodeId);
        const nextDiagram = {
            nodes: diagram.nodes.filter((node) => node.id !== nodeId),
            edges: diagram.edges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId),
            actionLog: diagram.actionLog || [],
        };
        if (deletedNode) {
            commitWithEvent(
                nextDiagram,
                createDiagramActionEvent(
                    'node_delete',
                    nodeId,
                    `Deleted ${DIAGRAM_NODE_LABELS[deletedNode.kind]} "${deletedNode.label}"`,
                    [
                        {
                            subjectType: 'node',
                            subjectId: nodeId,
                            vector: describeNodeVector(deletedNode),
                        },
                        ...deletedEdges.map((edge) => ({
                            subjectType: 'edge' as const,
                            subjectId: edge.id,
                            vector: describeEdgeVector(edge, diagram.nodes),
                        })),
                    ]
                )
            );
        } else {
            commit(nextDiagram);
        }
        setSelectedNodeId(null);
        setSelectedEdgeId(null);
    };

    const addEdge = () => {
        if (readOnly || !linkSource || !linkTarget || linkSource === linkTarget) return;
        const edge: DiagramEdge = {
            id: `edge-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
            source: linkSource,
            target: linkTarget,
            sourceCardinality: linkRule.allowsCardinality && linkSourceCardinality ? linkSourceCardinality : undefined,
            targetCardinality: linkRule.allowsCardinality && linkTargetCardinality ? linkTargetCardinality : undefined,
        };
        commitWithEvent(
            { ...diagram, edges: [...diagram.edges, edge] },
            createDiagramActionEvent('edge_add', edge.id, 'Added relationship link', [
                {
                    subjectType: 'edge',
                    subjectId: edge.id,
                    vector: describeEdgeVector(edge, diagram.nodes),
                },
            ])
        );
        setSelectedEdgeId(edge.id);
    };

    const updateEdge = (edgeId: string, patch: Partial<DiagramEdge>) => {
        if (readOnly) return;
        const nextEdges = diagram.edges.map((edge) => (edge.id === edgeId ? { ...edge, ...patch } : edge));
        const nextEdge = nextEdges.find((edge) => edge.id === edgeId);
        if (!nextEdge) return;
        commitWithEvent(
            {
                ...diagram,
                edges: nextEdges,
            },
            createDiagramActionEvent('edge_update', edgeId, 'Updated relationship cardinalities', [
                {
                    subjectType: 'edge',
                    subjectId: edgeId,
                    vector: describeEdgeVector(nextEdge, diagram.nodes),
                },
            ])
        );
    };

    const deleteEdge = (edgeId: string) => {
        if (readOnly) return;
        const deletedEdge = diagram.edges.find((edge) => edge.id === edgeId);
        const nextDiagram = {
            ...diagram,
            edges: diagram.edges.filter((edge) => edge.id !== edgeId),
        };
        if (deletedEdge) {
            commitWithEvent(
                nextDiagram,
                createDiagramActionEvent('edge_delete', edgeId, 'Deleted relationship link', [
                    {
                        subjectType: 'edge',
                        subjectId: edgeId,
                        vector: describeEdgeVector(deletedEdge, diagram.nodes),
                    },
                ])
            );
        } else {
            commit(nextDiagram);
        }
        setSelectedEdgeId(null);
    };

    const handleCanvasDrop = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        setIsDropActive(false);
        if (readOnly || !canvasRef.current) return;
        const kind = event.dataTransfer.getData('diagram-node-kind') as DiagramNodeKind;
        if (!kind) return;
        const rect = canvasRef.current.getBoundingClientRect();
        addNode(kind, event.clientX - rect.left - NODE_WIDTH / 2, event.clientY - rect.top - NODE_HEIGHT / 2);
    };

    const startNodeDrag = (clientX: number, clientY: number, node: DiagramNode) => {
        if (readOnly || !canvasRef.current) return;
        const rect = canvasRef.current.getBoundingClientRect();
        setDraggingNodeId(node.id);
        setDragStartPosition({ x: node.x, y: node.y });
        setDragOffset({
            x: clientX - rect.left - node.x,
            y: clientY - rect.top - node.y,
        });
    };

    const handleNodeMouseStart = (event: React.MouseEvent<HTMLDivElement>, node: DiagramNode) => {
        startNodeDrag(event.clientX, event.clientY, node);
    };

    const handleNodeTouchStart = (event: React.TouchEvent<HTMLDivElement>, node: DiagramNode) => {
        const touch = event.touches[0];
        if (!touch) return;
        event.preventDefault();
        setIsTouchDragging(true);
        startNodeDrag(touch.clientX, touch.clientY, node);
    };

    useEffect(() => {
        if (!draggingNodeId || readOnly) return;

        const handleMove = (event: MouseEvent) => {
            if (!canvasRef.current) return;
            const rect = canvasRef.current.getBoundingClientRect();
            updateNode(draggingNodeId, {
                x: Math.max(8, Math.min(rect.width - NODE_WIDTH - 8, event.clientX - rect.left - dragOffset.x)),
                y: Math.max(8, Math.min(rect.height - NODE_HEIGHT - 8, event.clientY - rect.top - dragOffset.y)),
            });
        };

        const handleUp = () => {
            if (draggingNodeId && dragStartPosition) {
                const movedNode = diagram.nodes.find((node) => node.id === draggingNodeId);
                if (movedNode && (movedNode.x !== dragStartPosition.x || movedNode.y !== dragStartPosition.y)) {
                    commitWithEvent(
                        diagram,
                        createDiagramActionEvent(
                            'node_move',
                            draggingNodeId,
                            `Moved "${movedNode.label}" to (${Math.round(movedNode.x)}, ${Math.round(movedNode.y)})`,
                            [
                                {
                                    subjectType: 'node',
                                    subjectId: draggingNodeId,
                                    vector: describeNodeVector(movedNode),
                                },
                            ]
                        )
                    );
                }
            }
            setDraggingNodeId(null);
            setDragStartPosition(null);
        };

        const handleTouchMove = (event: TouchEvent) => {
            const touch = event.touches[0];
            if (!touch || !canvasRef.current) return;
            event.preventDefault();
            const rect = canvasRef.current.getBoundingClientRect();
            updateNode(draggingNodeId, {
                x: Math.max(8, Math.min(rect.width - NODE_WIDTH - 8, touch.clientX - rect.left - dragOffset.x)),
                y: Math.max(8, Math.min(rect.height - NODE_HEIGHT - 8, touch.clientY - rect.top - dragOffset.y)),
            });
        };

        const handleTouchEnd = () => {
            setIsTouchDragging(false);
            handleUp();
        };

        window.addEventListener('mousemove', handleMove);
        window.addEventListener('mouseup', handleUp);
        window.addEventListener('touchmove', handleTouchMove, { passive: false });
        window.addEventListener('touchend', handleTouchEnd);
        return () => {
            window.removeEventListener('mousemove', handleMove);
            window.removeEventListener('mouseup', handleUp);
            window.removeEventListener('touchmove', handleTouchMove);
            window.removeEventListener('touchend', handleTouchEnd);
        };
    }, [diagram, dragOffset.x, dragOffset.y, dragStartPosition, draggingNodeId, readOnly]);

    useEffect(() => {
        if (!linkRule.allowsCardinality) {
            setLinkSourceCardinality('');
            setLinkTargetCardinality('');
        } else if (linkRule.requiresCardinality) {
            if (!linkSourceCardinality) setLinkSourceCardinality('1');
            if (!linkTargetCardinality) setLinkTargetCardinality('N');
        }
    }, [linkRule.allowsCardinality, linkRule.requiresCardinality]);

    const renderNode = (node: DiagramNode) => (
        <div
            key={node.id}
            className={`absolute border-2 shadow-lg transition-all ${getNodeStyles(node.kind)} ${
                selectedNodeId === node.id ? 'ring-2 ring-white/70' : ''
            }`}
            style={{
                left: node.x,
                top: node.y,
                width: NODE_WIDTH,
                minHeight: NODE_HEIGHT,
                cursor: readOnly ? 'default' : draggingNodeId === node.id ? 'grabbing' : 'grab',
                touchAction: 'none',
            }}
            onClick={() => {
                setSelectedNodeId(node.id);
                setSelectedEdgeId(null);
            }}
        >
            <div
                className="border-b border-white/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-200"
                onMouseDown={(event) => handleNodeMouseStart(event, node)}
                onTouchStart={(event) => handleNodeTouchStart(event, node)}
            >
                {DIAGRAM_NODE_LABELS[node.kind]}
            </div>
            <div className="px-3 py-3">
                <p className="text-sm font-semibold text-white break-words">{node.label || 'Unnamed'}</p>
                {node.attributes && node.attributes.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                        {node.attributes.map((attribute, index) => (
                            <span key={`${node.id}-attribute-${index}`} className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-slate-200">
                                {attribute}
                            </span>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );

    const palette = (
        <aside className={`rounded-[1.75rem] border border-slate-600/90 bg-slate-900/60 p-4 shadow-2xl shadow-slate-950/20 ${isStudentVariant ? 'order-2 xl:order-1' : ''}`}>
            <div className="flex items-center justify-between gap-3">
                <h4 className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-300">{title}</h4>
                {!readOnly && isStudentVariant && (
                    <span className="rounded-full border border-indigo-400/40 bg-indigo-500/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.2em] text-indigo-200">
                        Toolbox
                    </span>
                )}
            </div>
            <p className="mt-2 text-sm text-slate-400">{description}</p>

            <div className={`mt-5 ${isStudentVariant ? 'grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-1' : 'space-y-3'}`}>
                    {(Object.keys(DIAGRAM_NODE_LABELS) as DiagramNodeKind[]).map((kind) => (
                        <div
                            key={kind}
                            draggable={!readOnly}
                            onDragStart={(event) => event.dataTransfer.setData('diagram-node-kind', kind)}
                            onClick={() => {
                                if (readOnly || !isStudentVariant) return;
                                addNode(kind, 48 + (diagram.nodes.length % 3) * 210, 56 + Math.floor(diagram.nodes.length / 3) * 110);
                            }}
                            className={`rounded-2xl border p-3 text-left transition-all ${getNodeStyles(kind)} ${readOnly ? 'opacity-70' : 'cursor-grab active:cursor-grabbing hover:-translate-y-0.5 hover:shadow-lg'} ${isStudentVariant ? 'min-h-[112px]' : ''}`}
                        >
                            <p className="text-sm font-semibold text-white">{DIAGRAM_NODE_LABELS[kind]}</p>
                            <p className="mt-1 text-xs text-slate-300">
                                {kind === 'entity' && 'Main business object'}
                                {kind === 'pseudo_entity' && 'Weak or derived entity'}
                                {kind === 'attribute' && 'Property/value node'}
                                {kind === 'association' && 'Relationship connector'}
                                {kind === 'inheritance' && 'Generalization / specialization'}
                            </p>
                            {!readOnly && isStudentVariant && (
                                <p className="mt-3 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-200/80">Drag or tap to add</p>
                            )}
                        </div>
                    ))}
            </div>
        </aside>
    );

    const canvas = (
            <div
                ref={canvasRef}
                onDragOver={(event) => {
                    event.preventDefault();
                    if (!isDropActive) setIsDropActive(true);
                }}
                onDragEnter={(event) => {
                    event.preventDefault();
                    setIsDropActive(true);
                }}
                onDragLeave={(event) => {
                    if (event.currentTarget === event.target) {
                        setIsDropActive(false);
                    }
                }}
                onDrop={handleCanvasDrop}
                className={`relative overflow-hidden rounded-[2rem] border bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.18),_transparent_35%),linear-gradient(180deg,rgba(15,23,42,0.9),rgba(15,23,42,0.98))] transition-all duration-200 ${
                    isStudentVariant
                        ? `order-1 min-h-[560px] sm:min-h-[640px] xl:min-h-[720px] border-slate-500/90 shadow-[0_30px_80px_rgba(15,23,42,0.45)] xl:order-2 ${isDropActive ? 'ring-4 ring-cyan-300/30 border-cyan-300/70 bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.24),_transparent_35%),linear-gradient(180deg,rgba(15,23,42,0.9),rgba(15,23,42,0.98))]' : ''}`
                        : `${isViewerMode ? 'min-h-[460px] border-slate-600/90' : 'min-h-[540px] border-slate-600'}`
                }`}
                style={{
                    backgroundSize: '100% 100%, 100% 100%',
                    touchAction: isTouchDragging ? 'none' : 'manipulation',
                }}
            >
                <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'linear-gradient(rgba(148,163,184,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.12) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
                <svg className="pointer-events-none absolute inset-0 h-full w-full">
                    {diagram.edges.map((edge) => {
                        const source = diagram.nodes.find((node) => node.id === edge.source);
                        const target = diagram.nodes.find((node) => node.id === edge.target);
                        if (!source || !target) return null;

                        const x1 = source.x + NODE_WIDTH / 2;
                        const y1 = source.y + NODE_HEIGHT / 2;
                        const x2 = target.x + NODE_WIDTH / 2;
                        const y2 = target.y + NODE_HEIGHT / 2;
                        const isSelected = selectedEdgeId === edge.id;

                        return (
                            <g key={edge.id}>
                                <line
                                    x1={x1}
                                    y1={y1}
                                    x2={x2}
                                    y2={y2}
                                    stroke={isSelected ? '#f8fafc' : '#94a3b8'}
                                    strokeWidth={isSelected ? 3 : 2}
                                    strokeDasharray={source.kind === 'pseudo_entity' || target.kind === 'pseudo_entity' ? '6 5' : undefined}
                                />
                                <text x={(x1 + x2) / 2 - 24} y={(y1 + y2) / 2 - 8} fill="#cbd5e1" fontSize="12">
                                    {edge.sourceCardinality || '-'}
                                </text>
                                <text x={(x1 + x2) / 2 + 14} y={(y1 + y2) / 2 + 14} fill="#cbd5e1" fontSize="12">
                                    {edge.targetCardinality || '-'}
                                </text>
                            </g>
                        );
                    })}
                </svg>

                {diagram.nodes.length === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
                        <div className={`rounded-3xl border border-dashed px-6 py-8 ${isStudentVariant ? 'max-w-xl border-cyan-300/60 bg-slate-950/55 shadow-2xl shadow-cyan-950/20' : 'max-w-sm border-slate-500 bg-slate-900/40'}`}>
                            <p className={`font-semibold text-white ${isStudentVariant ? 'text-2xl' : 'text-lg'}`}>{isStudentVariant ? 'Start Building Your Diagram' : 'Drop shapes here'}</p>
                            <p className={`mt-2 text-slate-400 ${isStudentVariant ? 'text-base' : 'text-sm'}`}>
                                {isStudentVariant
                                    ? 'Use the toolbox below. Tap a shape card to add it, then tap and drag a node header to move it.'
                                    : 'Build the expected design by placing nodes, editing labels, and adding links with cardinalities.'}
                            </p>
                            {isStudentVariant && (
                                <div className="mt-5 grid gap-3 text-left sm:grid-cols-3">
                                    <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-3">
                                        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">1</p>
                                        <p className="mt-1 text-sm text-white">Add shapes</p>
                                    </div>
                                    <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-3">
                                        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">2</p>
                                        <p className="mt-1 text-sm text-white">Name items</p>
                                    </div>
                                    <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-3">
                                        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">3</p>
                                        <p className="mt-1 text-sm text-white">Create links</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {diagram.nodes.map(renderNode)}

                {!readOnly && !isViewerMode && (
                    <div className={`absolute rounded-full border bg-slate-900/70 px-4 py-2 text-xs text-slate-300 backdrop-blur ${isStudentVariant ? 'bottom-5 left-5 border-cyan-300/30' : 'bottom-4 left-4 border-slate-500/60'}`}>
                        {isStudentVariant
                            ? 'Tip: tap a shape card to add it. Touch and drag a node header to move it.'
                            : 'Drag from the left panel, click a node to edit it, and use the right panel to create links.'}
                    </div>
                )}
            </div>
    );

    const inspector = (
            <aside className={`rounded-[1.75rem] border border-slate-600/90 bg-slate-900/60 p-4 shadow-2xl shadow-slate-950/20 ${isStudentVariant ? 'order-3' : ''}`}>
                <h4 className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-300">Inspector</h4>

                {selectedNode ? (
                    <div className="mt-4 space-y-4">
                        <div>
                            <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-slate-400">Node Label</label>
                            <input
                                value={selectedNode.label}
                                onChange={(event) => logNodeUpdate(selectedNode.id, 'Updated node label', { label: event.target.value })}
                                disabled={readOnly}
                                className="input-field"
                            />
                        </div>

                        {(selectedNode.kind === 'entity' || selectedNode.kind === 'pseudo_entity') && (
                            <div>
                                <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-slate-400">Attributes</label>
                                <div className="flex gap-2">
                                    <input
                                        value={draftAttribute}
                                        onChange={(event) => setDraftAttribute(event.target.value)}
                                        disabled={readOnly}
                                        className="input-field"
                                        placeholder="Add attribute"
                                    />
                                    <button
                                        onClick={() => {
                                            if (!draftAttribute.trim()) return;
                                            logNodeUpdate(selectedNode.id, 'Added node attribute', {
                                                attributes: [...(selectedNode.attributes || []), draftAttribute.trim()],
                                            });
                                            setDraftAttribute('');
                                        }}
                                        disabled={readOnly}
                                        className="btn-secondary px-4"
                                    >
                                        Add
                                    </button>
                                </div>

                                <div className="mt-3 flex flex-wrap gap-2">
                                    {(selectedNode.attributes || []).map((attribute, index) => (
                                        <button
                                            key={`${selectedNode.id}-chip-${index}`}
                                            onClick={() => logNodeUpdate(selectedNode.id, 'Removed node attribute', {
                                                attributes: (selectedNode.attributes || []).filter((_, attrIndex) => attrIndex !== index),
                                            })}
                                            disabled={readOnly}
                                            className="rounded-full border border-slate-500 bg-slate-800 px-3 py-1 text-xs text-slate-200"
                                        >
                                            {attribute} {!readOnly ? 'x' : ''}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {!readOnly && (
                            <button onClick={() => deleteNode(selectedNode.id)} className="w-full rounded-xl border border-red-500/60 bg-red-900/30 px-4 py-3 text-sm font-semibold text-red-100">
                                Delete Node
                            </button>
                        )}
                    </div>
                ) : selectedEdge ? (
                    <div className="mt-4 space-y-4">
                        <p className="text-sm text-slate-300">Selected link</p>
                        <div className={`rounded-xl border px-3 py-3 ${selectedEdgeRule.requiresCardinality ? 'border-cyan-400/40 bg-cyan-500/10' : 'border-slate-700 bg-slate-900/40'}`}>
                            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Link rule</p>
                            <p className="mt-1 text-sm text-slate-200">{selectedEdgeRule.helperText}</p>
                            {selectedEdgeRule.allowsCardinality ? (
                                <div className="mt-3 grid grid-cols-2 gap-3">
                                    <select
                                        value={selectedEdge.sourceCardinality || ''}
                                        onChange={(event) => updateEdge(selectedEdge.id, { sourceCardinality: (event.target.value || undefined) as DiagramCardinality | undefined })}
                                        disabled={readOnly}
                                        className="input-field"
                                    >
                                        <option value="">Source cardinality</option>
                                        {CARDINALITY_OPTIONS.map((cardinality) => (
                                            <option key={`source-${cardinality}`} value={cardinality}>{cardinality}</option>
                                        ))}
                                    </select>
                                    <select
                                        value={selectedEdge.targetCardinality || ''}
                                        onChange={(event) => updateEdge(selectedEdge.id, { targetCardinality: (event.target.value || undefined) as DiagramCardinality | undefined })}
                                        disabled={readOnly}
                                        className="input-field"
                                    >
                                        <option value="">Target cardinality</option>
                                        {CARDINALITY_OPTIONS.map((cardinality) => (
                                            <option key={`target-${cardinality}`} value={cardinality}>{cardinality}</option>
                                        ))}
                                    </select>
                                </div>
                            ) : (
                                <p className="mt-3 text-xs text-slate-500">This link should stay without cardinalities.</p>
                            )}
                        </div>

                        {!readOnly && (
                            <button onClick={() => deleteEdge(selectedEdge.id)} className="w-full rounded-xl border border-red-500/60 bg-red-900/30 px-4 py-3 text-sm font-semibold text-red-100">
                                Delete Link
                            </button>
                        )}
                    </div>
                ) : (
                    <p className="mt-4 text-sm text-slate-400">Select a node or link to edit it.</p>
                )}

                {!readOnly && (
                    <div className="mt-6 border-t border-slate-700 pt-5">
                        <h5 className="text-sm font-semibold text-white">Create Link</h5>
                        <div className="mt-3 space-y-3">
                            <select value={linkSource} onChange={(event) => setLinkSource(event.target.value)} className="input-field">
                                <option value="">Source node</option>
                                {diagram.nodes.map((node) => (
                                    <option key={`source-${node.id}`} value={node.id}>{node.label || DIAGRAM_NODE_LABELS[node.kind]}</option>
                                ))}
                            </select>

                            <select value={linkTarget} onChange={(event) => setLinkTarget(event.target.value)} className="input-field">
                                <option value="">Target node</option>
                                {diagram.nodes.map((node) => (
                                    <option key={`target-${node.id}`} value={node.id}>{node.label || DIAGRAM_NODE_LABELS[node.kind]}</option>
                                ))}
                            </select>

                            <div className={`rounded-xl border px-3 py-3 ${linkRule.requiresCardinality ? 'border-cyan-400/40 bg-cyan-500/10' : 'border-slate-700 bg-slate-900/40'}`}>
                                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Link rule</p>
                                <p className="mt-1 text-sm text-slate-200">{linkRule.helperText}</p>
                                {linkRule.allowsCardinality ? (
                                    <div className="mt-3 grid grid-cols-2 gap-3">
                                        <select value={linkSourceCardinality} onChange={(event) => setLinkSourceCardinality(event.target.value as CardinalityValue)} className="input-field">
                                            <option value="">Source cardinality</option>
                                            {CARDINALITY_OPTIONS.map((cardinality) => (
                                                <option key={`new-source-${cardinality}`} value={cardinality}>{cardinality}</option>
                                            ))}
                                        </select>
                                        <select value={linkTargetCardinality} onChange={(event) => setLinkTargetCardinality(event.target.value as CardinalityValue)} className="input-field">
                                            <option value="">Target cardinality</option>
                                            {CARDINALITY_OPTIONS.map((cardinality) => (
                                                <option key={`new-target-${cardinality}`} value={cardinality}>{cardinality}</option>
                                            ))}
                                        </select>
                                    </div>
                                ) : (
                                    <p className="mt-3 text-xs text-slate-500">No cardinality input is needed for this link type.</p>
                                )}
                            </div>

                            <button onClick={addEdge} className="btn-primary w-full px-4 py-3 text-sm">
                                Add Link
                            </button>

                            <div className="space-y-2">
                                {diagram.edges.map((edge) => {
                                    const source = diagram.nodes.find((node) => node.id === edge.source);
                                    const target = diagram.nodes.find((node) => node.id === edge.target);
                                    if (!source || !target) return null;

                                    return (
                                        <button
                                            key={edge.id}
                                            onClick={() => {
                                                setSelectedEdgeId(edge.id);
                                                setSelectedNodeId(null);
                                            }}
                                            className={`w-full rounded-xl border px-3 py-2 text-left text-sm ${
                                                selectedEdgeId === edge.id
                                                    ? 'border-indigo-400 bg-indigo-500/10 text-white'
                                                    : 'border-slate-600 bg-slate-800/70 text-slate-300'
                                            }`}
                                        >
                                            {source.label || DIAGRAM_NODE_LABELS[source.kind]} ({edge.sourceCardinality || '-'}) {'->'} {target.label || DIAGRAM_NODE_LABELS[target.kind]} ({edge.targetCardinality || '-'})
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}
            </aside>
    );

    if (isViewerMode) {
        return canvas;
    }

    return (
        <div className={isStudentVariant ? 'grid gap-5 xl:grid-cols-[280px,minmax(0,1fr)]' : 'grid gap-5 xl:grid-cols-[240px,minmax(0,1fr),300px]'}>
            {palette}
            {canvas}
            <div className={isStudentVariant ? 'xl:col-span-2' : ''}>
                {inspector}
            </div>
        </div>
    );
}
