import { test,expect } from '@playwright/test';
import { readFile,writeFile } from 'node:fs/promises';
test('GLB Meshopt desktop: decode, orçamento e vistas',async({page},info)=>{
  const errors:string[]=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.setViewportSize({width:1440,height:1000});
  await page.goto('http://127.0.0.1:8765/preview.html');
  await expect(page.locator('#status')).toHaveAttribute('data-ready','true',{timeout:60000});
  const metrics=await page.evaluate(()=> (window as any).avatarMetrics);
  const expected=JSON.parse(await readFile(process.env.VALIDATION_REPORT!,'utf8'));
  expect(metrics.triangles).toBe(expected.triangles);
  expect(metrics.dimensions[1]).toBeGreaterThan(1.75);
  expect(metrics.dimensions[1]).toBeLessThan(2);
  expect(errors).toEqual([]);
  for(const [name,angle] of [['front',0],['profile',Math.PI/2],['back',Math.PI],['three-quarter',Math.PI/4]] as const){
    await page.evaluate(a=>(window as any).pose(a),angle);
    await page.locator('canvas').screenshot({path:info.outputPath(name+'.png')});
  }
  expect(metrics.expressions).toEqual(['Blink','Focus','Smile']);
  await page.evaluate(()=> (window as any).face());
  await page.locator('canvas').screenshot({path:info.outputPath('face-neutral.png')});
  for(const expression of ['Blink','Focus','Smile']){
    const affected=await page.evaluate(name=>(window as any).expression(name),expression);
    expect(affected).toBeGreaterThan(0);
    await page.locator('canvas').screenshot({path:info.outputPath('face-'+expression.toLowerCase()+'.png')});
  }
  expect(errors).toEqual([]);
  await writeFile(info.outputPath('browser-metrics.json'),JSON.stringify(metrics,null,2));
});
