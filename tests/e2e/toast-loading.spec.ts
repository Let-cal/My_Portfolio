import {expect,test} from '@playwright/test';

test('toast library waits for the first copy and that first notification is delivered',async({page})=>{
 const bodies:Promise<string>[]=[];
 page.on('response',response=>{if(response.request().resourceType()==='script')bodies.push(response.text().catch(()=>''));});
 await page.addInitScript(()=>{Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{}}});});
 await page.goto('/en',{waitUntil:'networkidle'});
 const startup=await Promise.all(bodies);
 expect(startup.some(body=>body.includes('[data-sonner-toaster]'))).toBe(false);
 await page.getByRole('button',{name:'Copy email',exact:true}).first().click();
 const notification=page.locator('[data-sonner-toast]').first();
 await expect(notification).toBeVisible();await expect(notification).toContainText('Copied');
 await expect(notification).toContainText('letcal2003@gmail.com');
});
