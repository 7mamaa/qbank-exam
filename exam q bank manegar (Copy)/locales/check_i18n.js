import { readFileSync } from 'fs';

// Helper to extract keys from a JS object string
function extractKeys(content) {
    const keys = [];
    const regex = /"([^"]+)"\s*:/g;
    let match;
    while ((match = regex.exec(content)) !== null) {
        keys.push(match[1]);
    }
    return keys;
}

const arContent = readFileSync('src/locales/ar.js', 'utf8');
const enContent = readFileSync('src/locales/en.js', 'utf8');
const usedKeys = readFileSync('all_used_keys.txt', 'utf8').split('\n').map(k => k.trim()).filter(Boolean);

const arKeys = extractKeys(arContent);
const enKeys = extractKeys(enContent);

console.log('--- Missing in ar.js ---');
usedKeys.forEach(key => {
    if (!arKeys.includes(key)) console.log(key);
});

console.log('\n--- Missing in en.js ---');
usedKeys.forEach(key => {
    if (!enKeys.includes(key)) console.log(key);
});

console.log('\n--- Unused in ar.js (Extra) ---');
arKeys.forEach(key => {
    if (!usedKeys.includes(key)) console.log(key);
});
