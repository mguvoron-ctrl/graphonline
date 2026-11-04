const {test, expect, devices} = require('@playwright/test');

async function open(page, path='/') {
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    return ['127.0.0.1','localhost'].includes(url.hostname) || ['data:','blob:'].includes(url.protocol) ? route.continue() : route.abort();
  });
  await page.goto(path);
  await page.waitForFunction(() => typeof editor !== 'undefined' && editor.application.ready && g_AlgorithmIds.length === 25);
}
async function add(page) {
  await page.locator('#AddGraph').click();
  await page.locator('#canvas').click({position:{x:120,y:100}});
  await page.locator('#canvas').click({position:{x:300,y:160}});
}

test('reflected markup stays inside its attribute', async({page})=>{
  await open(page, '/?graph='+encodeURIComponent('"><img src="data:," onerror="window.auditXss=1">'));
  await expect.poll(()=>page.evaluate(()=>window.auditXss)).toBeUndefined();
});
test('imported names remain text in algorithm reports',async({page})=>{
  await open(page);
  await page.evaluate(()=>{
    const g=new Graph(),v=new BaseVertex(50,50,null);g.AddNewVertex(v);
    v.mainText='<img src="data:," onerror="window.auditXss=1">';
    editor.application.LoadNewGraphFromString(g.SaveToXML(''));
    const algorithm=new BFSAlgorithm(editor.application.graph,editor.application);
    algorithm.visited=editor.application.graph.vertices.slice();
    editor.updateMessage(algorithm.getMainMessage());
  });
  await expect(page.locator('#message img')).toHaveCount(0);
  expect(await page.evaluate(()=>window.auditXss)).toBeUndefined();
  await expect(page.locator('#message')).toContainText('<img');
});
test('standard GraphML retains weights and permits editing; own IDs stay stable',async({page})=>{
  await open(page);
  const result=await page.evaluate(()=>{
    const g=new Graph();g.LoadFromXML('<graphml><key id="w" for="edge" attr.name="weight" attr.type="double"/><graph edgedefault="directed"><node id="n0"/><node id="n1"/><edge id="e0" source="n0" target="n1"><data key="w">7</data></edge></graph></graphml>',{});
    g.AddNewVertex(new BaseVertex(50,50,null));
    const copy=new Graph();copy.LoadFromXML(g.SaveToXML(''),{});
    return {weight:copy.edges[0].GetWeight(),id:copy.edges[0].id,newId:g.vertices[2].id};
  });
  expect(result).toEqual({weight:7,id:'10000',newId:2});
});
test('malformed imports cannot partially replace the document',async({page})=>{
  await open(page);await add(page);
  const result=await page.evaluate(()=>{
    try {editor.application.LoadNewGraphFromString('<graphml><graph><node id="a"/><edge source="a" target="missing"/></graph></graphml>');} catch {}
    return editor.application.graph.vertices.length;
  });expect(result).toBe(2);
});
test('standards export round-trips weights, labels, layout and presentation extensions',async({page})=>{
  await open(page);
  const result=await page.evaluate(()=>{
    const g=new Graph();g.AddNewVertex(new BaseVertex(123,234,null));g.AddNewVertex(new BaseVertex(345,456,null));
    g.vertices[0].mainText='A < B & "C"';g.vertices[0].upText='note';
    g.AddNewEdgeSafe(g.vertices[0],g.vertices[1],true,-2.5,false);g.edges[0].text='cost';g.edges[0].model.width=7;
    const xml=GraphOnline.exportGraphML(g.SaveToXML(''));
    const copy=new Graph();copy.LoadFromXML(xml,{});
    return {namespace:new DOMParser().parseFromString(xml,'application/xml').documentElement.namespaceURI,
      weight:copy.edges[0].GetWeight(),label:copy.vertices[0].mainText,position:copy.vertices[0].position,
      note:copy.vertices[0].upText,edgeLabel:copy.edges[0].text,width:copy.edges[0].model.width};
  });
  expect(result).toMatchObject({namespace:'http://graphml.graphdrawing.org/xmlns',weight:-2.5,label:'A < B & "C"',position:{x:123,y:234},note:'note',edgeLabel:'cost',width:7});
});
test('keyboard undo and redo preserve both edits',async({page})=>{
  await open(page);await add(page);
  await page.keyboard.press('Control+z');
  expect(await page.evaluate(()=>editor.application.graph.vertices.length)).toBe(1);
  await page.keyboard.press('Control+Shift+z');
  expect(await page.evaluate(()=>editor.application.graph.vertices.length)).toBe(2);
});
test('a large local draft survives reload without compression APIs or backend',async({page})=>{
  await open(page);
  await page.route('**/backend/**',route=>route.abort());
  await page.evaluate(async()=>{
    window.CompressionStream=undefined;
    const g=editor.application.graph;
    for(let i=0;i<100;i++){const v=new BaseVertex(50+i,50,null);g.AddNewVertex(v);v.mainText='vertex '+i+' '+('x'.repeat(100));}
    await editor.application.saveAutoSave(g.SaveToXML(''));
  });
  await page.reload();await page.waitForFunction(()=>editor.application.ready);
  expect(await page.evaluate(()=>editor.application.graph.vertices.length)).toBe(100);
});
test('a legacy last-graph cookie is restored when no local draft exists',async({page,request,context,baseURL})=>{
  const name='Migration'+Array.from(crypto.getRandomValues(new Uint8Array(12)),value=>String.fromCharCode(65+value%26)).join('');
  const body='<graphml><graph><node id="0" positionX="100" positionY="100" mainText="Legacy"/></graph></graphml>';
  expect((await request.post('/backend/saveGraph.php?name='+name,{data:body})).status()).toBe(200);
  await context.addCookies([{name:'graphName',value:name,url:baseURL}]);
  await open(page);
  expect(await page.evaluate(()=>editor.application.graph.vertices.map(vertex=>vertex.mainText))).toEqual(['Legacy']);
});
test('an invalid success response retains the draft and never publishes a link',async({page})=>{
  await open(page);await add(page);
  await page.route('**/backend/saveGraph.php?*',route=>route.fulfill({status:200,body:'Error'}));
  await page.evaluate(()=>editor.application.SaveGraphOnDisk().catch(()=>{}));
  expect(await page.evaluate(()=>editor.application.savedGraphName)).toBe('');
  expect(await page.evaluate(async()=>(await GraphOnline.drafts.load()).xml)).toContain('<node');
  await expect(page.locator('#document-status')).toContainText('Не удалось сохранить');
});
test('Floyd preview restores the original edge including its labels',async({page})=>{
  await open(page);
  const result=await page.evaluate(()=>{
    const g=editor.application.graph;
    g.AddNewVertex(new BaseVertex(50,50,null));g.AddNewVertex(new BaseVertex(150,50,null));
    g.AddNewEdgeSafe(g.vertices[0],g.vertices[1],false,3,false);
    g.edges[0].text='label';g.edges[0].upText='extra';const id=g.edges[0].id;
    const algorithm=new FloidAlgorithm(g,editor.application);algorithm.result();algorithm.restore();
    return {id:g.edges[0].id,originalId:id,label:g.edges[0].text,extra:g.edges[0].upText};
  });expect(result).toMatchObject({label:'label',extra:'extra'});expect(result.id).toBe(result.originalId);
});
async function shortest(page) {
  return page.evaluate(async()=>{
    const app=editor.application;await app.algorithmRunner.ready;
    const g=new Graph();for(let i=0;i<3;i++){g.AddNewVertex(new BaseVertex(50+100*i,50,null));g.vertices[i].mainText=String(i);}
    g.AddNewEdgeSafe(g.vertices[0],g.vertices[1],true,2,false);g.AddNewEdgeSafe(g.vertices[1],g.vertices[2],true,3,false);g.AddNewEdgeSafe(g.vertices[0],g.vertices[2],true,9,false);
    const algorithm=new FindShortPathNew(g,app);algorithm.firstObject=g.vertices[0];algorithm.secondObject=g.vertices[2];
    return new Promise(resolve=>algorithm.result(result=>resolve({message:algorithm.message,result})));
  });
}
test('the worker computes the shortest path on desktop',async({page})=>{
  await open(page);const result=await shortest(page);expect(result.message).toContain(' 5:');expect(result.result.paths).toEqual([['0','1','2']]);
});
test('the same worker runs on mobile without CGI',async({browser,baseURL})=>{
  const context=await browser.newContext({...devices['Pixel 7'],baseURL});const page=await context.newPage();
  const cgi=[];page.on('request',request=>{if(request.url().includes('GraphCGI'))cgi.push(request.url());});
  await open(page);expect((await shortest(page)).result.paths).toEqual([['0','1','2']]);expect(cgi).toEqual([]);await context.close();
});
test('switching tools reuses an idle algorithm engine',async({page})=>{
  await page.addInitScript(()=>{
    const NativeWorker=window.Worker;window.createdWorkers=0;
    window.Worker=class extends NativeWorker {
      constructor(...args){super(...args);window.createdWorkers++;}
    };
  });
  await open(page);await page.evaluate(()=>editor.application.algorithmRunner.ready);
  await page.locator('#AddGraph').click();await page.locator('#Default').click();
  expect((await shortest(page)).result.paths).toEqual([['0','1','2']]);
  await page.locator('#DeleteObject').click();await page.locator('#Default').click();
  expect((await shortest(page)).result.paths).toEqual([['0','1','2']]);
  expect(await page.evaluate(()=>window.createdWorkers)).toBe(1);
});
test('large maximum flows are displayed instead of rejected by an arbitrary limit',async({page})=>{
  await open(page);
  const message=await page.evaluate(async()=>{
    const app=editor.application;await app.algorithmRunner.ready;
    const g=new Graph();for(let i=0;i<2;i++)g.AddNewVertex(new BaseVertex(50+100*i,50,null));
    g.AddNewEdgeSafe(g.vertices[0],g.vertices[1],true,200000,false);
    const a=new FindMaxFlow(g,app);a.firstObject=g.vertices[0];a.secondObject=g.vertices[1];
    return new Promise(resolve=>a.result(()=>resolve(a.message)));
  });expect(message).toContain('200000');
});
test('cancellation rejects outstanding work and the next run starts a fresh worker',async({page})=>{
  await open(page);
  const result=await page.evaluate(async()=>{
    const runner=editor.application.algorithmRunner;
    const pending=runner.run('invalid');runner.cancel();
    let cancelled=false;try{await pending;}catch(error){cancelled=error.name==='AbortError';}
    const next=runner.run('invalid');try{await next;}catch{}
    return {cancelled,ready:await runner.ready.then(()=>true)};
  });expect(result).toEqual({cancelled:true,ready:true});
});
test('an older request cannot replace the result of a newer selection',async({page})=>{
  await open(page);
  const events=await page.evaluate(async()=>{
    const app=editor.application,original=app.processEmscripten,resolvers=[],events=[];
    app.processEmscripten=()=>new Promise(resolve=>resolvers.push(resolve));
    const g=new Graph();for(let i=0;i<2;i++){g.AddNewVertex(new BaseVertex(50+i*100,50,null));g.vertices[i].mainText=String(i);}
    const algorithm=new FindShortPathNew(g,app);algorithm.firstObject=g.vertices[0];algorithm.secondObject=g.vertices[1];
    algorithm.result(()=>events.push('old'));algorithm.result(()=>events.push('latest'));
    const response='<graphml><result><value type="1">5</value><value type="4">0</value><value type="4">1</value></result></graphml>';
    resolvers[0](response);resolvers[1](response);await new Promise(resolve=>setTimeout(resolve,0));
    app.processEmscripten=original;return events;
  });expect(events).toEqual(['latest']);
});
test('SVG download is generated locally without backend requests',async({page})=>{
  await open(page);await add(page);const requests=[];
  page.on('request',request=>{if(request.url().includes('/backend/save'))requests.push(request.url());});
  const downloadPromise=page.waitForEvent('download');
  await page.evaluate(()=>new SavedDialogGraphImageHandler(editor.application).showSvg());
  const download=await downloadPromise;expect(download.suggestedFilename()).toBe('graph.svg');expect(requests).toEqual([]);
});

