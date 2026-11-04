const {test,expect}=require('@playwright/test');
async function open(page){
  await page.route('**/*',route=>['localhost','127.0.0.1'].includes(new URL(route.request().url()).hostname)?route.continue():route.abort());
  await page.goto('/');await page.waitForFunction(()=>typeof editor!=='undefined'&&editor.application.ready);
  await page.evaluate(()=>editor.application.flushAutoSave());
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
}
test('wide editor keeps controls, body-level dialogs and camera available',async({page})=>{
  await open(page);
  const before=await page.evaluate(()=>{
    editor.application.setCanvasScale(1.5);
    return{scale:editor.application.canvasScale,classes:document.getElementById('mainContainer').className,header:document.getElementById('h1Header').style.display};
  });
  await expect(page.locator('#h1Header')).toBeHidden();
  await expect(page.locator('#navigation')).toBeVisible();await expect(page.locator('#main-menu')).toBeVisible();
  await expect(page.locator('#GraphLayout')).toBeVisible();await expect(page.locator('#AddGraph')).toBeVisible();
  await page.locator('#AddGraph').click();await page.locator('#canvas').click({position:{x:150,y:100}});
  expect(await page.evaluate(()=>editor.application.graph.vertices.length)).toBe(1);
  await page.evaluate(()=>new ShowAdjacencyMatrix(editor.application).show());
  await expect(page.locator('#adjacencyMatrix')).toBeVisible();
  await page.evaluate(()=>$('#adjacencyMatrix').dialog('close'));
  await page.keyboard.press('Escape');
  expect(await page.evaluate(()=>({scale:editor.application.canvasScale,classes:document.getElementById('mainContainer').className,header:document.getElementById('h1Header').style.display}))).toEqual(before);
});
test('editor starts wide without requesting native fullscreen',async({page})=>{
  await open(page);
  expect(await page.evaluate(()=>document.fullscreenElement)).toBe(null);
  await expect(page.locator('button#Fullscreen')).toHaveCount(0);
  await expect(page.locator('#Fullscreen')).toBeHidden();
  await expect(page.locator('html')).toHaveClass(/graphonline-editor/);
  await expect(page.locator('#h1Header')).toBeHidden();
  await expect(page.locator('#main-menu')).toBeVisible();
  const bounds=await page.evaluate(()=>({width:document.getElementById('mainContainer').getBoundingClientRect().width,viewport:innerWidth,bottom:document.getElementById('canvas').getBoundingClientRect().bottom,height:innerHeight}));
  expect(bounds.width).toBeCloseTo(bounds.viewport,0);expect(bounds.bottom).toBeLessThanOrEqual(bounds.height+1);
});
test('wide layout is present before application JavaScript runs',async({browser,baseURL})=>{
  const context=await browser.newContext({baseURL,javaScriptEnabled:false,viewport:{width:1280,height:900}});
  try{
    const page=await context.newPage();await page.goto('/');
    await expect(page.locator('html')).toHaveClass(/graphonline-editor/);await expect(page.locator('#h1Header')).toBeHidden();
    expect(await page.evaluate(()=>document.getElementById('mainContainer').getBoundingClientRect().width)).toBe(1280);
  }finally{await context.close();}
});
test('editor layout does not spread to matrix creation pages',async({page})=>{
  await open(page);await page.goto('/create_graph_by_matrix');
  await expect(page.locator('html')).not.toHaveClass(/graphonline-editor/);
  expect(await page.evaluate(()=>document.getElementById('mainContainer').getBoundingClientRect().width<innerWidth)).toBe(true);
});
test('collapsing panels enlarges the canvas and preserves controls without editing the document',async({page})=>{
  await open(page);await page.locator('#AddGraph').click();
  await page.locator('#message #enumVertexsText').selectOption({index:1});
  const before=await page.evaluate(async()=>{
    const app=editor.application;await app.flushAutoSave();app.flushRender();
    window.keptPanelControl=document.querySelector('#message #enumVertexsText');
    const xml=app.DocumentXML(),read=app.DocumentXML.bind(app);window.panelSerializations=0;
    app.DocumentXML=()=>{window.panelSerializations++;return read();};
    return{height:app.canvas.getBoundingClientRect().height,xml,value:window.keptPanelControl.value};
  });
  await page.locator('#TogglePanels').click();
  await expect(page.locator('#TogglePanels')).toHaveAttribute('aria-expanded','false');
  await expect(page.locator('#navigation')).toBeHidden();await expect(page.locator('#editorToolbar')).toBeHidden();await expect(page.locator('#editorMessages')).toBeHidden();
  expect((await page.locator('#canvas').boundingBox()).height).toBeGreaterThan(before.height+50);
  await page.locator('#TogglePanels').click();await expect(page.locator('#main-menu')).toBeVisible();
  expect(await page.evaluate(()=>document.querySelector('#message #enumVertexsText')===window.keptPanelControl)).toBe(true);
  await expect(page.locator('#message #enumVertexsText')).toHaveValue(before.value);
  expect(await page.evaluate(async()=>{await editor.application.flushAutoSave();return window.panelSerializations;})).toBe(0);
  expect(await page.evaluate(()=>editor.application.DocumentXML())).toBe(before.xml);
});
test('Escape keeps the workspace wide and the panel visibility unchanged',async({page})=>{
  await open(page);await page.locator('#TogglePanels').click();
  await expect(page.locator('#main-menu')).toBeHidden();
  await page.keyboard.press('Escape');await expect(page.locator('html')).toHaveClass(/graphonline-editor/);
  await expect(page.locator('#TogglePanels')).toBeVisible();await expect(page.locator('#main-menu')).toBeHidden();
  await page.locator('#TogglePanels').click();await expect(page.locator('#main-menu')).toBeVisible();
});
test('mobile canvas keeps a reachable button to restore hidden panels',async({browser,baseURL})=>{
  const context=await browser.newContext({baseURL,viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true});
  try{
    const page=await context.newPage();await open(page);
    await page.locator('#TogglePanels').tap();await expect(page.locator('#editorToolbar')).toBeHidden();
    await expect(page.locator('#TogglePanels')).toBeVisible();
    const bounds=await page.locator('#canvasControls').boundingBox();expect(bounds.x).toBeGreaterThanOrEqual(0);expect(bounds.x+bounds.width).toBeLessThanOrEqual(391);
    await page.locator('#TogglePanels').tap();await expect(page.locator('#main-menu')).toBeVisible();
  }finally{await context.close();}
});
