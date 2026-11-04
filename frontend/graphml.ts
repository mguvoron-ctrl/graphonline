export interface ImportedGraph {
  nodes: Element[];
  edges: { element: Element; source: string; target: string; weight: number; weighted: boolean; id: string }[];
  nextVertex: number;
  nextEdge: number;
  directed: boolean;
  additional: string;
}

export function parseGraphML(text: string): ImportedGraph {
  if (text.length > 2 * 1024 * 1024 || /<!DOCTYPE|<!ENTITY/i.test(text)) throw new Error('Invalid graph document');
  const xml = new DOMParser().parseFromString(text, 'application/xml');
  if (xml.querySelector('parsererror') || xml.documentElement.localName !== 'graphml') throw new Error('Invalid GraphML');
  const children = (element: Element, name: string) => Array.from(element.children).filter(e => e.localName === name);
  const graphs = children(xml.documentElement, 'graph');
  if (graphs.length !== 1) throw new Error('Expected one graph');
  const graph = graphs[0];
  const keys = children(xml.documentElement, 'key');
  const data = (element: Element, name: string): string | undefined => {
    const key = keys.find(key => key.getAttribute('attr.name') === name);
    return key ? children(element, 'data').find(value => value.getAttribute('key') === key.id)?.textContent ?? undefined : undefined;
  };
  const metadata = (element: Element, name: string, allowed: string[]) => {
    const raw = data(element, name);
    if (!raw) return;
    const record: unknown = JSON.parse(raw);
    if (!record || typeof record !== 'object' || Array.isArray(record)) throw new Error('Invalid graph metadata');
    for (const [key, value] of Object.entries(record)) if (allowed.includes(key) && typeof value === 'string') element.setAttribute(key, value);
  };
  metadata(graph, 'graphonline.graph', ['uidGraph','uidEdge']);
  const nodes = children(graph, 'node');
  const edgeElements = children(graph, 'edge');
  if (nodes.length > 1000 || edgeElements.length > 10000) throw new Error('Graph exceeds limits');
  const ids = new Set<string>();
  const mapping = new Map<string, string>();
  const used = new Set(nodes.map(node=>node.getAttribute('id')!).filter(id=>/^(?:0|[1-9]\d*)$/.test(id) && Number(id)<10000));
  let available = 0;
  let nextVertex = 0;
  for (const node of nodes) {
    metadata(node, 'graphonline.node', ['upText','ownStyles','size']);
    for (const [key, attribute] of [['label','mainText'],['x','positionX'],['y','positionY']]) {
      const value = data(node, key);
      if (value !== undefined) node.setAttribute(attribute, value);
    }
    const id = node.getAttribute('id');
    if (!id || ids.has(id)) throw new Error('Missing or duplicate vertex identifier');
    ids.add(id);
    let canonical = id;
    if (!used.has(id)) { while (used.has(String(available))) available++; canonical=String(available++); used.add(canonical); }
    mapping.set(id, canonical);
    if (!node.hasAttribute('mainText')) node.setAttribute('mainText',id);
    node.setAttribute('id',canonical);
    nextVertex = Math.max(nextVertex, Number(canonical) + 1);
  }
  const weightKey = keys.find(key => key.getAttribute('attr.name') === 'weight' && ['edge', 'all'].includes(key.getAttribute('for') || 'all'));
  const edgeIds = new Set<string>();
  let nextEdge = 10000;
  for (const edge of edgeElements) {
    const id = edge.getAttribute('id');
    if (id) {
      if (edgeIds.has(id)) throw new Error('Duplicate edge identifier');
      edgeIds.add(id);
      if (/^\d+$/.test(id) && Number.isSafeInteger(Number(id)) && Number(id)<2147483647) nextEdge = Math.max(nextEdge, Number(id) + 1);
    }
  }
  const edges = edgeElements.map(element => {
    metadata(element, 'graphonline.edge', ['text','upText','arrayStyleStart','arrayStyleFinish','ownStyles','model_width','model_type','model_curveValue','model_default']);
    const originalSource = element.getAttribute('source') ?? element.getAttribute('vertex1') ?? element.getAttribute('graph1') ?? '';
    const originalTarget = element.getAttribute('target') ?? element.getAttribute('vertex2') ?? element.getAttribute('graph2') ?? '';
    if (!ids.has(originalSource) || !ids.has(originalTarget)) throw new Error('Unknown edge endpoint');
    const source = mapping.get(originalSource)!, target = mapping.get(originalTarget)!;
    element.setAttribute('source',source); element.setAttribute('target',target);
    element.removeAttribute('vertex1'); element.removeAttribute('vertex2');
    const standardWeight = weightKey && children(element, 'data').find(data => data.getAttribute('key') === weightKey.id)?.textContent;
    const raw = element.getAttribute('weight') ?? standardWeight ?? (weightKey && children(weightKey, 'default')[0]?.textContent) ?? null;
    const weight = raw === null ? 1 : Number(raw);
    if (!Number.isFinite(weight)) throw new Error('Invalid edge weight');
    let id = element.getAttribute('id');
    if (!id || !/^\d+$/.test(id) || Number(id)<10000 || Number(id)>=2147483647) {
      while (edgeIds.has(String(nextEdge))) nextEdge++;
      id = String(nextEdge++); edgeIds.add(id);
    }
    element.setAttribute('id',id);
    return { element, source, target, id, weight, weighted: element.hasAttribute('useWeight') ? element.getAttribute('useWeight') === 'true' : raw !== null };
  });
  const savedVertex = Number(graph.getAttribute('uidGraph'));
  const savedEdge = Number(graph.getAttribute('uidEdge'));
  if (Number.isSafeInteger(savedVertex) && savedVertex<10000) nextVertex = Math.max(nextVertex, savedVertex);
  if (Number.isSafeInteger(savedEdge) && savedEdge<2147483647) nextEdge = Math.max(nextEdge, savedEdge);
  return { nodes, edges, nextVertex, nextEdge, directed: graph.getAttribute('edgedefault') === 'directed',
    additional: data(graph, 'graphonline.settings') ?? children(xml.documentElement, 'additional')[0]?.getAttribute('data') ?? '' };
}

