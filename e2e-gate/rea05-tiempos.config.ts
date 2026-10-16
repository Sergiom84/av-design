import { defineConfig, devices } from '@playwright/test';
import { resolve } from 'node:path';
const salida=resolve('output/rea-integracion/rea05/tiempos-runtime');
export default defineConfig({testDir:'.',testMatch:'rea05-tiempos.spec.mts',workers:1,retries:0,fullyParallel:false,timeout:120000,expect:{timeout:15000},reporter:[['list'],['json',{outputFile:resolve(salida,'e2e-resultados.json')}]],outputDir:resolve(salida,'trazas'),use:{...devices['Desktop Chrome'],channel:'chrome',baseURL:'http://localhost:3115',viewport:{width:1440,height:1000},trace:'retain-on-failure',screenshot:'only-on-failure'}});