test('BFS exposes reversible steps, pause and preserves the stored document',async({page})=>{
  await open(page);await add(page);
  await page.evaluate(()=>{
    const app=editor.application,g=app.graph;
    g.AddNewEdgeSafe(g.vertices[0],g.vertices[1],false,1,false);
    const algorithm=new BFSAlgorithm(g,app);
    app.SetHandler(new AlgorithmGraphHandler(app,algorithm));
    algorithm.selectVertex(g.vertices[0]);app.updateMessage();
  });
  await expect(page.locator('#traversal-state')).toContainText('1/2');
  await page.locator('#traversal-next').click();
  await expect(page.locator('#traversal-state')).toContainText('2/2');
  await page.locator('#traversal-back').click();
  await expect(page.locator('#traversal-state')).toContainText('1/2');
  const result=await page.evaluate(()=>{
    const xml=editor.application.DocumentXML();
    const app=editor.application,algorithm=app.handler.algorithm;
    algorithm.timeline.play();app.SetDefaultHandler();
    return {playing:algorithm.timeline.playing,storedReport:xml.includes('upText="1"')};
  });expect(result).toEqual({playing:false,storedReport:false});
});

test('the public editor and a local document reopen fully offline',async({page,context})=>{
  await open(page);await add(page);
  await page.evaluate(()=>editor.application.saveAutoSave(editor.application.DocumentXML()));
  await page.waitForFunction(()=>navigator.serviceWorker.controller!==null,{timeout:20000});
  await context.setOffline(true);
  await page.reload();
  await page.waitForFunction(()=>typeof editor!=='undefined'&&editor.application.ready);
  expect(await page.evaluate(()=>editor.application.graph.vertices.length)).toBe(2);
  expect((await shortest(page)).result.paths).toEqual([['0','1','2']]);
});

