
import { ar } from './src/locales/ar.js';
import { en } from './src/locales/en.js';
import fs from 'fs';

const indexHtml = fs.readFileSync('index.html', 'utf8');

const i18nKeys = [...indexHtml.matchAll(/data-i18n="([^"]+)"/g)].map(m => m[1]);
const placeholderKeys = [...indexHtml.matchAll(/data-i18n-placeholder="([^"]+)"/g)].map(m => m[1]);
const titleKeys = [...indexHtml.matchAll(/data-i18n-title="([^"]+)"/g)].map(m => m[1]);

const allUsedKeys = new Set([...i18nKeys, ...placeholderKeys, ...titleKeys]);

console.log('--- Missing in AR ---');
allUsedKeys.forEach(key => {
    if (!ar[key]) {
        console.log(key);
    }
});

console.log('\n--- Missing in EN ---');
allUsedKeys.forEach(key => {
    if (!en[key]) {
        console.log(key);
    }
});
