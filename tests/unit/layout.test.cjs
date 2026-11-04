const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const context=vm.createContext({});vm.runInContext(fs.readFileSync('script/dist/core.js','utf8'),context);
const {initialLayout}=context.GraphOnline;
const messages=[],worker=vm.createContext({postMessage:message=>messages.push(message)});
vm.runInContext(fs.readFileSync('script/dist/layout-worker.js','utf8'),worker);
function forceLayout(input,progress=()=>{}) {
  messages.length=0;worker.onmessage({data:input});
  for(const message of messages){if(message.error)throw new Error(message.error);if(message.progress!==undefined)progress(message.progress);}
  return messages.find(message=>message.positions).positions;
}
const graph=(count=5)=>({width:640,height:480,nodes:Array.from({length:count},(_,i)=>({id:String(i),x:100,y:100,diameter:30,fixed:false})),
  edges:Array.from({length:Math.max(0,count-1)},(_,i)=>({source:String(i),target:String(i+1)}))});
const plain=value=>JSON.parse(JSON.stringify(value));

test('layout is deterministic, preserves the input and fits movable vertices in the viewport',()=>{
  const input=graph(),before=structuredClone(input),progress=[];
  const result=forceLayout(input,value=>progress.push(value));
  assert.deepEqual(plain(result),plain(forceLayout(input)));
  assert.deepEqual(input,before);assert.equal(result.length,5);assert.equal(progress.at(-1),100);
  assert.ok(result.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.x<=640&&p.y>=0&&p.y<=480));
  assert.equal(new Set(result.map(p=>`${p.x},${p.y}`)).size,5);
});
test('partial layout never returns positions for fixed anchors, including coincident nodes',()=>{
  const input=graph(3);input.nodes[0].fixed=true;input.nodes[0].x=320;input.nodes[0].y=30;
  const result=forceLayout(input);
  assert.deepEqual(Array.from(result,p=>p.id),['1','2']);
  assert.ok(result.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)));
  assert.equal(input.nodes[0].x,320);assert.equal(input.nodes[0].y,30);
});
test('empty, singleton, fixed-only, loops and parallel edges have finite bounded results',()=>{
  assert.deepEqual(plain(forceLayout(graph(0))),[]);
  assert.deepEqual(plain(forceLayout(graph(1))),[{id:'0',x:320,y:240}]);
  const fixed=graph();fixed.nodes.forEach(n=>n.fixed=true);assert.equal(forceLayout(fixed).length,0);
  const input=graph(3),reference=forceLayout(input);
  input.edges.push(...input.edges,{source:'0',target:'0'});
  assert.deepEqual(plain(forceLayout(input)),plain(reference));
  assert.ok(initialLayout({...graph(1000),width:1,height:1}).every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)));
});
test('layout rejects malformed graphs and non-finite geometry',()=>{
  assert.throws(()=>forceLayout({...graph(),width:NaN}),/Invalid layout/);
  const duplicate=graph();duplicate.nodes[1].id='0';assert.throws(()=>forceLayout(duplicate),/Invalid layout/);
  const orphan=graph();orphan.edges.push({source:'0',target:'missing'});assert.throws(()=>forceLayout(orphan),/Invalid layout/);
  const invalid=graph();invalid.nodes[0].x=Infinity;assert.throws(()=>forceLayout(invalid),/Invalid layout/);
});
test('layout runner rejects incomplete results and ignores late results from a cancelled worker',async()=>{
  class Worker {
    static instances=[];
    constructor(){Worker.instances.push(this);}
    terminate(){this.terminated=true;} postMessage(){}
    send(data){this.onmessage({data});}
  }
  const realm=vm.createContext({Worker,DOMException,setTimeout,clearTimeout});
  vm.runInContext(fs.readFileSync('script/dist/core.js','utf8'),realm);
  const runner=new realm.GraphOnline.LayoutRunner('/layout.js'),input=graph(1);
  const first=runner.run(input);assert.equal(runner.busy,true);
  const firstRejected=assert.rejects(first,{name:'AbortError'});
  const second=runner.run(input),old=Worker.instances[0],current=Worker.instances[1];
  old.send({positions:[{id:'0',x:999,y:999}]});
  current.send({positions:[{id:'0',x:12,y:34}]});
  await firstRejected;assert.deepEqual(await second,[{id:'0',x:12,y:34}]);
  assert.equal(runner.busy,false);assert.equal(old.terminated,true);assert.equal(current.terminated,true);
  const malformed=runner.run(input);Worker.instances[2].send({positions:[]});await assert.rejects(malformed,/Incomplete layout/);
  const invalid=runner.run(input);Worker.instances[3].send({positions:[{id:'0',x:NaN,y:0}]});await assert.rejects(invalid,/Invalid layout/);
});
