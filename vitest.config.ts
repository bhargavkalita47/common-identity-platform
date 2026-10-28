import {fileURLToPath} from 'node:url';
import {defineConfig} from 'vitest/config';
import {existsSync} from 'node:fs';
if(existsSync('.env.local'))process.loadEnvFile('.env.local');
export default defineConfig({resolve:{alias:{'@':fileURLToPath(new URL('./src',import.meta.url))}},test:{include:['tests/**/*.test.ts'],testTimeout:30000,hookTimeout:120000,fileParallelism:false}});
