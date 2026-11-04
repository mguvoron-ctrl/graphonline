const {test,expect}=require('@playwright/test');
const name=()=> 'Audit'+Array.from(crypto.getRandomValues(new Uint8Array(12)),n=>String.fromCharCode(65+n%26)).join('');
const xml='<graphml><graph><node id="0"/></graph></graphml>';
test('publication is immutable and readable; identical retries are idempotent',async({request})=>{
  const id=name(),url='/backend/saveGraph.php?name='+id;
  expect((await request.post(url,{data:xml})).status()).toBe(200);
  expect((await request.post(url,{data:xml})).status()).toBe(200);
  expect((await request.post(url,{data:xml.replace('id="0"','id="1"')})).status()).toBe(409);
  expect(await(await request.get('/backend/loadGraph.php?name='+id)).text()).toBe(xml);
});
test('invalid documents, entities, methods, names and missing graphs have explicit errors',async({request})=>{
  const url='/backend/saveGraph.php?name='+name();
  expect((await request.get(url)).status()).toBe(405);
  expect((await request.post(url,{data:'not XML'})).status()).toBe(422);
  expect((await request.post(url,{data:'<!DOCTYPE graphml [<!ENTITY x SYSTEM "file:///etc/hostname">]><graphml><graph/></graphml>'})).status()).toBe(422);
  expect((await request.post('/backend/saveGraph.php?name=../bad',{data:xml})).status()).toBe(400);
  expect((await request.post(url,{data:'x'.repeat(2*1024*1024+1)})).status()).toBe(413);
  expect((await request.get('/backend/loadGraph.php?name='+name())).status()).toBe(404);
});
test('active SVG and event handlers are rejected',async({request})=>{
  const url='/backend/saveSvg.php?name='+name();
  for(const body of ['<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>',
    '<svg xmlns="http://www.w3.org/2000/svg"><image href="https://example.com/image.png"/></svg>']) {
    expect((await request.post(url,{data:body})).status()).toBe(422);
  }
});
test('public requests cannot delete snapshots or perform maintenance',async({request})=>{
  expect((await request.get('/backend/removeGraph.php?name='+name())).status()).toBe(410);
  expect((await request.get('/backend/clear_cache.php')).status()).toBe(403);
});
