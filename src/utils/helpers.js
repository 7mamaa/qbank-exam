import { i18n } from '../core/i18n.js';
export const Helpers = {
    /**
     * Optimized Sanitizer: Fast & Secure against common XSS
     * @param {string} str 
     * @returns {string}
     */
    sanitize(str) {
        if (!str || typeof str !== 'string') return '';
        const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
        return str.replace(/[&<>"']/g, m => map[m]);
    },
    /**
     * Performs a fuzzy search on text using Levenshtein distance and word matching.
     * @param {string} text - The source text to search in.
     * @param {string} query - The search query.
     * @returns {boolean} True if match found.
     */
    fuzzyMatch(text, query) {
        text = text.toLowerCase();
        query = query.toLowerCase();
        if (text.includes(query)) return true;

        const queryWords = query.split(/\s+/).filter(w => w.length > 2);
        if (queryWords.length === 0) return text.includes(query);

        const textWords = text.split(/[\s,.;:()!]+/).filter(w => w.length > 2);

        return queryWords.every(qw => {
            return textWords.some(tw => {
                if (tw.includes(qw)) return true;
                const distance = this.levenshtein(tw, qw);
                const threshold = qw.length > 6 ? 2 : 1;
                return distance <= threshold;
            });
        });
    },

    /**
     * Calculates the Levenshtein distance between two strings with memoization.
     * @param {string} a 
     * @param {string} b 
     * @returns {number}
     */
    _levCache: new Map(),
    levenshtein(a, b) {
        if (a === b) return 0;
        if (a.length > b.length) [a, b] = [b, a];
        
        const key = `${a}|${b}`;
        if (this._levCache.has(key)) return this._levCache.get(key);

        const tmp = Array.from({ length: a.length + 1 }, (_, i) => i);
        
        for (let i = 1; i <= b.length; i++) {
            let prev = i;
            for (let j = 1; j <= a.length; j++) {
                const val = b[i - 1] === a[j - 1] ? tmp[j - 1] : Math.min(tmp[j - 1] + 1, tmp[j] + 1, prev + 1);
                tmp[j - 1] = prev;
                prev = val;
            }
            tmp[a.length] = prev;
        }
        
        const res = tmp[a.length];
        if (this._levCache.size < 2000) this._levCache.set(key, res);
        return res;
    },

    /**
     * Calculates percentage similarity between two strings.
     * @returns {number} 0 to 1.
     */
    calculateSimilarity(s1, s2) {
        const longer = s1.length > s2.length ? s1 : s2;
        const shorter = s1.length > s2.length ? s2 : s1;
        if (longer.length === 0) return 1.0;
        return (longer.length - this.levenshtein(longer, shorter)) / longer.length;
    },

    /**
     * Fetches a URL using multiple proxy strategies to bypass CORS.
     * @param {string} url 
     * @returns {Promise<string|null>}
     */
    async fetchUrlWithProxy(url) {
        let finalUrl = url;
        
        // Transform common links
        if (url.includes('drive.google.com')) {
            const id = url.match(/\/d\/([a-zA-Z0-9_-]+)/)?.[1];
            if (id) finalUrl = `https://drive.google.com/uc?export=download&id=${id}`;
        } else if (url.includes('dropbox.com')) {
            finalUrl = url.replace(/dl=[01]$|raw=[01]$/, '') + (url.includes('?') ? '&' : '?') + 'raw=1';
        } else if (url.includes('github.com') && url.includes('/blob/')) {
            finalUrl = url.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/');
        }

        const strategies = [
            async () => (await fetch(finalUrl)).text(),
            async () => (await fetch(`https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(finalUrl)}`)).text(),
            async () => (await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(finalUrl)}`)).text()
        ];

        for (let strategy of strategies) {
            try {
                const text = await strategy();
                if (text && text.length > 10) return text;
            } catch { console.warn("Proxy strategy failed."); }
        }
        throw new Error(i18n.t("err_fetch_fail"));
    },

    /**
     * Sanitizes raw JSON string to escape newlines inside string literals
     * and remove invalid escape sequences (like \').
     * Refactored for extreme robustness against AI artifacts.
     */
    sanitizeJsonString(raw) {
        if (!raw) return '';
        
        // 1. Pre-cleanup: Remove trailing commas in arrays/objects which break JSON.parse
        let clean = raw.trim().replace(/,\s*([\]}])/g, '$1');

        // 2. State-based escaping for unescaped control characters inside strings
        let result = '';
        let inString = false;
        let escapeNext = false;
        const validEscapes = ['"', '\\', '/', 'b', 'f', 'n', 'r', 't', 'u'];

        for (let i = 0; i < clean.length; i++) {
            const char = clean[i];
            if (escapeNext) {
                result += validEscapes.includes(char) ? char : char; // Keep as is, but could drop \
                escapeNext = false;
            } else if (char === '\\') {
                result += char;
                escapeNext = true;
            } else if (char === '"') {
                inString = !inString;
                result += char;
            } else if (inString && (char === '\n' || char === '\r')) {
                result += '\\n'; // Normalize multi-line AI strings
            } else if (inString && char === '\t') {
                result += '\\t';
            } else {
                result += char;
            }
        }
        return result;
    },

    /**
     * Parses raw text into question objects using simple heuristics.
     * @param {string} text 
     * @returns {Array}
     */
    parseSmartText(text) {
        text = text.trim();
        if (text.startsWith('[') || text.startsWith('{')) {
            // Auto-sanitize common AI JSON errors (like unescaped newlines inside strings)
            let cleanText = this.sanitizeJsonString(text);
            let parsed = JSON.parse(cleanText);
            return Array.isArray(parsed) ? parsed : [parsed];
        }
        
        const lines = text.split('\n').map(l => l.trim()).filter(l => l);
        const questions = [];
        let currentQ = null;

        lines.forEach(line => {
            if ((line.includes('السؤال:') || line.includes('Question:')) || line.match(/^\d+[:.]/)) {
                if (currentQ) questions.push(currentQ);
                currentQ = {
                    type: 'mcq',
                    question: line.replace(/^\d+[:.]?/, '').replace('السؤال:', '').replace('Question:', '').trim(),
                    options: [],
                    answer: '',
                    explain: '',
                    difficulty: 'medium',
                    tags: ['smart_import']
                };
            } else if (line.match(/^([أبجدabcd])\s*[()-.]\s*(.*)/i)) {
                const m = line.match(/^([أبجدabcd])\s*[()-.]\s*(.*)/i);
                if (currentQ && currentQ.options.length < 4) currentQ.options.push(m[2].trim());
            } else if ((line.includes('💡') || line.includes('الجواب:') || line.includes('Answer:'))) {
                if (currentQ) currentQ.explain = line.replace(/💡|الجواب:|Answer:/g, '').trim();
            } else if (currentQ && currentQ.options.length === 0) {
                currentQ.question += ' ' + line;
            }
        });

        if (currentQ) questions.push(currentQ);
        questions.forEach(q => { while (q.options.length < 4) q.options.push(''); });
        return questions.filter(q => q.question.length > 5);
    },

    /**
     * Generates HTML for printing a notebook.
     * @returns {string} HTML string.
     */
    generatePrintHTML(title, qList, mode) {
        let html = `
            <div class="print-header">
                <h2 style="font-size:2rem; margin-bottom:10px;">${this.sanitize(title)}</h2>
                <p>${i18n.t('print_q_count', {count: qList.length})} | ${i18n.t('print_type', {type: mode === 'exam' ? i18n.t('print_type_exam') : i18n.t('print_type_study')})}</p>
            </div>
        `;

        qList.forEach((q, idx) => {
            html += `<div class="print-question">`;
            html += `<h3 style="margin-bottom:15px;">السؤال ${idx + 1}: ${this.sanitize(q.question)}</h3>`;
            if (q.image) html += `<img src="${q.image}" style="max-width:300px; display:block; margin-bottom:15px;">`;

            if (q.type === 'mcq') {
                html += `<ul style="list-style: none; padding-right: 20px;">`;
                const labels = ['a', 'b', 'c', 'd'];
                q.options.forEach((opt, oIdx) => {
                    const isAns = mode === 'study' && opt === q.answer;
                    html += `<li style="${isAns ? 'font-weight:bold; background:#eee; padding:5px;' : ''}">${labels[oIdx]}) ${this.sanitize(opt)}</li>`;
                });
                html += `</ul>`;
            } else if (q.type === 'boolean') {
                html += `<p>${i18n.t('print_boolean')}</p>`;
                if (mode === 'study') html += `<p>${i18n.t('print_ans', {text: q.answer ? i18n.t('print_ans_true') : i18n.t('print_ans_false')})}</p>`;
            } else if (q.type === 'written') {
                html += `<div style="height: 60px; border-bottom: 1px dotted #000;"></div>`;
                if (mode === 'study') {
                    const ansText = q.answer || (q.keywords ? q.keywords.join(', ') : '');
                    html += `<p>${i18n.t('print_written_ans', {text: this.sanitize(ansText)})}</p>`;
                }
            } else if (q.type === 'match') {
                html += `<p>${i18n.t('print_match')}</p>`;
                q.pairs.forEach(p => {
                    html += `<div style="display:flex; justify-content:space-between; margin-bottom:5px;"><span>${this.sanitize(p.left)}</span> <span>.......</span> <span>${this.sanitize(p.right)}</span></div>`;
                });
            }
            if (mode === 'study' && q.explain) html += `<p style="font-style:italic; color:#666;">${i18n.t('print_explain', {text: this.sanitize(q.explain)})}</p>`;
            html += `</div>`;
        });
        return html;
    },
    /**
     * Estimates the current storage quota and usage.
     * @returns {Promise<{used: number, total: number, percent: number}>}
     */
    async getStorageQuota() {
        if (navigator.storage && navigator.storage.estimate) {
            const { usage, quota } = await navigator.storage.estimate();
            return {
                used: usage,
                total: quota,
                percent: Math.round((usage / quota) * 100)
            };
        }
        return { used: 0, total: 0, percent: 0 };
    },
    /**
     * Formats bytes to human-readable string.
     */
    formatBytes(bytes, decimals = 2) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    },

    /**
     * Generates a cryptographically strong unique ID.
     * Fallback to high-entropy random string for older environments.
     * @returns {string}
     */
    generateId() {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            return crypto.randomUUID();
        }
        return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
    },

    /**
     * Processes items in chunks asynchronously to prevent UI freezing.
     * @param {Array} items - The array of items to process.
     * @param {number} size - Chunk size.
     * @param {Function} fn - Async function to run on each item.
     */
    async runInChunks(items, size, fn) {
        for (let i = 0; i < items.length; i += size) {
            const chunk = items.slice(i, i + size);
            for (const item of chunk) await fn(item);
            await new Promise(r => setTimeout(r, 0)); // breathe
        }
    }
};

window.Helpers = Helpers;
