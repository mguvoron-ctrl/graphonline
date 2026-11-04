const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const context = vm.createContext({});
vm.runInContext(fs.readFileSync('script/dist/core.js', 'utf8'), context);
const { History } = context.GraphOnline;

test('undo/redo preserve the current document and a new edit discards the redo branch', () => {
  const history = new History();
  history.push('empty'); history.push('one');
  assert.equal(history.undo('two'), 'one');
  assert.equal(history.undo('one'), 'empty');
  assert.equal(history.redo('empty'), 'one');
  history.push('one');
  assert.equal(history.canRedo, false);
  assert.equal(history.undo('different'), 'one');
});
test('history has a bounded lifetime and clear removes both directions', () => {
  const history = new History(2);
  history.push(0); history.push(1); history.push(2);
  assert.equal(history.undo(3), 2); assert.equal(history.undo(2), 1);
  assert.equal(history.undo(1), null);
  history.clear(); assert.equal(history.canRedo, false); assert.equal(history.canUndo, false);
});
test('large documents retain nearest checkpoints within the shared undo/redo byte budget',()=>{
  const history=new History(100,16);
  history.push('AAAA');history.push('BBBB');history.push('CCCC');
  assert.equal(history.undo('DDDD'),'CCCC');assert.equal(history.undo('CCCC'),'BBBB');
  assert.equal(history.undo('BBBB'),null);
  assert.equal(history.redo('BBBB'),'CCCC');assert.equal(history.redo('CCCC'),'DDDD');
  assert.ok(history.estimatedBytes<=16);
  history.clear();assert.equal(history.estimatedBytes,0);
});
test('an oversized checkpoint cannot exceed the budget or leave a stale redo branch',()=>{
  const history=new History(100,8);history.push('a');history.undo('b');history.push('a'.repeat(20));
  assert.equal(history.canUndo,false);assert.equal(history.canRedo,false);assert.equal(history.estimatedBytes,0);
});
