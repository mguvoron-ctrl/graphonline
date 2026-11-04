const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const realm=vm.createContext({setTimeout,clearTimeout});
vm.runInContext(fs.readFileSync('script/dist/core.js','utf8'),realm);
const {FrameScheduler,Autosave,wheelZoomFactor,clampZoom}=realm.GraphOnline;
const snapshot=xml=>({xml,reference:'link'});

test('frame invalidations coalesce, exports flush once and reentrant renders schedule a new frame',()=>{
  let next=0,paints=0;const pending=new Map();
  const frames=new FrameScheduler(()=>{paints++;if(paints===2)frames.invalidate();},callback=>{pending.set(++next,callback);return next;},id=>pending.delete(id));
  for(let i=0;i<100;i++)frames.invalidate();assert.equal(pending.size,1);
  frames.flush();assert.equal(paints,1);assert.equal(pending.size,0);frames.flush();assert.equal(paints,1);
  frames.invalidate();const [id,callback]=[...pending][0];pending.delete(id);callback();
  assert.equal(paints,2);assert.equal(pending.size,1);frames.flush();assert.equal(paints,3);
});
test('standard wheel units preserve zoom direction and zoom values stay finite and bounded',()=>{
  assert.ok(wheelZoomFactor(-100)>1);assert.ok(wheelZoomFactor(100)<1);
  assert.equal(wheelZoomFactor(0),1);assert.equal(wheelZoomFactor(NaN),1);
  assert.ok(wheelZoomFactor(-1,1)>wheelZoomFactor(-1,0));assert.ok(wheelZoomFactor(-1,0,true)>1);
  assert.equal(clampZoom(1e6),20);assert.equal(clampZoom(1e-6),0.01);
  assert.throws(()=>clampZoom(Infinity),/Invalid zoom/);assert.throws(()=>clampZoom(-1),/Invalid zoom/);
});
test('clean autosave avoids serialization and force audits detect unannounced legacy changes',async()=>{
  let xml='A',reads=0;const writes=[];
  const autosave=new Autosave(()=>{reads++;return snapshot(xml);},async value=>writes.push(value.xml),()=>{});
  await autosave.flush();await autosave.flush();assert.equal(reads,1);assert.deepEqual(writes,['A']);
  xml='Legacy';await autosave.flush(true);assert.deepEqual(writes,['A','Legacy']);assert.equal(autosave.dirty,false);
});
test('an edit during an in-flight write stays dirty and concurrent flushes serialize the latest snapshot',async()=>{
  let xml='A',release;const writes=[];
  const autosave=new Autosave(()=>snapshot(xml),value=>{writes.push(value.xml);return writes.length===1?new Promise(resolve=>{release=resolve;}):Promise.resolve();},()=>{});
  const first=autosave.flush();xml='B';autosave.changed();const second=autosave.flush(),third=autosave.flush();
  release();await first;await second;await third;
  assert.deepEqual(writes,['A','B']);assert.equal(autosave.dirty,false);
});
test('failed writes remain dirty and can be retried without discarding the current snapshot',async()=>{
  let fail=true;const writes=[];
  const autosave=new Autosave(()=>snapshot('kept'),async value=>{if(fail)throw new Error('quota');writes.push(value.xml);},()=>{});
  await assert.rejects(autosave.flush(),/quota/);assert.equal(autosave.dirty,true);
  fail=false;await autosave.flush();assert.equal(autosave.dirty,false);assert.deepEqual(writes,['kept']);
});
test('reference-only changes are persisted and a forced unchanged audit does not write again',async()=>{
  let reference='first';const writes=[];
  const autosave=new Autosave(()=>({xml:'same',reference}),async value=>writes.push(value.reference),()=>{});
  await autosave.flush();reference='second';await autosave.flush(true);await autosave.flush(true);
  assert.deepEqual(writes,['first','second']);
});
