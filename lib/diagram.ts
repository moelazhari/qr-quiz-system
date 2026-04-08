import {
    DiagramActionEvent,
    DiagramActionType,
    DiagramEdge,
    DiagramGradeDetails,
    DiagramModel,
    DiagramNode,
    DiagramNodeKind,
    DiagramVectorSnapshot,
} from '@/types';

export const DIAGRAM_NODE_LABELS: Record<DiagramNodeKind, string> = {
    entity: 'Entity',
    pseudo_entity: 'Pseudo Entity',
    attribute: 'Attribute',
    association: 'Association',
    inheritance: 'Inheritance',
};

export function createEmptyDiagram(): DiagramModel {
    return { nodes: [], edges: [], actionLog: [] };
}

export function createDiagramNode(kind: DiagramNodeKind, x: number, y: number): DiagramNode {
    return {
        id: `${kind}-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
        kind,
        label: DIAGRAM_NODE_LABELS[kind],
        x,
        y,
        attributes: kind === 'entity' || kind === 'pseudo_entity' ? [] : undefined,
    };
}

export function normalizeDiagram(diagram?: DiagramModel | null): DiagramModel {
    const nodes = Array.isArray(diagram?.nodes)
        ? diagram!.nodes.map((node) => ({
            id: String(node.id),
            kind: (node.kind || 'entity') as DiagramNodeKind,
            label: String(node.label || ''),
            x: Number.isFinite(node.x) ? Number(node.x) : 40,
            y: Number.isFinite(node.y) ? Number(node.y) : 40,
            attributes: Array.isArray(node.attributes)
                ? node.attributes.map((attribute) => String(attribute)).filter(Boolean)
                : [],
        }))
        : [];

    const nodeIds = new Set(nodes.map((node) => node.id));
    const edges = Array.isArray(diagram?.edges)
        ? diagram!.edges
            .map((edge) => ({
                id: String(edge.id),
                source: String(edge.source || ''),
                target: String(edge.target || ''),
                sourceCardinality: edge.sourceCardinality,
                targetCardinality: edge.targetCardinality,
            }))
            .filter((edge) => edge.source && edge.target && nodeIds.has(edge.source) && nodeIds.has(edge.target))
        : [];

    const actionLog = Array.isArray(diagram?.actionLog)
        ? diagram!.actionLog.map((event) => ({
            id: String(event.id),
            type: event.type as DiagramActionType,
            timestamp: String(event.timestamp || new Date().toISOString()),
            subjectId: String(event.subjectId || ''),
            summary: String(event.summary || ''),
            vectors: Array.isArray(event.vectors)
                ? event.vectors.map((vector) => ({
                    subjectType: vector.subjectType,
                    subjectId: String(vector.subjectId || ''),
                    vector: String(vector.vector || ''),
                }))
                : [],
        }))
        : [];

    return { nodes, edges, actionLog };
}

function normalizeText(value: string) {
    return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function normalizeAttributes(node: DiagramNode) {
    return Array.from(new Set((node.attributes || []).map((attribute) => normalizeText(attribute)).filter(Boolean))).sort();
}

function nodeVector(node: DiagramNode) {
    return `${node.kind}:${normalizeText(node.label)}`;
}

function nodeVectorWithAttributes(node: DiagramNode) {
    return `${nodeVector(node)}:${normalizeAttributes(node).join('|')}`;
}

function findNodeById(nodes: DiagramNode[], id: string) {
    return nodes.find((node) => node.id === id);
}

function edgeBaseVector(edge: DiagramEdge, nodes: DiagramNode[]) {
    const source = findNodeById(nodes, edge.source);
    const target = findNodeById(nodes, edge.target);
    if (!source || !target) return '';

    const endpoints = [nodeVector(source), nodeVector(target)].sort();
    return endpoints.join(' <-> ');
}

function edgeVector(edge: DiagramEdge, nodes: DiagramNode[]) {
    const base = edgeBaseVector(edge, nodes);
    if (!base) return '';

    const cards = [edge.sourceCardinality || '-', edge.targetCardinality || '-'].sort().join(':');
    return `${base} [${cards}]`;
}

function scoreRatio(matched: number, expected: number) {
    if (expected <= 0) return 1;
    return Math.max(0, Math.min(1, matched / expected));
}

export function describeNodeVector(node: DiagramNode) {
    return `${nodeVector(node)}:${normalizeAttributes(node).join('|')}`;
}

export function describeEdgeVector(edge: DiagramEdge, nodes: DiagramNode[]) {
    return edgeVector(edge, nodes);
}

export function createDiagramActionEvent(
    type: DiagramActionType,
    subjectId: string,
    summary: string,
    vectors: DiagramVectorSnapshot[]
): DiagramActionEvent {
    return {
        id: `event-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
        type,
        timestamp: new Date().toISOString(),
        subjectId,
        summary,
        vectors,
    };
}

