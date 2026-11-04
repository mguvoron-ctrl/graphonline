const {test}=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
test('a request waiting for initialization is busy and remains cancellable',async()=>{
  class Worker {terminate(){} postMessage(){}}
  const context=vm.createContext({Worker,DOMException,setTimeout,clearTimeout});
  vm.runInContext(fs.readFileSync('script/dist/core.js','utf8'),context);
  const runner=new context.GraphOnline.AlgorithmRunner('/worker.js');
  assert.equal(runner.busy,false);
  const result=runner.run('input');assert.equal(runner.busy,true);
  runner.cancel();await assert.rejects(result,{name:'AbortError'});assert.equal(runner.busy,false);
});
