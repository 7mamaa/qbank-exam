import { ar } from './src/locales/ar.js';
import { en } from './src/locales/en.js';

const arKeys = Object.keys(ar);
const enKeys = Object.keys(en);

const missingInEn = arKeys.filter(k => !enKeys.includes(k));
const missingInAr = enKeys.filter(k => !arKeys.includes(k));

console.log('Missing in EN:', missingInEn);
console.log('Missing in AR:', missingInAr);