export function appendDiagramActionEvent(diagram: DiagramModel, event: DiagramActionEvent): DiagramModel {
    const normalized = normalizeDiagram(diagram);
    return {
        ...normalized,
        actionLog: [...(normalized.actionLog || []), event],
    };
}

export function getMeriseLinkRule(sourceKind?: DiagramNodeKind, targetKind?: DiagramNodeKind) {
    if (!sourceKind || !targetKind) {
        return {
            allowsCardinality: true,
            requiresCardinality: false,
            helperText: 'Cardinalities are optional. Add them only if you want them shown on the link.',
        };
    }

    if (sourceKind === 'association' || targetKind === 'association') {
        return {
            allowsCardinality: true,
            requiresCardinality: false,
            helperText: 'Association links often use cardinalities, but they are optional in this editor.',
        };
    }

    if (sourceKind === 'inheritance' || targetKind === 'inheritance') {
        return {
            allowsCardinality: true,
            requiresCardinality: false,
            helperText: 'Cardinalities are optional here too. Leave them empty unless you want to show them.',
        };
    }

    if (sourceKind === 'attribute' || targetKind === 'attribute') {
        return {
            allowsCardinality: true,
            requiresCardinality: false,
            helperText: 'Cardinalities are optional here too. Leave them empty unless you want to show them.',
        };
    }

    return {
        allowsCardinality: true,
        requiresCardinality: false,
        helperText: 'Cardinalities are optional. Use them only if needed for the question.',
    };
}

function countItems(values: string[]) {
    const counts = new Map<string, number>();
    values.forEach((value) => {
        if (!value) return;
        counts.set(value, (counts.get(value) || 0) + 1);
    });
    return counts;
}

function diffCounts(expected: Map<string, number>, actual: Map<string, number>) {
    const missing: string[] = [];
    const extra: string[] = [];

    expected.forEach((count, value) => {
        const actualCount = actual.get(value) || 0;
        if (count > actualCount) {
            for (let index = 0; index < count - actualCount; index += 1) {
                missing.push(value);
            }
        }
    });

    actual.forEach((count, value) => {
        const expectedCount = expected.get(value) || 0;
        if (count > expectedCount) {
            for (let index = 0; index < count - expectedCount; index += 1) {
                extra.push(value);
            }
        }
    });

    return { missing, extra };
}

