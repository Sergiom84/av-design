import { defineConfig,devices } from '@playwright/test';
import { resolve } from 'node:path';
const salida=resolve('output/rea-integracion/rea05/costes-runtime',process.env.REA05_COSTES_EVIDENCIA??'e2e');
export default defineConfig({testDir:'.',testMatch:'rea05-costes.spec.mts',workers:1,fullyParallel:false,retries:0,timeout:120000,expect:{timeout:25000},reporter:[['list'],['json',{outputFile:resolve(salida,'resultados.json')}]],outputDir:resolve(salida,'trazas'),use:{...devices['Desktop Chrome'],channel:'chrome',baseURL:'http://localhost:3117',viewport:{width:1440,height:1000},trace:'retain-on-failure',screenshot:'only-on-failure',actionTimeout:20000}});
