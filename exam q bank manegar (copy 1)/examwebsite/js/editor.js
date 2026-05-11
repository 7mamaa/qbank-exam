// editor.js  –  fully standalone (no cross-module imports that depend on index.html)

'use strict';

// ─── State ────────────────────────────────────────────────────────────────────
let questions = [];
let currentIndex = -1;

// ─── DOM References ───────────────────────────────────────────────────────────
const DOM = {
    qList:               document.getElementById('qList'),
    qCount:              document.getElementById('qCount'),
    importBtn:           document.getElementById('importBtn'),
    exportBtn:           document.getElementById('exportBtn'),
    fileInput:           document.getElementById('fileInput'),
    addBtn:              document.getElementById('addBtn'),
    quickPasteBtnEditor: document.getElementById('quickPasteBtnEditor'),
    pasteModalEditor:    document.getElementById('pasteModalEditor'),
    closePasteModalBtn:  document.getElementById('closePasteModalBtn'),
    cancelPasteBtn:      document.getElementById('cancelPasteBtn'),
    loadPasteBtnEditor:  document.getElementById('loadPasteBtnEditor'),
    pasteTextareaEditor: document.getElementById('pasteTextareaEditor'),
    editorArea:          document.getElementById('editorArea'),
    emptyState:          document.getElementById('emptyState'),
    deleteBtn:           document.getElementById('deleteBtn'),
    copyQuestionBtn:     document.getElementById('copyQuestionBtn'),
    pasteQuestionBtn:    document.getElementById('pasteQuestionBtn'),
    toast:               document.getElementById('toast'),

    type:    document.getElementById('edit-type'),
    text:    document.getElementById('edit-text'),
    image:   document.getElementById('edit-image'),
    category: document.getElementById('edit-category'),
    explain: document.getElementById('edit-explain'),

    secOptions:       document.getElementById('section-options'),
    optionsContainer: document.getElementById('options-container'),
    addOptionBtn:     document.getElementById('addOptionBtn'),

    secBool:    document.getElementById('section-boolean'),
    boolAnswer: document.getElementById('edit-bool-answer'),

    secMatch:       document.getElementById('section-match'),
    pairsContainer: document.getElementById('pairs-container'),
    addPairBtn:     document.getElementById('addPairBtn'),

    secWritten: document.getElementById('section-written'),
    keywords:   document.getElementById('edit-keywords'),

    // Google Sheets Modal
    sheetsImportBtn:    document.getElementById('sheetsImportBtn'),
    sheetsModal:        document.getElementById('sheetsModal'),
    closeSheetsModalBtn: document.getElementById('closeSheetsModalBtn'),
    cancelSheetsBtn:    document.getElementById('cancelSheetsBtn'),
    fetchSheetsBtn:     document.getElementById('fetchSheetsBtn'),
    sheetsUrlInput:     document.getElementById('sheetsUrlInput')
};

// ─── Toast ────────────────────────────────────────────────────────────────────
function showToast(msg, isError = false) {
    DOM.toast.textContent = msg;
    DOM.toast.className = `fixed bottom-4 left-1/2 transform -translate-x-1/2 px-6 py-3 rounded shadow-lg transition-opacity duration-300 z-50 text-white ${isError ? 'bg-red-600' : 'bg-gray-800'}`;
    DOM.toast.style.opacity = '1';
    setTimeout(() => { DOM.toast.style.opacity = '0'; }, 3000);
}

// ─── CSV Parser (standalone, no external deps) ────────────────────────────────
function parseCSV(text) {
    const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
    const result = [];
    for (let li = 0; li < lines.length; li++) {
        const line = lines[li];
        // Skip header rows
        if (li === 0 && /^(type|id)[,;]/i.test(line.trim())) continue;

        // Try comma first, fallback to semicolon
        if (line.includes(',')) {
            const cells = [];
            let cur = '', inQ = false;
            for (let i = 0; i < line.length; i++) {
                const c = line[i];
                if (inQ) {
                    if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
                    else if (c === '"') inQ = false;
                    else cur += c;
                } else {
                    if (c === '"') inQ = true;
                    else if (c === ',') { cells.push(cur.trim()); cur = ''; }
                    else cur += c;
                }
            }
            cells.push(cur.trim());
            result.push(cells);
        } else {
            result.push(line.split(';').map(c => c.trim()));
        }
    }
    return result;
}

