const {test,expect}=require('@playwright/test');
async function open(page){
  await page.route('**/*',route=>['localhost','127.0.0.1'].includes(new URL(route.request().url()).hostname)?route.continue():route.abort());
  await page.goto('/');await page.waitForFunction(()=>typeof editor!=='undefined'&&editor.application.ready);
}
test('native fullscreen includes editor controls and body-level dialogs and preserves camera',async({page})=>{
  await open(page);
  const before=await page.evaluate(()=>{
    editor.application.setCanvasScale(1.5);
    return{scale:editor.application.canvasScale,classes:document.getElementById('mainContainer').className,header:document.getElementById('h1Header').style.display};
  });
  await page.locator('#Fullscreen').click();
  await expect.poll(()=>page.evaluate(()=>document.fullscreenElement?.tagName)).toBe('HTML');
  await expect(page.locator('#Fullscreen')).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('#h1Header')).toBeHidden();
  await expect(page.locator('#navigation')).toBeVisible();await expect(page.locator('#main-menu')).toBeVisible();
  await expect(page.locator('#GraphLayout')).toBeVisible();await expect(page.locator('#AddGraph')).toBeVisible();
  await page.locator('#AddGraph').click();await page.locator('#canvas').click({position:{x:150,y:100}});
  expect(await page.evaluate(()=>editor.application.graph.vertices.length)).toBe(1);
  await page.evaluate(()=>new ShowAdjacencyMatrix(editor.application).show());
  await expect(page.locator('#adjacencyMatrix')).toBeVisible();
  expect(await page.evaluate(()=>document.fullscreenElement.contains(document.getElementById('adjacencyMatrix')))).toBe(true);
  await page.evaluate(()=>$('#adjacencyMatrix').dialog('close'));
  await page.locator('#Fullscreen').click();
  await expect.poll(()=>page.evaluate(()=>document.fullscreenElement)).toBe(null);
  expect(await page.evaluate(()=>({scale:editor.application.canvasScale,classes:document.getElementById('mainContainer').className,header:document.getElementById('h1Header').style.display}))).toEqual(before);
});
test('browser exit and Escape synchronize the native fullscreen button and restore the layout',async({page})=>{
  await open(page);await page.locator('#Fullscreen').click();
  await expect.poll(()=>page.evaluate(()=>!!document.fullscreenElement)).toBe(true);
  await page.evaluate(()=>document.exitFullscreen());
  await expect(page.locator('#Fullscreen')).toHaveAttribute('aria-pressed','false');
  await page.locator('#Fullscreen').click();
  await expect.poll(()=>page.evaluate(()=>!!document.fullscreenElement)).toBe(true);
  await page.keyboard.press('Escape');
  await expect(page.locator('#Fullscreen')).toHaveAttribute('aria-pressed','false');
  await expect(page.locator('html')).not.toHaveClass(/graphonline-fullscreen/);
  await expect(page.locator('#h1Header')).toBeVisible();
});
for(const mode of ['missing','denied'])test(`fullscreen ${mode} falls back without hiding functions`,async({page})=>{
  await open(page);
  await page.evaluate(mode=>{
    document.documentElement.requestFullscreen=mode==='missing'?undefined:()=>Promise.reject(new Error('Permission denied'));
    document.documentElement.webkitRequestFullscreen=undefined;
  },mode);
  await page.locator('#Fullscreen').click();
  await expect(page.locator('#Fullscreen')).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('#navigation')).toBeVisible();await expect(page.locator('#main-menu')).toBeVisible();
  await expect(page.locator('#GraphLayout')).toBeVisible();await expect(page.locator('#message')).toBeVisible();
  await expect(page.locator('#document-status')).toContainText('вкладку');
  await page.keyboard.press('Escape');await expect(page.locator('#Fullscreen')).toHaveAttribute('aria-pressed','false');
});
test('expanded editor keeps its toolbar and exit button available on a narrow screen',async({browser,baseURL})=>{
  const context=await browser.newContext({baseURL,viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true});
  try{
    const page=await context.newPage();await open(page);
    await page.evaluate(()=>{document.documentElement.requestFullscreen=undefined;document.documentElement.webkitRequestFullscreen=undefined;});
    await page.locator('#Fullscreen').tap();await expect(page.locator('#Fullscreen')).toHaveAttribute('aria-pressed','true');
    await expect(page.locator('#AddGraph')).toBeVisible();await expect(page.locator('#GraphLayout')).toBeVisible();
    const bounds=await page.evaluate(()=>({right:document.getElementById('canvas').getBoundingClientRect().right,width:innerWidth}));
    expect(bounds.right).toBeLessThanOrEqual(bounds.width+1);
    await page.locator('#Fullscreen').tap();await expect(page.locator('#Fullscreen')).toHaveAttribute('aria-pressed','false');
  }finally{await context.close();}
});
