const {test,expect}=require('@playwright/test');
async function open(page){
  await page.route('**/*',route=>['127.0.0.1','localhost'].includes(new URL(route.request().url()).hostname)?route.continue():route.abort());
  await page.goto('/');await page.waitForFunction(()=>typeof editor!=='undefined'&&editor.application.ready);
  await page.evaluate(async()=>{
    const graph=new Graph();graph.AddNewVertex(new BaseVertex(300,200,null));graph.AddNewVertex(new BaseVertex(450,250,null));
    graph.AddNewEdgeSafe(graph.vertices[0],graph.vertices[1],true,1,false);
    editor.application.LoadNewGraphFromString(graph.SaveToXML(''));editor.application.SetDefaultHandler();
    clearInterval(editor.application.autosaveTimer);await editor.application.flushAutoSave(true);editor.application.flushRender();
  });
}
for(const dpr of [1,2,3])test(`standard pinch zoom enlarges around its pointer at DPR ${dpr}`,async({browser,baseURL})=>{
  const context=await browser.newContext({baseURL,deviceScaleFactor:dpr,viewport:{width:1280,height:900}});
  try{
    const page=await context.newPage();await open(page);
    const result=await page.evaluate(()=>{
      const app=editor.application,canvas=app.canvas,rect=canvas.getBoundingClientRect();
      const point={clientX:rect.left+250,clientY:rect.top+150},xml=app.DocumentXML();
      const event=new WheelEvent('wheel',{...point,deltaY:-10,ctrlKey:true,cancelable:true,bubbles:true});
      const before=app.getMousePos(canvas,event);
      Object.defineProperty(event,'wheelDelta',{value:undefined});canvas.dispatchEvent(event);app.flushRender();
      const after=app.getMousePos(canvas,event),transform=canvas.getContext('2d').getTransform();
      return {before,after,scale:app.canvasScale,prevented:event.defaultPrevented,unchanged:app.DocumentXML()===xml,
        ratio:canvas.width/rect.width,transform:transform.a};
    });
    expect(result.scale).toBeGreaterThan(1);expect(result.prevented).toBe(true);expect(result.unchanged).toBe(true);
    expect(result.after.x).toBeCloseTo(result.before.x,8);expect(result.after.y).toBeCloseTo(result.before.y,8);
    expect(result.ratio).toBeCloseTo(dpr,3);expect(result.transform).toBeCloseTo(dpr,3);
  }finally{await context.close();}
});
test('moving from Retina to a 1x display keeps CSS size and canvas pixels synchronized',async({browser,baseURL})=>{
  const context=await browser.newContext({baseURL,deviceScaleFactor:2,viewport:{width:1280,height:900}});
  try{
    const page=await context.newPage();await open(page);
    const before=await page.evaluate(()=>({width:getCanvasLogicWidth(editor.application.canvas),scale:editor.application.canvasScale}));
    const cdp=await context.newCDPSession(page);
    await cdp.send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
    const result=await page.evaluate(()=>{
      resizeCanvas();editor.application.flushRender();const canvas=editor.application.canvas,rect=canvas.getBoundingClientRect();
      return {width:getCanvasLogicWidth(canvas),css:rect.width,bitmap:canvas.width,scale:editor.application.canvasScale,transform:canvas.getContext('2d').getTransform().a};
    });
    expect(result.width).toBe(before.width);expect(result.css).toBe(result.bitmap);expect(result.transform).toBe(1);expect(result.scale).toBe(before.scale);
  }finally{await context.close();}
});
test('one hundred view updates paint once without graph scans or serialization',async({page})=>{
  await open(page);
  const counts=await page.evaluate(async()=>{
    const app=editor.application,counts={paints:0,types:0,xml:0};
    for(const [name,key]of[['_redrawGraphInWindow','paints'],['GraphTypeChanged','types'],['DocumentXML','xml']]){
      const original=app[name];app[name]=function(...args){counts[key]++;return original.apply(this,args);};
    }
    for(let i=0;i<100;i++)app.multCanvasScale(i%2?1/1.001:1.001);
    app.flushRender();await app.flushAutoSave();return counts;
  });
  expect(counts).toEqual({paints:1,types:0,xml:0});
});
test('actual vertex dragging persists its final position without a forced audit',async({page})=>{
  await open(page);const box=await page.locator('#canvas').boundingBox();
  await page.mouse.move(box.x+300,box.y+200);await page.mouse.down();
  await page.mouse.move(box.x+360,box.y+240,{steps:12});await page.mouse.up();
  const result=await page.evaluate(async()=>{
    const app=editor.application;await app.flushAutoSave();const draft=await GraphOnline.drafts.load();
    const restored=new Graph();restored.LoadFromXML(draft.xml,{});
    return {current:app.graph.vertices[0].position,saved:restored.vertices[0].position};
  });
  expect(result.current.x).toBeCloseTo(360);expect(result.current.y).toBeGreaterThan(200);expect(result.saved).toEqual(result.current);
});
test('layout completion preserves zoom and pan chosen while it was calculating',async({page})=>{
  await open(page);let release;const gate=new Promise(resolve=>{release=resolve;});
  await page.route('**/layout-worker.js*',async route=>{await gate;await route.continue().catch(()=>{});});
  try{
    await page.locator('#GraphLayout').click();
    const before=await page.evaluate(()=>{const app=editor.application;app.multCanvasScale(2);app.onCanvasMove(new Point(35,20));return{scale:app.canvasScale,x:app.canvasPosition.x,y:app.canvasPosition.y};});
    release();expect(await page.evaluate(()=>editor.application.layoutPromise)).toBe(true);
    expect(await page.evaluate(()=>{const app=editor.application;return{scale:app.canvasScale,x:app.canvasPosition.x,y:app.canvasPosition.y};})).toEqual(before);
  }finally{release();}
});
test('forced compatibility audit saves direct legacy changes and reference updates',async({page})=>{
  await open(page);
  const draft=await page.evaluate(async()=>{
    const app=editor.application;app.graph.vertices[0].mainText='Legacy direct edit';app.lastGraphName='PublishedReference';
    await app.flushAutoSave(true);return GraphOnline.drafts.load();
  });
  expect(draft.xml).toContain('Legacy direct edit');expect(draft.reference).toBe('PublishedReference');
});
test('an older save does not announce completion while a newer edit is pending',async({page})=>{
  await open(page);
  const result=await page.evaluate(async()=>{
    const app=editor.application,store=GraphOnline.drafts,save=store.save.bind(store);
    let release,first=true;
    store.save=draft=>{if(!first)return save(draft);first=false;return new Promise((resolve,reject)=>{release=()=>save(draft).then(resolve,reject);});};
    try{
      app.graph.vertices[0].mainText='First';app.MarkDocumentChanged(false);const pending=app.flushAutoSave();
      app.graph.vertices[0].mainText='Latest';app.MarkDocumentChanged(false);release();await pending;
      const pendingStatus=document.getElementById('document-status').textContent;
      await app.flushAutoSave();return{pendingStatus,expected:GraphOnline.translate('saving'),xml:(await store.load()).xml};
    }finally{store.save=save;}
  });
  expect(result.pendingStatus).toBe(result.expected);expect(result.xml).toContain('Latest');
});
test('workspace PNG capture flushes the current pending frame',async({page})=>{
  await open(page);
  const result=await page.evaluate(()=>{
    const app=editor.application,before=app.canvas.toDataURL();app.graph.vertices[0].position.x=200;app.redrawGraph();
    let captured;const exporter=new SavedDialogGraphImageHandler(app);exporter.downloadCanvas=canvas=>{captured=canvas.toDataURL();};
    exporter.showWorkspace();return{changed:captured!==before,current:captured===app.canvas.toDataURL()};
  });
  expect(result).toEqual({changed:true,current:true});
});
test('repeated path selections keep one animation timer and stop releases it',async({page})=>{
  await open(page);
  const result=await page.evaluate(()=>{
    const app=editor.application,nativeSet=window.setInterval,nativeClear=window.clearInterval,active=new Set();
    window.setInterval=function(...args){const id=nativeSet.apply(this,args);active.add(id);return id;};
    window.clearInterval=function(id){active.delete(id);return nativeClear.call(this,id);};
    try{for(let i=0;i<10;i++)app.setRenderPath([0,1]);const during=active.size;app.setRenderPath([]);return{during,after:active.size};}
    finally{app.stopRenderTimer();window.setInterval=nativeSet;window.clearInterval=nativeClear;}
  });
  expect(result).toEqual({during:1,after:0});
});
test('idle pointer movement preserves the current controls and their focus',async({page})=>{
  await open(page);await page.locator('#AddGraph').click();
  const select=page.locator('#message #enumVertexsText');await select.focus();
  await page.evaluate(()=>{window.keptControl=document.querySelector('#message #enumVertexsText');});
  await page.locator('#canvas').hover();
  expect(await page.evaluate(()=>document.querySelector('#message #enumVertexsText')===window.keptControl&&document.activeElement===window.keptControl)).toBe(true);
});
test('Safari gesture events enlarge once and suppress overlapping wheel events',async({page})=>{
  await open(page);
  const result=await page.evaluate(()=>{
    const app=editor.application,canvas=app.canvas,prevented=[];
    for(const [type,scale]of[['gesturestart',1],['gesturechange',1.5]]){
      const event=new Event(type,{cancelable:true});Object.defineProperty(event,'scale',{value:scale});canvas.dispatchEvent(event);prevented.push(event.defaultPrevented);
    }
    const scale=app.canvasScale,event=new WheelEvent('wheel',{deltaY:-100,ctrlKey:true,cancelable:true});canvas.dispatchEvent(event);
    const overlapping=app.canvasScale;canvas.dispatchEvent(new Event('gestureend',{cancelable:true}));
    return{scale,overlapping,prevented,wheelPrevented:event.defaultPrevented};
  });
  expect(result).toEqual({scale:1.5,overlapping:1.5,prevented:[true,true],wheelPrevented:true});
});
