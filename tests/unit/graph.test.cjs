const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'); const vm = require('node:vm');
function model() {
  const ctx = vm.createContext({ console: {log(){}}, RegisterAlgorithm(){},
    BaseAlgorithm: function(graph, app){this.graph=graph;this.app=app;} });
  vm.runInContext(fs.readFileSync('script/dist/core.js', 'utf8'), ctx);
  for (const file of ['script/entities/graph/model/Graph.js', 'script/pages/editor/model/texts.js',
    'script/features/algorithms/model/plugins/VerticesDegree.js', 'script/features/algorithms/model/plugins/Floid.js']) {
    ctx.BaseAlgorithmEx = ctx.BaseAlgorithm;
    vm.runInContext(fs.readFileSync(file, 'utf8'), ctx);
  }
  return ctx;
}
function graph(ctx, count, edges=[]) {
  const g=new ctx.Graph();
  for(let i=0;i<count;i++)g.AddNewVertex({SetId(id){this.id=id;},mainText:String(i)});
  g.edges=edges.map(([a,b,weight,directed=false])=>({vertex1:g.vertices[a],vertex2:g.vertices[b],weight,isDirect:directed,GetWeight(){return weight;}}));
  return g;
}
test('vertex limit and matrix validation reject out-of-domain input',()=>{
  const ctx=model(),g=graph(ctx,1002);
  assert.equal(g.vertices.length,1000);
  assert.equal(g.TestAdjacencyMatrix('0,--\n1,0',{},{}),false);
  assert.equal(g.TestAdjacencyMatrix('0,0.5\n-2,0',{},{}),true);
});
test('large finite weights remain reachable',()=>{
  const ctx=model(),g=graph(ctx,2,[[0,1,100000000]]);
  assert.equal(g.FindEdgeMin(0,1).GetWeight(),100000000);
});
test('degree one is reflected in the graph maximum',()=>{
  const ctx=model(),g=graph(ctx,2,[[0,1,1]]),algorithm=new ctx.VerticesDegree(g,{});
  algorithm.result();assert.equal(algorithm.maxDegree,1);
});
test('Floyd preserves zero self-distances and unreachable pairs with negative edges',()=>{
  const ctx=model();
  const matrix=new ctx.FloidAlgorithm(graph(ctx,2,[[0,1,3]]),{}).resultMatrix();
  assert.equal(matrix[0][0],0);assert.equal(matrix[0][1],3);
  const disconnected=new ctx.FloidAlgorithm(graph(ctx,3,[[0,1,-5,true]]),{}).resultMatrix();
  assert.equal(disconnected[2][1],Infinity);
});
test('negative cycles are reported instead of returning misleading distances',()=>{
  const ctx=model();
  assert.throws(()=>new ctx.FloidAlgorithm(graph(ctx,2,[[0,1,-1]]),{}).resultMatrix(),/Negative cycle/);
});
test('matrix construction does not rescan edge endpoints for every vertex pair',()=>{
  const ctx=model(),g=graph(ctx,30);let reads=0;
  for(let i=0;i<30;i++)for(let jump=1;jump<=3;jump++)g.edges.push({
    get vertex1(){reads++;return g.vertices[i];},get vertex2(){reads++;return g.vertices[(i+jump)%30];},
    isDirect:true,GetWeight(){return jump;}
  });
  const matrix=g.GetAdjacencyMatrix();
  assert.equal(matrix[0][1],1);assert.equal(matrix[0][4],Infinity);
  assert.ok(reads<=g.edges.length*10,'edge scans must scale with edges, not all vertex pairs');
});
test('operation-scoped indices see legacy weight and direction changes',()=>{
  const ctx=model(),g=graph(ctx,2,[[0,1,7,true],[0,1,3,true]]);
  assert.equal(g.GetAdjacencyMatrix()[0][1],3);
  g.edges[0].weight=1;g.edges[0].GetWeight=function(){return this.weight;};g.edges[0].isDirect=false;
  const matrix=g.GetAdjacencyMatrix();assert.equal(matrix[0][1],1);assert.equal(matrix[1][0],1);
});