// ─── Question Processor (standalone) ─────────────────────────────────────────
function processQuestions(data, isJson) {
    const qs = [];

    if (isJson) {
        const items = typeof data === 'string' ? JSON.parse(data) : data;
        if (!Array.isArray(items)) throw new Error('JSON يجب أن يكون مصفوفة');
        items.forEach((item, i) => {
            const type = item.type === 'true_false' ? 'boolean' : (item.type || 'mcq');
            const q = {
                id: item.id || String(Date.now() + i),
                type,
                question: item.question || item.question_text || item.text || '',
                image:    item.image || '',
                category: item.category || '',
                explain:  item.explain || item.key_explain || ''
            };
            if (type === 'mcq') {
                q.options = item.options || [];
                q.answer  = item.answer || item.correct_answer || item.correctAnswer || '';
            } else if (type === 'boolean') {
                q.answer = String(item.answer !== undefined ? item.answer : (item.correct_answer ?? item.correctAnswer ?? 'false'));
            } else if (type === 'match') {
                q.pairs = item.pairs || [];
            } else if (type === 'written') {
                q.keywords = item.ideal_keywords || item.keywords || [];
            }
            qs.push(q);
        });
        return qs;
    }

    // CSV processing
    data.forEach((row, i) => {
        if (row.length < 2) return;
        const typeRaw = row[0].toLowerCase().trim();
        const validTypes = ['mcq', 'match', 'written', 'true_false', 'boolean'];

        if (validTypes.includes(typeRaw)) {
            const type = typeRaw === 'true_false' ? 'boolean' : typeRaw;
            const q = {
                id:       String(Date.now() + i),
                type,
                question: row[1] || '',
                image:    row[4] && row[4] !== 'N/A' ? row[4].trim() : '',
                explain:  row[5] && row[5] !== 'N/A' ? row[5].trim() : '',
                category: row[6] && row[6] !== 'N/A' ? row[6].trim() : ''
            };
            const correctAns = row[2] || '';
            const payload    = row[3] || '';

            if (type === 'mcq') {
                q.options = payload.split('|').map(x => x.trim()).filter(x => x);
                q.answer  = correctAns;
            } else if (type === 'boolean') {
                q.answer = correctAns;
            } else if (type === 'match') {
                q.pairs = payload.split('|').map(x => x.trim()).filter(x => x).map(p => {
                    const idx = p.indexOf(':');
                    return { left: p.slice(0, idx).trim(), right: p.slice(idx + 1).trim() };
                });
            } else if (type === 'written') {
                q.keywords = payload !== 'N/A' && payload ? payload.split('|').map(x => x.trim()) : [];
            }
            qs.push(q);
        } else {
            // Legacy fallback
            const q = {
                id:       row[0] || String(Date.now() + i),
                type:     'mcq',
                question: row[1] || '',
                options:  (row[2] || '').split(/[|;]/).map(o => o.trim()).filter(x => x),
                answer:   row[3] || '',
                image:    row[4] && row[4] !== 'N/A' ? row[4].trim() : '',
                explain:  row[5] && row[5] !== 'N/A' ? row[5].trim() : '',
                category: ''
            };
            qs.push(q);
        }
    });
    return qs;
}

// ─── Default Question Scaffold ────────────────────────────────────────────────
function createNewQuestion() {
    return {
        id:       String(Date.now()),
        type:     'mcq',
        question: 'نص السؤال الجديد',
        options:  ['الخيار الأول', 'الخيار الثاني'],
        answer:   'الخيار الأول',
        image:    '',
        category: '',
        explain:  ''
    };
}

// ─── Sidebar List ─────────────────────────────────────────────────────────────
function renderList() {
    DOM.qList.innerHTML = '';
    DOM.qCount.textContent = questions.length;
    questions.forEach((q, idx) => {
        const div = document.createElement('div');
        div.className = `q-item p-3 rounded cursor-pointer transition hover:bg-gray-100 flex items-start gap-2 text-sm border border-transparent ${idx === currentIndex ? 'active' : 'bg-white shadow-[0_1px_2px_rgba(0,0,0,0.05)]'}`;

        const icons = { mcq: 'fa-list-ul', boolean: 'fa-check-double', match: 'fa-arrows-left-right', written: 'fa-align-left' };
        const icon = icons[q.type] || 'fa-circle-question';

        div.innerHTML = `
            <div class="mt-1 text-gray-400"><i class="fa-solid ${icon}"></i></div>
            <div class="flex-1 overflow-hidden">
                <div class="font-bold text-gray-800 truncate">سؤال ${idx + 1}</div>
                <div class="text-xs text-gray-500 truncate">${q.question || 'بحاجة لنص...'}</div>
            </div>`;
        div.onclick = () => selectQuestion(idx);
        DOM.qList.appendChild(div);
    });

    if (questions.length === 0) {
        DOM.editorArea.style.display = 'none';
        DOM.emptyState.style.display = 'flex';
    }
}