export function gradeDiagramAnswer(expectedRaw?: DiagramModel | null, submittedRaw?: DiagramModel | null) {
    const expected = normalizeDiagram(expectedRaw);
    const submitted = normalizeDiagram(submittedRaw);

    const expectedNodeCounts = countItems(expected.nodes.map(nodeVector));
    const submittedNodeCounts = countItems(submitted.nodes.map(nodeVector));
    const expectedAttributeCounts = countItems(expected.nodes.map(nodeVectorWithAttributes));
    const submittedAttributeCounts = countItems(submitted.nodes.map(nodeVectorWithAttributes));
    const expectedEdgeCounts = countItems(expected.edges.map((edge) => edgeVector(edge, expected.nodes)));
    const submittedEdgeCounts = countItems(submitted.edges.map((edge) => edgeVector(edge, submitted.nodes)));

    const nodeDiff = diffCounts(expectedNodeCounts, submittedNodeCounts);
    const attributeDiff = diffCounts(expectedAttributeCounts, submittedAttributeCounts);
    const edgeDiff = diffCounts(expectedEdgeCounts, submittedEdgeCounts);

    const expectedBaseEdges = countItems(expected.edges.map((edge) => edgeBaseVector(edge, expected.nodes)));
    const submittedBaseEdges = countItems(submitted.edges.map((edge) => edgeBaseVector(edge, submitted.nodes)));
    const baseEdgeDiff = diffCounts(expectedBaseEdges, submittedBaseEdges);

    const cardinalityMismatches = edgeDiff.missing.filter((missingEdge) => {
        const base = missingEdge.replace(/\s\[[^\]]+\]$/, '');
        return !baseEdgeDiff.missing.includes(base);
    });

    const expectedAttributeCount = expected.nodes.filter((node) => (node.attributes || []).length > 0).length;
    const expectedCardinalityCount = expected.edges.filter((edge) => edge.sourceCardinality || edge.targetCardinality).length;
    const matchedNodes = Math.max(expected.nodes.length - nodeDiff.missing.length, 0);
    const matchedAttributes = Math.max(expectedAttributeCount - attributeDiff.missing.length, 0);
    const matchedLinks = Math.max(expected.edges.length - baseEdgeDiff.missing.length, 0);
    const matchedCardinalities = Math.max(expectedCardinalityCount - cardinalityMismatches.length, 0);
    const totalItems = Math.max(expected.nodes.length + expectedAttributeCount + expected.edges.length + expectedCardinalityCount, 1);
    const matchedItems = matchedNodes + matchedAttributes + matchedLinks + matchedCardinalities;

    const nodeScore = scoreRatio(matchedNodes, expected.nodes.length);
    const attributeScore = scoreRatio(matchedAttributes, expectedAttributeCount);
    const linkScore = scoreRatio(matchedLinks, expected.edges.length);
    const cardinalityScore = scoreRatio(matchedCardinalities, expectedCardinalityCount);

    const weightedRatio = (
        nodeScore * 0.35 +
        attributeScore * 0.2 +
        linkScore * 0.3 +
        cardinalityScore * 0.15
    );

    const details: DiagramGradeDetails = {
        matchedItems,
        totalItems,
        nodeScore,
        attributeScore,
        linkScore,
        cardinalityScore,
        matchedNodeCount: matchedNodes,
        expectedNodeCount: expected.nodes.length,
        matchedAttributeCount: matchedAttributes,
        expectedAttributeCount,
        matchedLinkCount: matchedLinks,
        expectedLinkCount: expected.edges.length,
        matchedCardinalityCount: matchedCardinalities,
        expectedCardinalityCount,
        missingNodes: nodeDiff.missing,
        extraNodes: nodeDiff.extra,
        missingAttributes: attributeDiff.missing,
        extraAttributes: attributeDiff.extra,
        missingLinks: baseEdgeDiff.missing,
        extraLinks: baseEdgeDiff.extra,
        cardinalityMismatches,
        meriseIssues: [],
    };

    const feedback = [
        `Node match: ${matchedNodes}/${expected.nodes.length || 0}`,
        `Attribute match: ${matchedAttributes}/${expectedAttributeCount}`,
        `Link match: ${matchedLinks}/${expected.edges.length || 0}`,
        `Cardinality match: ${matchedCardinalities}/${expectedCardinalityCount}`,
        ...details.missingNodes.map((value) => `Missing element: ${value}`),
        ...details.extraNodes.map((value) => `Unexpected element: ${value}`),
        ...details.missingAttributes.map((value) => `Missing attribute set: ${value}`),
        ...details.extraAttributes.map((value) => `Unexpected attribute set: ${value}`),
        ...details.missingLinks.map((value) => `Missing link: ${value}`),
        ...details.extraLinks.map((value) => `Unexpected link: ${value}`),
        ...details.cardinalityMismatches.map((value) => `Cardinality mismatch: ${value}`),
    ];

    return {
        details,
        feedback,
        ratio: weightedRatio,
    };
}
