import { defineConfig } from '@playwright/test';
export default defineConfig({testDir:'.',testMatch:'desktop.spec.ts',timeout:120000,workers:1,
use:{browserName:'chromium',launchOptions:{args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']}},
webServer:{command:'python -m http.server 8765 --bind 127.0.0.1 --directory '+JSON.stringify(process.env.PREVIEW_ROOT),port:8765,reuseExistingServer:false}});