// ─── Type Sections ────────────────────────────────────────────────────────────
function updateTypeSections() {
    const t = DOM.type.value;
    DOM.secOptions.classList.toggle('hidden', t !== 'mcq');
    DOM.secBool.classList.toggle('hidden',    t !== 'boolean');
    DOM.secMatch.classList.toggle('hidden',   t !== 'match');
    DOM.secWritten.classList.toggle('hidden', t !== 'written');
}

// ─── Select Question ──────────────────────────────────────────────────────────
function selectQuestion(idx) {
    saveCurrentQuestion();
    currentIndex = idx;
    const q = questions[idx];

    DOM.editorArea.style.display = 'block';
    DOM.emptyState.style.display = 'none';

    DOM.type.value    = q.type || 'mcq';
    DOM.text.value    = q.question || '';
    DOM.image.value   = q.image    || '';
    DOM.category.value = q.category || '';
    DOM.explain.value  = q.explain  || '';

    updateTypeSections();

    if (q.type === 'mcq') {
        renderOptions(q.options || [], q.answer || '');
    } else if (q.type === 'boolean') {
        DOM.boolAnswer.value = String(q.answer ?? 'false');
    } else if (q.type === 'match') {
        renderPairs(q.pairs || []);
    } else if (q.type === 'written') {
        DOM.keywords.value = (q.keywords || []).join(', ');
    }

    renderList();
}

// ─── Save Current Question ────────────────────────────────────────────────────
function saveCurrentQuestion() {
    if (currentIndex < 0 || currentIndex >= questions.length) return;
    const q = questions[currentIndex];

    q.type     = DOM.type.value;
    q.question = DOM.text.value;
    q.image    = DOM.image.value    || '';
    q.category = DOM.category.value || '';
    q.explain  = DOM.explain.value  || '';

    if (q.type === 'mcq') {
        const opts  = Array.from(DOM.optionsContainer.querySelectorAll('.opt-val')).map(inp => inp.value);
        const radio = DOM.optionsContainer.querySelector('input[type="radio"]:checked');
        q.options = opts;
        q.answer  = radio ? opts[parseInt(radio.value)] : (opts[0] || '');
    } else if (q.type === 'boolean') {
        q.answer = DOM.boolAnswer.value;
    } else if (q.type === 'match') {
        const ls = Array.from(DOM.pairsContainer.querySelectorAll('.pair-l'));
        const rs = Array.from(DOM.pairsContainer.querySelectorAll('.pair-r'));
        q.pairs  = ls.map((l, i) => ({ left: l.value, right: rs[i].value }));
    } else if (q.type === 'written') {
        q.keywords = DOM.keywords.value.split(',').map(s => s.trim()).filter(x => x);
    }

    renderList();
}

// ─── Options (MCQ) ────────────────────────────────────────────────────────────
function renderOptions(optionsArr, correctStr) {
    DOM.optionsContainer.innerHTML = '';
    optionsArr.forEach((opt, i) => {
        const div = document.createElement('div');
        div.className = 'flex items-center gap-2 bg-white p-2 border border-gray-200 rounded';
        const checked = opt.trim().toLowerCase() === String(correctStr).trim().toLowerCase() ? 'checked' : '';
        div.innerHTML = `
            <input type="radio" name="correctOpt" value="${i}" ${checked} class="w-4 h-4 text-blue-600 cursor-pointer">
            <input type="text" value="${opt.replace(/"/g, '&quot;')}" class="opt-val flex-1 border border-gray-300 rounded p-1 text-sm focus:border-blue-500 outline-none">
            <button type="button" class="text-red-500 hover:text-red-700 px-2" onclick="window._editor.removeOption(${i})"><i class="fa-solid fa-times"></i></button>`;
        DOM.optionsContainer.appendChild(div);
    });
}

window._editor = {
    removeOption(i) {
        saveCurrentQuestion();
        const q = questions[currentIndex];
        q.options.splice(i, 1);
        renderOptions(q.options, q.answer);
    },
    removePair(i) {
        saveCurrentQuestion();
        const q = questions[currentIndex];
        q.pairs.splice(i, 1);
        renderPairs(q.pairs);
    }
};

