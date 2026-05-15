/**
 * @file dedup.worker.js
 * @description Web Worker for high-performance duplicate detection using MinHash + LSH.
 */

let questionsPool = [];
let exactMatchMap = new Map();
let signatureMap = new Map(); // id -> Uint32Array(80)
let trigramMap = new Map(); // id -> Set of trigrams
let bucketMap = new Map(); // bandIndex_bucketHash -> Array<ids>

// 80 Hash Functions coefficients (randomly generated once)
const HASH_COUNT = 80;
const BANDS = 20;
const ROWS_PER_BAND = 4; // HASH_COUNT / BANDS
const hashSeedsA = new Uint32Array(HASH_COUNT);
const hashSeedsB = new Uint32Array(HASH_COUNT);
const PRIME = 4294967291; // Large prime < 2^32

for (let i = 0; i < HASH_COUNT; i++) {
    hashSeedsA[i] = Math.floor(Math.random() * PRIME) || 1;
    hashSeedsB[i] = Math.floor(Math.random() * PRIME);
}

self.onmessage = async function(e) {
    const { type, payload, threshold } = e.data;

    if (type === 'RESET') {
        resetState();
    } else if (type === 'CHUNK') {
        processBatch(payload);
    } else if (type === 'FINISH') {
        const groups = finalize(threshold || 0.9);
        self.postMessage({ type: 'COMPLETE', groups });
    }
};

function resetState() {
    questionsPool = [];
    exactMatchMap = new Map();
    signatureMap = new Map();
    trigramMap = new Map();
    bucketMap = new Map();
}

function normalizeText(text) {
    if (!text) return '';
    return text.toLowerCase()
        .replace(/[\u064B-\u0652]/g, '') // Remove Arabic Tashkeel
        .replace(/[^\w\s\u0600-\u06FF]/g, '') // Remove punctuation
        .replace(/\s+/g, ' ')
        .trim();
}

function getTrigrams(text) {
    const trigrams = new Set();
    if (text.length < 3) {
        trigrams.add(text);
        return trigrams;
    }
    for (let i = 0; i < text.length - 2; i++) {
        trigrams.add(text.substring(i, i + 3));
    }
    return trigrams;
}

function computeSignature(trigrams) {
    const sig = new Uint32Array(HASH_COUNT).fill(PRIME);
    for (const trigram of trigrams) {
        let h = 0;
        for (let i = 0; i < trigram.length; i++) {
            h = (Math.imul(31, h) + trigram.charCodeAt(i)) | 0;
        }
        const val = h >>> 0;

        for (let i = 0; i < HASH_COUNT; i++) {
            const hashVal = (Number((BigInt(hashSeedsA[i]) * BigInt(val) + BigInt(hashSeedsB[i])) % BigInt(PRIME))) >>> 0;
            if (hashVal < sig[i]) sig[i] = hashVal;
        }
    }
    return sig;
}

function processBatch(batch) {
    batch.forEach(q => {
        const norm = normalizeText(q.question);
        if (!norm) return;

        if (!exactMatchMap.has(norm)) {
            exactMatchMap.set(norm, []);
        }
        exactMatchMap.get(norm).push(q.id);

        const trigrams = getTrigrams(norm);
        const sig = computeSignature(trigrams);
        
        signatureMap.set(q.id, sig);
        trigramMap.set(q.id, trigrams);
        questionsPool.push(q);

        for (let b = 0; b < BANDS; b++) {
            let bucketHash = 0;
            for (let r = 0; r < ROWS_PER_BAND; r++) {
                bucketHash = (Math.imul(31, bucketHash) + sig[b * ROWS_PER_BAND + r]) | 0;
            }
            const bucketKey = `${b}_${bucketHash}`;
            if (!bucketMap.has(bucketKey)) {
                bucketMap.set(bucketKey, []);
            }
            bucketMap.get(bucketKey).push(q.id);
        }
    });

    self.postMessage({ type: 'PROGRESS', count: questionsPool.length });
}

function finalize(threshold) {
    const parent = new Map();

    function find(i) {
        if (!parent.has(i)) parent.set(i, i);
        if (parent.get(i) === i) return i;
        const root = find(parent.get(i));
        parent.set(i, root); // Path Compression
        return root;
    }

    function union(i, j) {
        const rootI = find(i);
        const rootJ = find(j);
        if (rootI !== rootJ) {
            parent.set(rootI, rootJ);
        }
    }

    // 1. Initialize all nodes in Union-Find
    questionsPool.forEach(q => find(q.id));

    // 2. Exact matches
    for (const [, ids] of exactMatchMap) {
        if (ids.length > 1) {
            for (let i = 1; i < ids.length; i++) {
                union(ids[0], ids[i]);
            }
        }
    }

    // 3. Fuzzy matches via LSH
    let processedBuckets = 0;
    const totalBuckets = bucketMap.size;
    for (const [, ids] of bucketMap) {
        if (ids.length > 1 && ids.length < 100) {
            for (let i = 0; i < ids.length; i++) {
                for (let j = i + 1; j < ids.length; j++) {
                    const idA = ids[i];
                    const idB = ids[j];
                    if (find(idA) === find(idB)) continue;

                    const setA = trigramMap.get(idA);
                    const setB = trigramMap.get(idB);
                    let intersection = 0;
                    for (const t of setA) if (setB.has(t)) intersection++;
                    const jaccard = intersection / (setA.size + setB.size - intersection);

                    if (jaccard >= threshold) {
                        union(idA, idB);
                    }
                }
            }
        }
        processedBuckets++;
        if (processedBuckets % 1000 === 0) {
            self.postMessage({ type: 'PROGRESS_PHASE', label: 'Clustering...', progress: Math.round((processedBuckets / totalBuckets) * 100) });
        }
    }

    // 4. Extract Groups
    const groupsMap = new Map();
    for (const [id] of parent) {
        const root = find(id);
        if (!groupsMap.has(root)) groupsMap.set(root, []);
        groupsMap.get(root).push(id);
    }

    // 5. Convert to final format (Array of Objects with original/duplicates)
    const qMap = new Map(questionsPool.map(q => [q.id, q]));
    const finalGroups = [];

    for (const ids of groupsMap.values()) {
        if (ids.length > 1) {
            const original = qMap.get(ids[0]);
            const duplicates = ids.slice(1).map(id => {
                const q = qMap.get(id);
                const setA = trigramMap.get(ids[0]);
                const setB = trigramMap.get(id);
                let intersection = 0;
                for (const t of setA) if (setB.has(t)) intersection++;
                const jaccard = intersection / (setA.size + setB.size - intersection);

                return {
                    question: q,
                    similarity: Math.round(jaccard * 100)
                };
            });
            finalGroups.push({ original, duplicates });
        }
    }

    // Sort by highest similarity
    finalGroups.sort((a, b) => b.duplicates[0].similarity - a.duplicates[0].similarity);

    return finalGroups;
}
