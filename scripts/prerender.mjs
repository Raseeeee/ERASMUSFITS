// Inyecta en dist/index.html la bienvenida prerenderizada (es/en) y un script mínimo
// que la muestra al instante solo a usuarios nuevos en "/" o "/onboarding".
// Se ejecuta tras `vite build` y `vite build --ssr src/prerender.tsx` (ver package.json).
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const ssr = await import(pathToFileURL(resolve(root, 'dist-ssr/prerender.js')).href);
const es = await ssr.render('es');
const en = await ssr.render('en');

const pick = `<script>(function(){try{if(localStorage.getItem('ee.onboarded')==='1')return;var p=location.pathname;if(p!=='/'&&p!=='/onboarding')return;var l=(navigator.language||'').toLowerCase().indexOf('es')===0?'es':'en';var t=document.getElementById('pre-'+l);if(t){document.getElementById('root').innerHTML=t.innerHTML;document.documentElement.lang=l;}}catch(e){}})()</script>`;

const file = resolve(root, 'dist/index.html');
let html = readFileSync(file, 'utf8');
if (html.includes('id="pre-es"')) throw new Error('index.html ya está prerenderizado');
html = html.replace(
  '<div id="root"></div>',
  `<div id="root"></div>\n    <template id="pre-es">${es}</template>\n    <template id="pre-en">${en}</template>\n    ${pick}`,
);
writeFileSync(file, html);
rmSync(resolve(root, 'dist-ssr'), { recursive: true, force: true });
console.log(`prerender: bienvenida es (${es.length} B) y en (${en.length} B) inyectadas en dist/index.html`);