// ─── Pairs (Match) ────────────────────────────────────────────────────────────
function renderPairs(pairsArr) {
    DOM.pairsContainer.innerHTML = '';
    pairsArr.forEach((p, i) => {
        const div = document.createElement('div');
        div.className = 'flex items-center gap-2 bg-white p-2 border border-gray-200 rounded';
        div.innerHTML = `
            <input type="text" class="pair-l w-1/2 border border-gray-300 rounded p-1 text-sm outline-none focus:border-blue-500" value="${(p.left||'').replace(/"/g,'&quot;')}" placeholder="المصطلح">
            <input type="text" class="pair-r w-1/2 border border-gray-300 rounded p-1 text-sm outline-none focus:border-blue-500" value="${(p.right||'').replace(/"/g,'&quot;')}" placeholder="التعريف">
            <button type="button" class="text-red-500 hover:text-red-700 px-2" onclick="window._editor.removePair(${i})"><i class="fa-solid fa-times"></i></button>`;
        DOM.pairsContainer.appendChild(div);
    });
}

// ─── Import Helper ────────────────────────────────────────────────────────────
function importData(text, filename) {
    const isJson = filename ? filename.toLowerCase().endsWith('.json') : text.trim().startsWith('[') || text.trim().startsWith('{');
    let parsed;
    if (isJson) {
        parsed = processQuestions(text, true);
    } else {
        parsed = processQuestions(parseCSV(text), false);
    }
    return parsed;
}

// ─── Event Listeners ──────────────────────────────────────────────────────────

// Type change
DOM.type.addEventListener('change', () => {
    updateTypeSections();
    if (currentIndex < 0) return;
    const q = questions[currentIndex];
    q.type = DOM.type.value;
    if (q.type === 'mcq'   && !q.options) { q.options = ['خيار 1', 'خيار 2']; q.answer = 'خيار 1'; renderOptions(q.options, q.answer); }
    if (q.type === 'match'  && !q.pairs)  { q.pairs   = [{ left: 'مفهوم', right: 'تعريف' }]; renderPairs(q.pairs); }
});

// Add question
DOM.addBtn.addEventListener('click', () => {
    saveCurrentQuestion();
    questions.push(createNewQuestion());
    selectQuestion(questions.length - 1);
});

// Delete question
DOM.deleteBtn.addEventListener('click', () => {
    if (currentIndex < 0) return;
    if (!confirm('هل أنت متأكد من حذف هذا السؤال نهائياً؟')) return;
    questions.splice(currentIndex, 1);
    currentIndex = questions.length > 0 ? 0 : -1;
    if (currentIndex > -1) selectQuestion(currentIndex);
    else renderList();
});

// Copy question
DOM.copyQuestionBtn.addEventListener('click', () => {
    if (currentIndex < 0) return;
    saveCurrentQuestion();
    navigator.clipboard.writeText(JSON.stringify(questions[currentIndex], null, 4))
        .then(() => showToast('تم نسخ بيانات السؤال إلى الحافظة!'))
        .catch(() => showToast('فشل النسخ – تأكد من صلاحيات الحافظة', true));
});

// Paste question
DOM.pasteQuestionBtn.addEventListener('click', async () => {
    try {
        const text   = await navigator.clipboard.readText();
        const parsed = JSON.parse(text);
        if (parsed && typeof parsed === 'object' && parsed.type && parsed.question) {
            saveCurrentQuestion();
            parsed.id = String(Date.now());
            questions.push(parsed);
            selectQuestion(questions.length - 1);
            showToast('تم اللصق وإضافة السؤال بنجاح!');
        } else {
            throw new Error('Invalid schema');
        }
    } catch {
        showToast('خطأ: محتوى الحافظة ليس سؤالاً صالحاً بصيغة JSON', true);
    }
});

// Add option
DOM.addOptionBtn.addEventListener('click', () => {
    if (currentIndex < 0) return;
    saveCurrentQuestion();
    const q = questions[currentIndex];
    if (!q.options) q.options = [];
    q.options.push(`خيار ${q.options.length + 1}`);
    renderOptions(q.options, q.answer);
});

// Add pair
DOM.addPairBtn.addEventListener('click', () => {
    if (currentIndex < 0) return;
    saveCurrentQuestion();
    const q = questions[currentIndex];
    if (!q.pairs) q.pairs = [];
    q.pairs.push({ left: '', right: '' });
    renderPairs(q.pairs);
});

// Auto-save on text blur
DOM.text.addEventListener('blur', saveCurrentQuestion);
DOM.boolAnswer.addEventListener('change', saveCurrentQuestion);

// Import
DOM.importBtn.addEventListener('click', () => DOM.fileInput.click());
DOM.fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
        try {
            const parsed = importData(evt.target.result, file.name);
            if (!parsed || parsed.length === 0) throw new Error('لا توجد أسئلة صالحة');
            questions = questions.concat(parsed);
            selectQuestion(questions.length - parsed.length); // jump to first new
            showToast(`تم استيراد ${parsed.length} سؤال بنجاح`);
        } catch (err) {
            showToast('خطأ في قراءة الملف: ' + err.message, true);
        }
    };
    reader.readAsText(file);
    e.target.value = ''; // reset so same file can be re-imported
});