for (const language of ['ru','en','fr','de','el','es','nl','sv','pt','bg','ch','pl','cs','ua']) {
  test(`editor initializes in ${language}`,async({page})=>{
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await open(page,language==='ru'?'/':`/${language}/`);
    expect(await page.locator('html').getAttribute('lang')).toBe(language);
    expect(errors).toEqual([]);
  });
}
for (const [route,button,edges] of [['create_graph_by_matrix','CreateByAdjacencyMatrix',2],['create_graph_by_incidence_matrix','CreateByIncidenceMatrix',2],['create_graph_by_edge_list','CreateByPair',3]]) {
  test(`creation workflow: ${route}`,async({page})=>{
    await page.goto('/'+route);await page.waitForFunction(()=>typeof Graph!=='undefined');
    await Promise.all([page.waitForURL(url=>url.pathname==='/'),page.locator('#'+button).click()]);
    await page.waitForFunction(()=>typeof editor!=='undefined'&&editor.application.ready);
    expect(await page.evaluate(()=>editor.application.graph.vertices.length)).toBe(3);
    expect(await page.evaluate(()=>editor.application.graph.edges.length)).toBe(edges);
  });
}
test('the uncached source loader initializes the same application',async({page})=>{
  const fs=require('node:fs');
  await page.route('**/script/pages/editor/api/index.js.cache?*',route=>route.fulfill({contentType:'application/javascript',body:fs.readFileSync('script/pages/editor/api/index.js','utf8')}));
  await open(page);expect(await page.evaluate(()=>editor.application.isSupportEmscripten())).toBe(true);
});

test('mobile traversal controls stay above the canvas and fit inside their panel',async({browser,baseURL})=>{
  const context=await browser.newContext({...devices['Pixel 7'],baseURL}),page=await context.newPage();
  await open(page);
  await page.evaluate(()=>{
    const app=editor.application,g=app.graph;
    g.AddNewVertex(new BaseVertex(70,90,null));g.vertices[0].mainText='A';
    const algorithm=new BFSAlgorithm(g,app);app.SetHandler(new AlgorithmGraphHandler(app,algorithm));
    algorithm.selectVertex(g.vertices[0]);app.updateMessage();
  });
  await expect.poll(()=>page.evaluate(()=>{
    const panel=document.getElementById('message').getBoundingClientRect(),canvas=document.getElementById('canvas').getBoundingClientRect();
    return [...document.querySelectorAll('#message button,#message select,#message output')].every(element=>element.getBoundingClientRect().bottom<=panel.bottom) && panel.bottom<=canvas.top;
  })).toBe(true);
  await context.close();
});
