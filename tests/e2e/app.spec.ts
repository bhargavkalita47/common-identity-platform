import {test,expect} from '@playwright/test';
test('public pages and account navigation',async({page})=>{
 await page.goto('/');await expect(page.getByRole('heading',{name:'Good boundaries. Better access.'})).toBeVisible();
 await page.getByRole('link',{name:'Create your workspace'}).click();await expect(page.getByLabel('Full name')).toBeVisible();
 await page.getByRole('link',{name:'Sign in',exact:true}).click();await expect(page.getByLabel('Password')).toBeVisible();
 await page.getByRole('link',{name:'Forgot password?'}).click();await expect(page.getByRole('button',{name:'Send recovery link'})).toBeVisible();
});
test('responsive landing has no horizontal overflow',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});
test('anonymous protected API request is rejected',async({request})=>{
 const r=await request.get('/api/me');expect([401,503]).toContain(r.status());
});
test('authenticated direct API requests cannot bypass tenant authorization',async({page})=>{
 test.skip(!process.env.E2E_EMAIL||!process.env.E2E_PASSWORD||!process.env.E2E_FOREIGN_ORG,'Provide an isolated seeded test account and foreign organization.');
 await page.goto('/login');await page.getByLabel('Email address').fill(process.env.E2E_EMAIL!);await page.getByLabel('Password',{exact:true}).fill(process.env.E2E_PASSWORD!);
 await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.waitForURL('**/app');
 const response=await page.request.get('/api/organizations/'+process.env.E2E_FOREIGN_ORG+'/resources');expect(response.status()).toBe(403);
 const me=await (await page.request.get('/api/me')).json();const org=me.memberships[0].organization_id;
 const forged=await page.request.post('/api/organizations/'+org+'/access-test',{headers:{Origin:new URL(page.url()).origin},data:{}});expect(forged.status()).toBe(403);
});
