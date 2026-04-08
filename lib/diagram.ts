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

function isEntityLike(kind: DiagramNodeKind) {
    return kind === 'entity' || kind === 'pseudo_entity';
}

function getConnectedEdges(diagram: DiagramModel, nodeId: string) {
    return diagram.edges.filter((edge) => edge.source === nodeId || edge.target === nodeId);
}

function getOtherNode(diagram: DiagramModel, edge: DiagramEdge, nodeId: string) {
    const otherId = edge.source === nodeId ? edge.target : edge.source;
    return diagram.nodes.find((node) => node.id === otherId);
}

export function validateMeriseDiagram(diagramRaw?: DiagramModel | null) {
    const diagram = normalizeDiagram(diagramRaw);
    const issues: string[] = [];

    diagram.nodes.forEach((node) => {
        const label = normalizeText(node.label || '');
        const edges = getConnectedEdges(diagram, node.id);

        if (!label) {
            issues.push(`${DIAGRAM_NODE_LABELS[node.kind]} must have a name.`);
        }

        if (node.kind === 'attribute') {
            if (edges.length !== 1) {
                issues.push(`Attribute "${node.label || 'Unnamed'}" must be linked to exactly one entity or association.`);
            } else {
                const target = getOtherNode(diagram, edges[0], node.id);
                if (!target || !(isEntityLike(target.kind) || target.kind === 'association')) {
                    issues.push(`Attribute "${node.label || 'Unnamed'}" can only connect to an entity, pseudo entity, or association.`);
                }
            }
        }

        if (isEntityLike(node.kind) && edges.length === 0) {
            issues.push(`${DIAGRAM_NODE_LABELS[node.kind]} "${node.label || 'Unnamed'}" must participate in at least one relationship.`);
        }

        if (node.kind === 'association') {
            const targets = edges.map((edge) => getOtherNode(diagram, edge, node.id)).filter(Boolean) as DiagramNode[];
            if (targets.length < 2) {
                issues.push(`Association "${node.label || 'Unnamed'}" must connect to at least two entities.`);
            }
            targets.forEach((target) => {
                if (!isEntityLike(target.kind)) {
                    issues.push(`Association "${node.label || 'Unnamed'}" can only connect to entities or pseudo entities.`);
                }
            });
            edges.forEach((edge) => {
                if (!edge.sourceCardinality || !edge.targetCardinality) {
                    issues.push(`Association "${node.label || 'Unnamed'}" requires cardinalities on both sides of each link.`);
                }
            });
        }

        if (node.kind === 'inheritance') {
            const targets = edges.map((edge) => getOtherNode(diagram, edge, node.id)).filter(Boolean) as DiagramNode[];
            if (targets.length < 2) {
                issues.push(`Inheritance "${node.label || 'Unnamed'}" must connect a parent entity and at least one child entity.`);
            }
            targets.forEach((target) => {
                if (!isEntityLike(target.kind)) {
                    issues.push(`Inheritance "${node.label || 'Unnamed'}" can only connect to entities or pseudo entities.`);
                }
            });
        }
    });

    diagram.edges.forEach((edge) => {
        if (edge.source === edge.target) {
            issues.push('A link cannot connect a node to itself.');
            return;
        }

        const source = diagram.nodes.find((node) => node.id === edge.source);
        const target = diagram.nodes.find((node) => node.id === edge.target);
        if (!source || !target) return;

        const pair = [source.kind, target.kind];
        const involvesAssociation = pair.includes('association');
        const involvesInheritance = pair.includes('inheritance');
        const involvesAttribute = pair.includes('attribute');

        if (isEntityLike(source.kind) && isEntityLike(target.kind)) {
            issues.push(`Entities "${source.label || 'Unnamed'}" and "${target.label || 'Unnamed'}" must not be linked directly without an association or inheritance.`);
        }

        if (involvesAssociation) {
            const other = source.kind === 'association' ? target : source;
            if (!isEntityLike(other.kind)) {
                issues.push(`Association links must connect to entities or pseudo entities only.`);
            }
        }

        if (involvesInheritance) {
            const other = source.kind === 'inheritance' ? target : source;
            if (!isEntityLike(other.kind)) {
                issues.push(`Inheritance links must connect to entities or pseudo entities only.`);
            }
            if (edge.sourceCardinality || edge.targetCardinality) {
                issues.push('Inheritance links must not use cardinalities.');
            }
        }

        if (involvesAttribute) {
            const attributeNode = source.kind === 'attribute' ? source : target;
            const other = attributeNode.id === source.id ? target : source;
            if (!(isEntityLike(other.kind) || other.kind === 'association')) {
                issues.push(`Attribute "${attributeNode.label || 'Unnamed'}" has an invalid target.`);
            }
            if (edge.sourceCardinality || edge.targetCardinality) {
                issues.push('Attribute links must not use cardinalities.');
            }
        }

        if (!involvesAssociation && !involvesInheritance && !involvesAttribute && (edge.sourceCardinality || edge.targetCardinality)) {
            issues.push('Cardinalities are only valid on association links.');
        }
    });

    return Array.from(new Set(issues));
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
    const meriseIssues = validateMeriseDiagram(submitted);

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

    const matchedNodes = Math.max(expected.nodes.length - nodeDiff.missing.length, 0);
    const matchedAttributes = Math.max(expected.nodes.length - attributeDiff.missing.length, 0);
    const matchedEdges = Math.max(expected.edges.length - edgeDiff.missing.length, 0);
    const totalItems = Math.max(expected.nodes.length + expected.edges.length + expected.nodes.length, 1);
    const matchedItems = matchedNodes + matchedAttributes + matchedEdges;

    const details: DiagramGradeDetails = {
        matchedItems,
        totalItems,
        missingNodes: nodeDiff.missing,
        extraNodes: nodeDiff.extra,
        missingAttributes: attributeDiff.missing,
        extraAttributes: attributeDiff.extra,
        missingLinks: baseEdgeDiff.missing,
        extraLinks: baseEdgeDiff.extra,
        cardinalityMismatches,
        meriseIssues,
    };

    const feedback = [
        ...details.missingNodes.map((value) => `Missing element: ${value}`),
        ...details.extraNodes.map((value) => `Unexpected element: ${value}`),
        ...details.missingAttributes.map((value) => `Missing attribute set: ${value}`),
        ...details.extraAttributes.map((value) => `Unexpected attribute set: ${value}`),
        ...details.missingLinks.map((value) => `Missing link: ${value}`),
        ...details.extraLinks.map((value) => `Unexpected link: ${value}`),
        ...details.cardinalityMismatches.map((value) => `Cardinality mismatch: ${value}`),
        ...details.meriseIssues.map((value) => `Merise rule: ${value}`),
    ];

    const structurePenalty = Math.min(details.meriseIssues.length * 0.08, 0.5);
    const rawRatio = matchedItems / totalItems;
    const ratio = Math.max(0, rawRatio - structurePenalty);

    return {
        details,
        feedback,
        ratio,
    };
}