// Quick Paste Modal
DOM.quickPasteBtnEditor.addEventListener('click', () => {
    DOM.pasteTextareaEditor.value = '';
    DOM.pasteModalEditor.classList.remove('hidden');
});

const closePasteModal = () => DOM.pasteModalEditor.classList.add('hidden');
DOM.closePasteModalBtn.addEventListener('click', closePasteModal);
DOM.cancelPasteBtn.addEventListener('click', closePasteModal);

DOM.loadPasteBtnEditor.addEventListener('click', () => {
    const text = DOM.pasteTextareaEditor.value.trim();
    if (!text) return;
    try {
        const parsed = importData(text);
        if (!parsed || parsed.length === 0) throw new Error('لا توجد أسئلة صالحة');
        questions = questions.concat(parsed);
        selectQuestion(questions.length - parsed.length);
        showToast(`تم إضافة ${parsed.length} سؤال بنجاح`);
        closePasteModal();
    } catch (e) {
        showToast('خطأ: صيغة الأسئلة غير صالحة – ' + e.message, true);
    }
});

// Export JSON
DOM.exportBtn.addEventListener('click', () => {
    saveCurrentQuestion();
    const blob = new Blob([JSON.stringify(questions, null, 4)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `exam_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('تم التصدير بنجاح');
});

// ─── Google Sheets Import ─────────────────────────────────────────────────────
const closeSheetsModal = () => {
    DOM.sheetsModal.classList.add('hidden');
    DOM.sheetsUrlInput.value = '';
};

DOM.sheetsImportBtn.addEventListener('click', () => {
    DOM.sheetsModal.classList.remove('hidden');
    DOM.sheetsUrlInput.focus();
});
DOM.closeSheetsModalBtn.addEventListener('click', closeSheetsModal);
DOM.cancelSheetsBtn.addEventListener('click', closeSheetsModal);

DOM.fetchSheetsBtn.addEventListener('click', async () => {
    const url = DOM.sheetsUrlInput.value.trim();
    if (!url) { showToast('أدخل رابط Google Sheets أولاً', true); return; }

    // Extract sheet ID
    const m = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (!m) { showToast('رابط غير صحيح — يجب أن يحتوي على /d/SHEET_ID', true); return; }
    const sheetId = m[1];
    const csvUrl  = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;

    DOM.fetchSheetsBtn.disabled = true;
    DOM.fetchSheetsBtn.textContent = '⏳ جاري الجلب...';

    try {
        const res = await fetch(csvUrl);
        if (res.status === 403 || res.status === 404) {
            throw new Error('الجدول غير متاح — تأكد من إعداد المشاركة العامة');
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const csvText = await res.text();

        // Scan all cells for embedded JSON capsules
        let parsed = [];
        const rows = csvText.split(/\r?\n/).map(r => r.split(','));
        for (const row of rows) {
            for (const cell of row) {
                const trimmed = cell.trim().replace(/^"+|"+$/g, ''); // de-quote
                if ((trimmed.startsWith('[') || trimmed.startsWith('{'))) {
                    try {
                        const json = JSON.parse(trimmed);
                        if (Array.isArray(json) && json.length > 0 && json[0].type) {
                            parsed = processQuestions(json, true);
                            break;
                        }
                        if (json && json.questions && Array.isArray(json.questions)) {
                            parsed = processQuestions(json.questions, true);
                            break;
                        }
                    } catch { /* not JSON, continue scanning */ }
                }
            }
            if (parsed.length > 0) break;
        }

        // Fallback: treat whole sheet as CSV questions
        if (parsed.length === 0) {
            parsed = processQuestions(parseCSV(csvText), false);
        }

        if (!parsed || parsed.length === 0) throw new Error('لم يتم العثور على أسئلة في الجدول');

        questions = questions.concat(parsed);
        selectQuestion(questions.length - parsed.length);
        showToast(`✅ تم استيراد ${parsed.length} سؤال من Google Sheets`);
        closeSheetsModal();
    } catch (err) {
        showToast('خطأ: ' + err.message, true);
    } finally {
        DOM.fetchSheetsBtn.disabled = false;
        DOM.fetchSheetsBtn.innerHTML = '<i class="fa-solid fa-cloud-arrow-down"></i> جلب الأسئلة';
    }
});

// ─── Init ─────────────────────────────────────────────────────────────────────
renderList();