// Standards-based export, with presentation fields stored in explicitly named extension keys.
export function exportGraphML(text: string): string {
  const imported = parseGraphML(text);
  const namespace = 'http://graphml.graphdrawing.org/xmlns';
  const xml = document.implementation.createDocument(namespace, 'graphml', null);
  const root = xml.documentElement;
  const create = (name: string, attributes: Record<string, string> = {}) => {
    const element = xml.createElementNS(namespace, name);
    for (const [key,value] of Object.entries(attributes)) element.setAttribute(key,value);
    return element;
  };
  const definitions = [ ['weight','edge','double'], ['label','node','string'], ['x','node','double'], ['y','node','double'],
    ['graphonline.node','node','string'], ['graphonline.edge','edge','string'], ['graphonline.graph','graph','string'], ['graphonline.settings','graph','string'] ];
  for (const [name, scope, type] of definitions) root.append(create('key', {id:name,for:scope,'attr.name':name,'attr.type':type}));
  const add = (element: Element, key: string, value: string) => {
    const field = create('data',{key}); field.textContent = value; element.append(field);
  };
  const attributes = (element: Element, names: string[]) => JSON.stringify(Object.fromEntries(names.filter(name=>element.hasAttribute(name)).map(name=>[name,element.getAttribute(name)])));
  const graph = create('graph',{id:'Graph',edgedefault:imported.directed?'directed':'undirected'});
  root.append(graph);
  add(graph,'graphonline.graph',JSON.stringify({uidGraph:String(imported.nextVertex),uidEdge:String(imported.nextEdge)}));
  add(graph,'graphonline.settings',imported.additional);
  for (const node of imported.nodes) {
    const element=create('node',{id:node.getAttribute('id')!});
    add(element,'label',node.getAttribute('mainText') ?? node.getAttribute('id')!);
    for (const [key,attribute] of [['x','positionX'],['y','positionY']]) {
      const value=node.getAttribute(attribute); if (value!==null && Number.isFinite(Number(value))) add(element,key,value);
    }
    add(element,'graphonline.node',attributes(node,['upText','ownStyles','size'])); graph.append(element);
  }
  for (const record of imported.edges) {
    const directed=record.element.getAttribute('directed') ?? record.element.getAttribute('isDirect') ?? String(imported.directed);
    const element=create('edge',{id:record.id,source:record.source,target:record.target,directed});
    add(element,'weight',String(record.weighted?record.weight:1));
    add(element,'graphonline.edge',attributes(record.element,['text','upText','arrayStyleStart','arrayStyleFinish','ownStyles','model_width','model_type','model_curveValue','model_default']));
    graph.append(element);
  }
  return '<?xml version="1.0" encoding="UTF-8"?>\n'+new XMLSerializer().serializeToString(xml);
}
