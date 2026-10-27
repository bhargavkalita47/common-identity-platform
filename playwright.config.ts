import {defineConfig,devices} from '@playwright/test';
import {existsSync} from 'node:fs';
if(existsSync('.env.local'))process.loadEnvFile('.env.local');
export default defineConfig({
 testDir:'./tests/e2e',fullyParallel:false,retries:0,
 use:{baseURL:process.env.BASE_URL||'http://localhost:3000',trace:'off'},
 projects:[{name:'chromium',use:{...devices['Desktop Chrome'],channel:process.env.PLAYWRIGHT_CHANNEL}}],
 webServer:process.env.BASE_URL?undefined:{command:'npm run start',url:'http://localhost:3000',reuseExistingServer:true}
});
