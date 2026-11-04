const {test}=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const ctx=vm.createContext({setInterval,clearInterval});vm.runInContext(fs.readFileSync('script/dist/core.js','utf8'),ctx);
test('timeline navigates immutable frames and respects both boundaries',()=>{
  const seen=[], timeline=new ctx.GraphOnline.Timeline(['a','b','c'],(frame,index)=>seen.push([frame,index]));
  timeline.back();timeline.next();timeline.next();timeline.next();timeline.back();
  assert.deepEqual(seen,[['a',0],['b',1],['c',2],['c',2],['b',1]]);
  assert.equal(timeline.playing,false);
});
