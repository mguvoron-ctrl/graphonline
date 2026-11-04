const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const context=vm.createContext({});vm.runInContext(fs.readFileSync('script/dist/core.js','utf8'),context);
const {GraphIndex,traversalSteps}=context.GraphOnline;
const vertices=['a','b','c','d','isolated'].map(id=>({id}));
const edge=(from,to,weight,directed=true,id='')=>({vertex1:vertices[from],vertex2:vertices[to],isDirect:directed,id,GetWeight(){return weight;}});
const edges=[edge(0,2,3,true,'ac'),edge(0,1,10,true,'ab-first'),edge(0,1,-2,true,'ab-min'),edge(1,3,0,false,'bd'),edge(3,3,1,false,'loop'),edge(2,0,5,true,'ca')];

test('index distinguishes direction, parallel edges, first edge and minimum weight',()=>{
  const index=new GraphIndex(vertices,edges);
  assert.equal(index.minimum('a','b').id,'ab-min');
  assert.equal(index.minimum('b','a'),undefined);
  assert.equal(index.minimum('d','b').id,'bd');
  assert.deepEqual(Array.from(index.neighbors('a'),neighbor=>neighbor.edge.id),['ab-first','ac']);
  assert.deepEqual(Array.from(index.neighbors('d'),neighbor=>neighbor.vertex.id),['b','d']);
  assert.equal(index.neighbors('isolated').length,0);
});
test('compact BFS/DFS steps retain established vertex order and traversed edges',()=>{
  const index=new GraphIndex(vertices,edges);
  const bfs=traversalSteps(index,vertices[0]),dfs=traversalSteps(index,vertices[0],true);
  assert.deepEqual(Array.from(bfs,step=>step.vertex.id),['a','b','c','d']);
  assert.deepEqual(Array.from(dfs,step=>step.vertex.id),['a','b','d','c']);
  assert.deepEqual(Array.from(bfs,step=>step.edge?.id),[undefined,'ab-first','ac','bd']);
  assert.equal(bfs.length,4);
});
test('indexed traversals agree with independent queue/recursive references',()=>{
  let seed=42;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed;};
  for(let sample=0;sample<20;sample++){
    const nodes=Array.from({length:12},(_,id)=>({id})),links=[];
    for(let i=0;i<35;i++)links.push({vertex1:nodes[random()%12],vertex2:nodes[random()%12],isDirect:!!(random()%2),GetWeight(){return 1;}});
    const neighbors=vertex=>nodes.filter(other=>links.some(link=>link.vertex1===vertex&&link.vertex2===other||!link.isDirect&&link.vertex2===vertex&&link.vertex1===other));
    const breadth=[nodes[0]],seenBreadth=new Set(breadth);
    for(let i=0;i<breadth.length;i++)for(const next of neighbors(breadth[i]))if(!seenBreadth.has(next)){seenBreadth.add(next);breadth.push(next);}
    const depth=[],seenDepth=new Set();
    function visit(vertex){seenDepth.add(vertex);depth.push(vertex);for(const next of neighbors(vertex))if(!seenDepth.has(next))visit(next);}
    visit(nodes[0]);const index=new GraphIndex(nodes,links);
    assert.deepEqual(Array.from(traversalSteps(index,nodes[0]),step=>step.vertex.id),breadth.map(vertex=>vertex.id));
    assert.deepEqual(Array.from(traversalSteps(index,nodes[0],true),step=>step.vertex.id),depth.map(vertex=>vertex.id));
  }
});
