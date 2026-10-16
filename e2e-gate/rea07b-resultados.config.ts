import {defineConfig,devices} from '@playwright/test';
import {resolve} from 'node:path';
const salida=resolve('output/rea-integracion/rea07b/resultados-runtime',process.env.REA07B_EVIDENCIA??'chrome-1');
export default defineConfig({testDir:'.',testMatch:'rea07b-resultados.spec.mts',workers:1,fullyParallel:false,retries:0,timeout:120000,expect:{timeout:25000},reporter:[['list'],['json',{outputFile:resolve(salida,'resultado.json')}]],outputDir:resolve(salida,'trazas'),use:{...devices['Desktop Chrome'],channel:'chrome',baseURL:'http://localhost:3121',viewport:{width:1440,height:1000},trace:'retain-on-failure',screenshot:'only-on-failure',actionTimeout:20000}});
