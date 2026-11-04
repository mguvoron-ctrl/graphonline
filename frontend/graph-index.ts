export interface Vertex { id: string | number }
export interface Edge<V extends Vertex> {
  vertex1: V;
  vertex2: V;
  isDirect: boolean;
  GetWeight(): number;
}
interface Connection<E> { first: E; minimum?: E; weight: number }

// An operation-scoped index. Legacy plugins can still mutate their graph directly;
// no persistent cache can silently survive such a mutation.
export class GraphIndex<V extends Vertex, E extends Edge<V>> {
  private vertices = new Map<string, V>();
  private order = new Map<string, number>();
  private adjacency = new Map<string, Map<string, Connection<E>>>();
  private orderedNeighbors = new Map<string, readonly {vertex: V; edge: E}[]>();
  constructor(vertices: readonly V[], edges: readonly E[]) {
    vertices.forEach((vertex, index) => {
      this.vertices.set(String(vertex.id), vertex);
      this.order.set(String(vertex.id), index);
    });
    for (const edge of edges) {
      const from = String(edge.vertex1.id), to = String(edge.vertex2.id);
      if (!this.vertices.has(from) || !this.vertices.has(to)) continue;
      const weight = edge.GetWeight();
      this.connect(from, to, edge, weight);
      if (!edge.isDirect && from !== to) this.connect(to, from, edge, weight);
    }
  }
  private connect(from: string, to: string, edge: E, weight: number): void {
    let row = this.adjacency.get(from);
    if (!row) { row = new Map(); this.adjacency.set(from, row); }
    const existing = row.get(to);
    if (!existing) row.set(to, {first: edge, minimum: weight < Infinity ? edge : undefined, weight: weight < Infinity ? weight : Infinity});
    else if (weight < existing.weight) { existing.weight = weight; existing.minimum = edge; }
  }
  minimum(from: string | number, to: string | number): E | undefined {
    return this.adjacency.get(String(from))?.get(String(to))?.minimum;
  }
  neighbors(id: string | number): readonly {vertex: V; edge: E}[] {
    const key = String(id);
    let result = this.orderedNeighbors.get(key);
    if (!result) {
      const ordered = Array.from(this.adjacency.get(key) || [], ([target, value]) => ({vertex: this.vertices.get(target)!, edge: value.first}));
      // Keep the editor's established traversal order (vertex order, not edge insertion order).
      ordered.sort((a, b) => this.order.get(String(a.vertex.id))! - this.order.get(String(b.vertex.id))!);
      result = ordered;
      this.orderedNeighbors.set(key, result);
    }
    return result;
  }
}

export interface TraversalStep<V, E> { vertex: V; edge?: E }

// Store one visit per step instead of copying the entire visited set at every step.
export function traversalSteps<V extends Vertex, E extends Edge<V>>(
  index: GraphIndex<V, E>, start: V, depthFirst = false
): TraversalStep<V, E>[] {
  const steps: TraversalStep<V, E>[] = [{vertex: start}];
  const seen = new Set([String(start.id)]);
  const frontier = [{vertex: start, next: 0}];
  let head = 0;
  while (depthFirst ? frontier.length > 0 : head < frontier.length) {
    const frame = frontier[depthFirst ? frontier.length - 1 : head];
    const neighbors = index.neighbors(frame.vertex.id);
    if (frame.next >= neighbors.length) {
      if (depthFirst) frontier.pop(); else head++;
      continue;
    }
    const visit = neighbors[frame.next++];
    if (seen.has(String(visit.vertex.id))) continue;
    seen.add(String(visit.vertex.id));
    steps.push(visit);
    frontier.push({vertex: visit.vertex, next: 0});
  }
  return steps;
}
