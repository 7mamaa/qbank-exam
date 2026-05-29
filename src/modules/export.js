/* global pako, app */
import { state } from '../core/state.js?v=16.6.1';
import { db } from '../core/db.js?v=16.6.1';
import { QueryEngine } from '../core/query.js?v=16.6.1';
import { i18n } from '../core/i18n.js?v=16.6.1';
import { Helpers } from '../utils/helpers.js?v=16.6.1';
import { Logger } from '../utils/logger.js?v=16.6.1';
import { UIComponents } from '../ui/components.js?v=16.6.1';
import { pdfThemes } from '../ui/pdfThemes.js';

async function validateIncomingPayload(payload, notebooks, activeNotebookId, autoDistribute) {
    if (!payload) throw new Error("الملف فارغ أو تالف");

    // المسار الفولاذي الأول: الملف عبارة عن كبسولة مجمعة مطورة (Envelope Payload)
    if (payload.notebooks && payload.questions) {
        console.log("[Import Engine] تفعيل مسار الكبسولة المجمعة المطورة...");
        
        // دمج وحفظ الدفاتر المستوردة ذرياً مع الحفاظ على الأسم ومعرفات الأب والابن
        const localNotebooks = globalThis.app?.state?.notebooks || notebooks || [];
        const localIds = new Set(localNotebooks.map(nb => nb.id));
        const localTitles = new Set(localNotebooks.map(nb => nb.title?.trim()));

        for (const importedNb of payload.notebooks) {
            // منع تكرار الدفاتر بالـ ID أو الاسم النصي لحماية السايد بار من الانفجار
            if (!localIds.has(importedNb.id) && !localTitles.has(importedNb.title?.trim())) {
                localNotebooks.push(importedNb);
                if (db.instance) {
                    const tx = db.instance.transaction(['notebooks'], 'readwrite');
                    await tx.objectStore('notebooks').put(importedNb);
                }
            }
        }
        
        // تمرير الأسئلة المرافقة مباشرة دون تدمير معرفاتها
        return payload.questions;
    }

    // المسار الثاني: التوافق الرجعي لو الملف مجرد مصفوفة أسئلة مسطحة (Legacy Flat Array)
    if (Array.isArray(payload)) {
        console.log("[Import Engine] تفعيل مسار التوافق الرجعي للمصفوفات المسطحة...");
        const cleanQuestions = [];
        
        const isUUID = (str) => typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

        // تجميع معلومات الدفاتر الموجودة للمقارنة
        const localNbs = notebooks || [];
        const notebooksById = new Map();
        const notebooksByName = new Map();

        localNbs.forEach(nb => {
            if (nb && nb.id) {
                notebooksById.set(String(nb.id), nb);
                const titleKey = (nb.title || nb.name || "").trim().toLowerCase();
                if (titleKey) {
                    notebooksByName.set(titleKey, nb);
                }
            }
        });

        const newNotebooksList = [];
        const addNewNotebook = (id, name) => {
            const newNb = {
                id,
                title: name,
                name: name,
                icon: '📁',
                color: '#4361ee',
                createdAt: Date.now()
            };
            newNotebooksList.push(newNb);
            localNbs.push(newNb);
            notebooksById.set(id, newNb);
            notebooksByName.set(name.trim().toLowerCase(), newNb);
            return newNb;
        };

        const getAggregatedNotebook = () => {
            const today = new Date();
            const dd = String(today.getDate()).padStart(2, '0');
            const mm = String(today.getMonth() + 1).padStart(2, '0');
            const yyyy = today.getFullYear();
            const nbName = `(استيراد تلقائي - ${dd}/${mm}/${yyyy})`;
            const nbNameLower = nbName.toLowerCase();
            
            if (notebooksByName.has(nbNameLower)) {
                return notebooksByName.get(nbNameLower);
            }
            
            const newId = (typeof crypto !== 'undefined' && crypto.randomUUID) 
                ? crypto.randomUUID() 
                : `nb_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
            return addNewNotebook(newId, nbName);
        };

        // حساب أعلى رقم مسلسل للأسئلة
        const maxQNumbersByNotebook = new Map();
        const getMaxQForNotebook = (nbId) => {
            if (!nbId) return 0;
            if (maxQNumbersByNotebook.has(nbId)) {
                return maxQNumbersByNotebook.get(nbId);
            }
            const localQs = (globalThis.app?.state?.questions || []);
            const maxVal = Math.max(...localQs.filter(item => item.notebookId === nbId).map(item => item.qNumber || 0), 0);
            maxQNumbersByNotebook.set(nbId, maxVal);
            return maxVal;
        };

        const maxQForForced = !autoDistribute ? getMaxQForNotebook(activeNotebookId) : 0;

        for (let i = 0; i < payload.length; i++) {
            const q = payload[i];

            // 1. تنظيف الحقول الأساسية وتصحيح المعرفات المفقودة
            if (!q.id || typeof q.id !== 'string' || q.id.trim() === '') {
                q.id = (typeof crypto !== 'undefined' && crypto.randomUUID)
                    ? crypto.randomUUID()
                    : `self_healed_${Date.now()}_${Math.random().toString(36).substring(2, 10)}_${i}`;
            }

            // تصحيح نوع الأسئلة الثنائية (boolean)
            if (q.type === 'boolean') {
                if (q.answer === 'true' || q.answer === true) {
                    q.answer = true;
                } else {
                    q.answer = false;
                }
            }

            // 2. تطبيق المصفوفة الرباعية الاحتياطية بناءً على خيارات الواجهة
            if (!autoDistribute) {
                // الصب القسري في الدفتر النشط المختار
                q.notebookId = activeNotebookId;
            } else {
                const idKey = q.notebookId ? String(q.notebookId).trim() : "";
                const nameKey = q.notebookName ? String(q.notebookName).trim().toLowerCase() : "";

                let resolvedNb = null;
                if (idKey && notebooksById.has(idKey)) {
                    resolvedNb = notebooksById.get(idKey);
                } else {
                    const idKeyLower = idKey.toLowerCase();
                    if (nameKey && notebooksByName.has(nameKey)) {
                        resolvedNb = notebooksByName.get(nameKey);
                    } else if (idKey && notebooksByName.has(idKeyLower)) {
                        resolvedNb = notebooksByName.get(idKeyLower);
                    }
                }

                if (resolvedNb) {
                    q.notebookId = resolvedNb.id;
                } else {
                    const hasUUID = isUUID(q.notebookId);
                    const hasName = typeof q.notebookName === 'string' && q.notebookName.trim() !== '';

                    if (hasUUID && !hasName) {
                        const newNb = addNewNotebook(q.notebookId, q.notebookId);
                        q.notebookId = newNb.id;
                    } else if (hasUUID && hasName) {
                        const newNb = addNewNotebook(q.notebookId, q.notebookName.trim());
                        q.notebookId = newNb.id;
                    } else if (hasName && !hasUUID) {
                        const newId = (typeof crypto !== 'undefined' && crypto.randomUUID)
                            ? crypto.randomUUID()
                            : `nb_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
                        const newNb = addNewNotebook(newId, q.notebookName.trim());
                        q.notebookId = newNb.id;
                    } else if (!q.notebookId && !hasName) {
                        const aggNb = getAggregatedNotebook();
                        q.notebookId = aggNb.id;
                    } else {
                        q.notebookId = null;
                    }
                }
            }

            // 3. توليد رقم المسلسل الذكي (qNumber)
            if (!autoDistribute) {
                q.qNumber = maxQForForced + i + 1;
            } else {
                const groupKey = q.notebookId || "floating";
                const maxQ = getMaxQForNotebook(groupKey);
                const nextQ = maxQ + 1;
                q.qNumber = nextQ;
                maxQNumbersByNotebook.set(groupKey, nextQ);
            }

            cleanQuestions.push(q);
        }

        // حفظ الدفاتر الجديدة ذرياً
        if (newNotebooksList.length > 0 && db.instance) {
            const tx = db.instance.transaction(['notebooks'], 'readwrite');
            const store = tx.objectStore('notebooks');
            newNotebooksList.forEach(nb => store.put(nb));
        }



        return cleanQuestions;
    }

    throw new Error("صيغة ملف الاستيراد غير مدعومة هندسياً");
}

export const ExportModule = {
    async validateIncomingPayload(payload, existingNotebooks = [], optionsOrActiveId = {}, autoDistributeOpt = undefined) {
        let activeNotebookId;
        let autoDistribute;

        if (optionsOrActiveId && typeof optionsOrActiveId === 'object' && !Array.isArray(optionsOrActiveId)) {
            activeNotebookId = optionsOrActiveId.activeNotebookId;
            autoDistribute = optionsOrActiveId.autoDistribute !== undefined ? optionsOrActiveId.autoDistribute : true;
        } else {
            activeNotebookId = optionsOrActiveId;
            autoDistribute = autoDistributeOpt !== undefined ? autoDistributeOpt : true;
        }

        const notebooksCopy = [...existingNotebooks];

        const questions = await validateIncomingPayload(payload, notebooksCopy, activeNotebookId, autoDistribute);

        const newNotebooks = notebooksCopy.filter(nb => !existingNotebooks.some(existing => existing.id === nb.id));

        newNotebooks.forEach(nb => existingNotebooks.push(nb));

        const appNbs = globalThis.app?.state?.notebooks;
        if (appNbs) {
            newNotebooks.forEach(nb => {
                if (!appNbs.some(n => n.id === nb.id)) {
                    appNbs.push(nb);
                }
            });
        }

        const floatingCount = Array.isArray(questions) ? questions.filter(q => !q.notebookId).length : 0;

        return {
            success: true,
            floatingCount,
            newNotebooks,
            questions
        };
    },

    updateExportScopeCounts() {
        const pool = QueryEngine.getQueryPool();
        const count = pool.length;
        
        const countEls = document.querySelectorAll('.export-scope-count');
        countEls.forEach(el => {
            el.textContent = i18n.t('export_questions_count', { count });
        });
    },

    escapeCSV(text) {
        if (text === null || text === undefined) return '""';
        let cleanText = String(text).replace(/"/g, '""'); 
        return `"${cleanText}"`;
    },

    renderExportOptions(format) {
        // Inject missing localization keys dynamically to keep surgical modifications localized to src/modules/export.js
        if (typeof i18n !== 'undefined' && i18n.locales) {
            if (i18n.locales.ar && !i18n.locales.ar['json_advanced_settings']) {
                i18n.locales.ar['json_advanced_settings'] = '⚙️ إعدادات JSON المتقدمة';
                i18n.locales.ar['export_opt_beautify'] = 'تنسيق الملف الجمالي (Beautify)';
                i18n.locales.ar['export_opt_compress'] = 'تفعيل ضغط GZIP';
            }
            if (i18n.locales.en && !i18n.locales.en['json_advanced_settings']) {
                i18n.locales.en['json_advanced_settings'] = '⚙️ Advanced JSON Settings';
                i18n.locales.en['export_opt_beautify'] = 'Beautify JSON';
                i18n.locales.en['export_opt_compress'] = 'Enable GZIP Compression';
            }
            if (i18n.locales.ar && !i18n.locales.ar['pdf_split_sessions_label']) {
                i18n.locales.ar['pdf_split_sessions_label'] = 'تقسيم بنك الأسئلة إلى جلسات مذاكرة ذكية';
                i18n.locales.ar['pdf_session_duration_label'] = 'مدة الجلسة الواحدة (بالدقائق):';
                i18n.locales.ar['minutes_label'] = 'دقيقة';
            }
            if (i18n.locales.en && !i18n.locales.en['pdf_split_sessions_label']) {
                i18n.locales.en['pdf_split_sessions_label'] = 'Split question bank into smart study sessions';
                i18n.locales.en['pdf_session_duration_label'] = 'Session duration (in minutes):';
                i18n.locales.en['minutes_label'] = 'min';
            }
        }

        let jsonCard = document.getElementById('json-advanced-card');
        if (!jsonCard) {
            const actionCard = document.querySelector('.export-action-card');
            if (actionCard) {
                jsonCard = document.createElement('div');
                jsonCard.id = 'json-advanced-card';
                jsonCard.className = 'stat-card';
                jsonCard.style.display = 'none';
                jsonCard.style.border = '2px solid var(--primary)';
                jsonCard.style.background = 'rgba(67, 97, 238, 0.02)';
                actionCard.parentNode.insertBefore(jsonCard, actionCard);
            }
        }

        if (jsonCard) {
            jsonCard.style.display = (format === 'json') ? 'block' : 'none';
            if (format === 'json' && !jsonCard.innerHTML.trim()) {
                jsonCard.innerHTML = `
                    <h3 style="margin-bottom:15px; color:var(--primary); display: flex; align-items: center; gap: 8px;">
                        <span data-i18n="json_advanced_settings">${i18n.t('json_advanced_settings')}</span>
                    </h3>
                    <div style="display: grid; grid-template-columns: 1fr; gap: 12px;">
                        <label class="custom-checkbox">
                            <input type="checkbox" id="exportBeautify">
                            <span class="checkmark"></span>
                            <span data-i18n="export_opt_beautify">${i18n.t('export_opt_beautify')}</span>
                        </label>
                        <label class="custom-checkbox">
                            <input type="checkbox" id="exportCompress" checked>
                            <span class="checkmark"></span>
                            <span data-i18n="export_opt_compress">${i18n.t('export_opt_compress')}</span>
                        </label>
                    </div>
                `;
            }
        }
    },

    exportData: async function(fmt, passedPool, showToastCallback) {
        try {
            const format = String(fmt).toLowerCase();
            const pool = passedPool || globalThis.app?.getQueryPool?.() || globalThis.app?.state?.questions || [];
            
            if (!pool || pool.length === 0) {
                if (showToastCallback) showToastCallback(i18n.t('msg_no_data_found') || "لا توجد أسئلة للتصدير", 'warning');
                return;
            }
            
            if (format === 'json') {
                const notebooks = globalThis.app?.state?.notebooks || state.notebooks || [];
                const exportEnvelope = {
                    version: "16.6.1",
                    exportDate: new Date().toISOString(),
                    notebooks: notebooks,
                    questions: pool
                };
                
                const isBeautify = document.getElementById('exportBeautify')?.checked;
                const isCompress = document.getElementById('exportCompress')?.checked;
                
                const jsonString = isBeautify ? JSON.stringify(exportEnvelope, null, 2) : JSON.stringify(exportEnvelope);
                
                if (isCompress) {
                    let compressedBlob;
                    if (typeof CompressionStream !== 'undefined') {
                        const stream = new ReadableStream({
                            start(controller) {
                                controller.enqueue(new TextEncoder().encode(jsonString));
                                controller.close();
                            }
                        }).pipeThrough(new CompressionStream('gzip'));
                        
                        compressedBlob = await new Response(stream).blob();
                    } else if (typeof pako !== 'undefined') {
                        const compressed = pako.gzip(jsonString);
                        compressedBlob = new Blob([compressed], { type: 'application/gzip' });
                    } else {
                        throw new Error("GZIP compression not supported by browser");
                    }
                    this.downloadFile(compressedBlob, `qbank_backup_${Date.now()}.json.gz`);
                } else {
                    const blob = new Blob([jsonString], { type: 'application/json' });
                    this.downloadFile(blob, `qbank_backup_${Date.now()}.json`);
                }
                
                if (showToastCallback) showToastCallback(i18n.t('msg_export_success') || "تم التصدير بنجاح!");
            } else if (format === 'csv') {
                this.exportCSV(pool);
                if (showToastCallback) showToastCallback(i18n.t('msg_export_success') || "تم التصدير بنجاح!");
            } else if (format === 'pdf' || format === 'print') {
                this.exportToPdf(pool);
            } else if (format === 'word') {
                await this.exportToWord(pool, showToastCallback);
            } else {
                throw new Error("صيغة التصدير غير مدعومة: " + format);
            }
        } catch (error) {
            console.error("[Export Engine Crash]:", error);
            alert("❌ فشل التصدير: " + error.message);
        }
    },

    exportCSV(pool) {
        const headers = [
            'id', 'type', 'question', 'category', 'difficulty', 'tags', 'explain', 
            'options', 'answer', 'correctAnswers', 'pairs', 'notebookId', 'notebookName', 
            'qNumber', 'createdAt'
        ];
        
        const csvRows = [headers.join(',')];
        
        pool.forEach(q => {
            const rowValues = headers.map(header => {
                let val = q[header];
                if (val === undefined || val === null) {
                    val = '';
                }
                
                if (header === 'options' || header === 'correctAnswers' || header === 'tags' || header === 'answer' || header === 'explain') {
                    val = Array.isArray(val) ? val.join('|') : String(val);
                } else if (header === 'pairs') {
                    val = Array.isArray(val) ? val.map(p => p && typeof p === 'object' ? `${p.left || ''}:${p.right || ''}` : String(p)).join('|') : String(val);
                } else if (header === 'notebookName') {
                    if (!val && q.notebookId) {
                        const nb = (globalThis.app?.state?.notebooks || []).find(n => String(n.id) === String(q.notebookId));
                        val = nb ? (nb.title || nb.name || '') : '';
                    }
                }
                
                return this.escapeCSV(val);
            });
            csvRows.push(rowValues.join(','));
        });
        
        const csvString = csvRows.join('\r\n');
        const blob = new Blob(['\uFEFF' + csvString], { type: 'text/csv;charset=utf-8;' });
        this.downloadFile(blob, `qbank_export_${Date.now()}.csv`);
    },

    parseCSV(text) {
        const lines = [];
        let row = [""];
        let inQuotes = false;
        
        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            const nextChar = text[i + 1];
            
            if (char === '"') {
                if (inQuotes && nextChar === '"') {
                    row[row.length - 1] += '"';
                    i++; 
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (char === ',' && !inQuotes) {
                row.push("");
            } else if ((char === '\r' || char === '\n') && !inQuotes) {
                if (char === '\r' && nextChar === '\n') {
                    i++; 
                }
                if (row.length > 1 || row[0] !== "") {
                    lines.push(row);
                }
                row = [""];
            } else {
                row[row.length - 1] += char;
            }
        }
        if (row.length > 1 || row[0] !== "") {
            lines.push(row);
        }
        
        if (lines.length < 2) return [];
        
        const headers = lines[0].map(h => h.trim().toLowerCase());
        const result = [];
        
        for (let i = 1; i < lines.length; i++) {
            const values = lines[i];
            if (values.length < headers.length) continue;
            
            const q = {};
            headers.forEach((header, index) => {
                let cellVal = values[index] || '';
                
                if (i === 1 && index === 0 && cellVal.startsWith('\uFEFF')) {
                    cellVal = cellVal.substring(1);
                }
                
                if (header === 'options' || header === 'correctanswers' || header === 'tags') {
                    const key = header === 'correctanswers' ? 'correctAnswers' : header;
                    if (cellVal.startsWith('[') && cellVal.endsWith(']')) {
                        try {
                            q[key] = JSON.parse(cellVal);
                        } catch {
                            q[key] = cellVal.split('|');
                        }
                    } else {
                        q[key] = cellVal ? cellVal.split('|') : [];
                    }
                } else if (header === 'pairs' || header === 'matchingpairs') {
                    const key = 'pairs';
                    let parsedPairs = [];
                    if (cellVal) {
                        try {
                            if (cellVal.startsWith('[') && cellVal.endsWith(']')) {
                                parsedPairs = JSON.parse(cellVal);
                            } else {
                                parsedPairs = cellVal.split('|').map(p => {
                                    const colIdx = p.indexOf(':');
                                    if (colIdx === -1) return { left: p, right: '' };
                                    return { left: p.substring(0, colIdx), right: p.substring(colIdx + 1) };
                                });
                            }
                        } catch (e) {
                            console.error("[CSV Import] Failed to parse pairs:", cellVal, e);
                        }
                    }
                    q[key] = parsedPairs;
                } else if (header === 'qnumber') {
                    q.qNumber = cellVal ? parseInt(cellVal) : null;
                } else if (header === 'createdat') {
                    q.createdAt = cellVal ? parseInt(cellVal) : null;
                } else if (header === 'answer') {
                    if (cellVal === 'true') {
                        q.answer = true;
                    } else if (cellVal === 'false') {
                        q.answer = false;
                    } else {
                        q.answer = cellVal;
                    }
                } else {
                    q[header] = cellVal;
                }
            });
            
            if (q.type === 'written') {
                q.answer = q.answer || q.correctanswer || q.correctanswers || '';
            }
            
            result.push(q);
        }
        
        return result;
    },

    parseIncomingString(rawText) {
        if (!rawText || typeof rawText !== 'string' || rawText.trim() === '') {
            throw new Error("محتوى الملف فارغ");
        }
        const trimmed = rawText.trim();
        
        if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
            try {
                const sanitizedJson = Helpers.sanitizeJsonString(trimmed);
                return JSON.parse(sanitizedJson);
            } catch (jsonErr) {
                console.warn("[Import Engine] Failed to parse as sanitized JSON. Attempting direct parse...", jsonErr);
                try {
                    return JSON.parse(trimmed);
                } catch (e2) {
                    throw new Error("فشل تحليل ملف JSON: " + jsonErr.message, { cause: e2 });
                }
            }
        }
        
        try {
            const parsedCsv = this.parseCSV(trimmed);
            if (!parsedCsv || parsedCsv.length === 0) {
                throw new Error("لا توجد بيانات صالحة في ملف CSV");
            }
            return parsedCsv;
        } catch (csvErr) {
            throw new Error("فشل تحليل ملف CSV: " + csvErr.message, { cause: csvErr });
        }
    },

    downloadFile(blob, filename) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    },

    validateImportPayload(jsonTextOrData) {
        let data;
        if (typeof jsonTextOrData === 'string') {
            try {
                data = this.parseIncomingString(jsonTextOrData);
            } catch (e) {
                Logger.error('ExportModule', 'Aborted: Incoming payload is malformed or corrupted', e);
                throw new Error(i18n.t('err_invalid_format') || "صيغة الملف غير صالحة", { cause: e });
            }
        } else {
            data = jsonTextOrData;
        }

        if (!Array.isArray(data) && !(data && data.notebooks && data.questions)) {
            throw new Error(i18n.t('err_invalid_format') || "صيغة الملف غير مدعومة");
        }

        const importNbEl = document.getElementById('import-notebook');
        const manualTargetNb = importNbEl ? importNbEl.value : null;
        
        const autoDistributeEl = document.getElementById('import-auto-distribute');
        const autoDistribute = autoDistributeEl ? autoDistributeEl.checked : true;

        if (!manualTargetNb && !autoDistribute) throw new Error(i18n.t('err_import_no_target'));

        return { data, manualTargetNb, autoDistribute };
    },

    async importData(jsonTextOrFile, syncCallback) {
        let importedCount = 0;
        try {
            let fileContent = jsonTextOrFile;
            if (jsonTextOrFile instanceof File || (jsonTextOrFile && typeof jsonTextOrFile === 'object' && jsonTextOrFile.name)) {
                const file = jsonTextOrFile;
                if (file.name.endsWith('.gz') || file.name.endsWith('.gzip')) {
                    if (typeof DecompressionStream !== 'undefined') {
                        const decompressionStream = new DecompressionStream('gzip');
                        const fileStream = typeof file.stream === 'function' ? file.stream() : new ReadableStream({
                            async start(controller) {
                                controller.enqueue(new Uint8Array(await file.arrayBuffer()));
                                controller.close();
                            }
                        });
                        const decompressedStream = fileStream.pipeThrough(decompressionStream);
                        fileContent = await new Response(decompressedStream).text();
                    } else if (typeof pako !== 'undefined') {
                        const arrayBuffer = await file.arrayBuffer();
                        const uint8Array = new Uint8Array(arrayBuffer);
                        fileContent = pako.ungzip(uint8Array, { to: 'string' });
                    } else {
                        throw new Error("GZIP decompression is not supported in this browser.");
                    }
                } else {
                    fileContent = await file.text();
                }
            }

            const { data: importedPayload, manualTargetNb, autoDistribute } = this.validateImportPayload(fileContent);
            const existingNotebooks = globalThis.app?.state?.notebooks || state.notebooks || [];
            
            const validationResult = await this.validateIncomingPayload(importedPayload, existingNotebooks, {
                autoDistribute,
                activeNotebookId: manualTargetNb
            });
            const questions = validationResult.questions;
            const floatingCount = validationResult.floatingCount || 0;

            const existingIds = new Set((globalThis.app?.state?.questions || state.questions || []).map(q => q.id));
            let promptAnswer = null;

            const questionsToSave = [];
            for (let i = 0; i < questions.length; i++) {
                const item = questions[i];
                const cleanItem = JSON.parse(JSON.stringify(item));
                if (!cleanItem.type || !['mcq', 'boolean', 'match', 'written'].includes(cleanItem.type)) continue;
                if (!cleanItem.question) continue;

                if (cleanItem.id && existingIds.has(cleanItem.id)) {
                    if (promptAnswer === null) {
                        if (typeof confirm !== 'undefined') {
                            const userChoice = confirm("تنبيه: بعض الأسئلة المستوردة تمتلك معرفات (IDs) موجودة بالفعل.\n\nاضغط 'موافق' لتوليد معرفات جديدة وتجنب التكرار.\nاضغط 'إلغاء' لتحديث واستبدال الأسئلة القديمة.");
                            promptAnswer = userChoice ? 'new' : 'keep';
                        } else {
                            promptAnswer = 'new';
                        }
                    }
                    if (promptAnswer === 'new') {
                        cleanItem.id = (typeof crypto !== 'undefined' && crypto.randomUUID)
                            ? crypto.randomUUID()
                            : `import_${Date.now()}_${Math.random().toString(36).substring(2, 10)}_${i}`;
                    }
                }

                if (typeof cleanItem.options === 'string') {
                    cleanItem.options = cleanItem.options ? cleanItem.options.split('|') : [];
                } else {
                    cleanItem.options = Array.isArray(cleanItem.options) ? [...cleanItem.options] : [];
                }

                if (typeof cleanItem.tags === 'string') {
                    cleanItem.tags = cleanItem.tags ? cleanItem.tags.split('|') : [];
                } else {
                    cleanItem.tags = Array.isArray(cleanItem.tags) ? [...cleanItem.tags] : [];
                }

                if (typeof cleanItem.pairs === 'string') {
                    cleanItem.pairs = cleanItem.pairs ? cleanItem.pairs.split('|').map(p => {
                        const colIdx = p.indexOf(':');
                        if (colIdx === -1) return { left: p, right: '' };
                        return { left: p.substring(0, colIdx), right: p.substring(colIdx + 1) };
                    }) : [];
                } else {
                    cleanItem.pairs = Array.isArray(cleanItem.pairs) ? [...cleanItem.pairs] : [];
                }

                cleanItem.explain = Array.isArray(cleanItem.explain) ? cleanItem.explain.join('|') : (cleanItem.explain || '');
                cleanItem.answer = Array.isArray(cleanItem.answer) ? cleanItem.answer.join('|') : (cleanItem.answer !== undefined ? cleanItem.answer : '');

                const newQ = {
                    id: cleanItem.id || Helpers.generateId(),
                    notebookId: cleanItem.notebookId,
                    type: cleanItem.type,
                    question: cleanItem.question,
                    category: cleanItem.category || i18n.t('general'),
                    difficulty: cleanItem.difficulty || 'medium',
                    options: cleanItem.options,
                    answer: cleanItem.answer,
                    keywords: cleanItem.keywords || [],
                    pairs: cleanItem.pairs,
                    explain: cleanItem.explain,
                    image: cleanItem.image || null,
                    tags: cleanItem.tags,
                    reference: {
                        book: cleanItem.reference?.book || '',
                        page: cleanItem.reference?.page || ''
                    },
                    qNumber: cleanItem.qNumber,
                    createdAt: cleanItem.createdAt || Date.now()
                };

                questionsToSave.push(newQ);
                importedCount++;
            }

            if (questionsToSave.length > 0) {
                if (db.instance) {
                    await new Promise((resolve, reject) => {
                        const tx = db.instance.transaction(['questions'], 'readwrite');
                        const qStore = tx.objectStore('questions');
                        questionsToSave.forEach(q => qStore.put(q));
                        tx.oncomplete = () => resolve(true);
                        tx.onerror = () => reject(tx.error);
                    });
                } else {
                    await db.bulkPut('questions', questionsToSave);
                }
            }

            if (!autoDistribute) {
                UIComponents.showToast(i18n.t('msg_import_success_forced'), 'success');
            } else if (floatingCount > 0) {
                UIComponents.showToast(i18n.t('msg_import_success_floating', { count: floatingCount }), 'success');
            } else {
                alert(i18n.t('msg_questions_found', { count: importedCount }));
            }
            if (syncCallback) await syncCallback();
        } catch (err) {
            alert(i18n.t('err_import_failed', { message: err.message }));
        }
    },

    /**
     * المعالجة الصارمة للاستيراد: تمنع تمرير المراجع (References) وتمنع تصادم الـ IDs
     */
    async processStrictImport(parsedData, successCallback) {
        let floatingCount;
        const autoDistribute = document.getElementById('import-auto-distribute') 
            ? document.getElementById('import-auto-distribute').checked 
            : true;
        const activeNotebookId = document.getElementById('import-notebook')
            ? document.getElementById('import-notebook').value
            : null;

        try {
            const existingNotebooks = globalThis.app?.state?.notebooks || state.notebooks || [];
            const validationResult = await this.validateIncomingPayload(parsedData, existingNotebooks, {
                autoDistribute,
                activeNotebookId
            });
            floatingCount = validationResult.floatingCount || 0;
            parsedData = validationResult.questions;
        } catch (validationError) {
            console.error("[Security Gate Abort]:", validationError.message);
            alert("❌ " + validationError.message);
            if (globalThis.app?.hideLoading) globalThis.app.hideLoading();
            return;
        }

        if (!parsedData || (Array.isArray(parsedData) && parsedData.length === 0)) {
            UIComponents.showToast(i18n.t('msg_no_data_found'), 'warning');
            return;
        }

        const questionCount = parsedData.length;

        const userConfirmed = confirm(i18n.t('msg_universal_import_confirm', { count: questionCount }));

        if (!userConfirmed) {
            UIComponents.showToast(i18n.t('msg_import_canceled'), 'info');
            return;
        }

        const existingIds = new Set((globalThis.app?.state?.questions || state.questions || []).map(q => q.id));
        let promptAnswer = null;

        const cleanQuestions = [];

        parsedData.forEach((item, index) => {
            const cleanItem = JSON.parse(JSON.stringify(item));

            if (cleanItem.id && existingIds.has(cleanItem.id)) {
                if (promptAnswer === null) {
                    if (typeof confirm !== 'undefined') {
                        const userChoice = confirm("تنبيه: بعض الأسئلة المستوردة تمتلك معرفات (IDs) موجودة بالفعل.\n\nاضغط 'موافق' لتوليد معرفات جديدة وتجنب التكرار.\nاضغط 'إلغاء' لتحديث واستبدال الأسئلة القديمة.");
                        promptAnswer = userChoice ? 'new' : 'keep';
                    } else {
                        promptAnswer = 'new';
                    }
                }
                if (promptAnswer === 'new') {
                    cleanItem.id = (typeof crypto !== 'undefined' && crypto.randomUUID)
                        ? crypto.randomUUID()
                        : `import_${Date.now()}_${Math.random().toString(36).substring(2, 10)}_${index}`;
                }
            }

            if (!cleanItem.id) {
                cleanItem.id = (typeof crypto !== 'undefined' && crypto.randomUUID) 
                    ? crypto.randomUUID() 
                    : `import_${Date.now()}_${Math.random().toString(36).substring(2, 10)}_${index}`;
            }

            if (typeof cleanItem.options === 'string') {
                cleanItem.options = cleanItem.options ? cleanItem.options.split('|') : [];
            } else {
                cleanItem.options = Array.isArray(cleanItem.options) ? [...cleanItem.options] : [];
            }

            if (typeof cleanItem.tags === 'string') {
                cleanItem.tags = cleanItem.tags ? cleanItem.tags.split('|') : [];
            } else {
                cleanItem.tags = Array.isArray(cleanItem.tags) ? [...cleanItem.tags] : [];
            }

            if (typeof cleanItem.pairs === 'string') {
                cleanItem.pairs = cleanItem.pairs ? cleanItem.pairs.split('|').map(p => {
                    const colIdx = p.indexOf(':');
                    if (colIdx === -1) return { left: p, right: '' };
                    return { left: p.substring(0, colIdx), right: p.substring(colIdx + 1) };
                }) : [];
            } else {
                cleanItem.pairs = Array.isArray(cleanItem.pairs) ? [...cleanItem.pairs] : [];
            }

            cleanItem.explain = Array.isArray(cleanItem.explain) ? cleanItem.explain.join('|') : (cleanItem.explain || '');
            cleanItem.answer = Array.isArray(cleanItem.answer) ? cleanItem.answer.join('|') : (cleanItem.answer !== undefined ? cleanItem.answer : '');

            cleanItem.createdAt = cleanItem.createdAt || (Date.now() + index);

            if (cleanItem.notebookId !== null && cleanItem.notebookId !== '') {
                cleanItem.notebookId = cleanItem.notebookId || 'orphaned';
            }
            cleanItem.type = cleanItem.type || 'mcq';

            cleanQuestions.push(cleanItem);
        });

        try {
            if (cleanQuestions.length > 0) {
                if (db.instance) {
                    await new Promise((resolve, reject) => {
                        const tx = db.instance.transaction(['questions'], 'readwrite');
                        const qStore = tx.objectStore('questions');
                        cleanQuestions.forEach(q => qStore.put(q));
                        tx.oncomplete = () => resolve(true);
                        tx.onerror = () => reject(tx.error);
                    });
                } else {
                    await db.bulkPut('questions', cleanQuestions);
                }
            }
            console.log(`[Import Engine] Successfully injected ${cleanQuestions.length} unique items.`);
            if (successCallback) successCallback(floatingCount, autoDistribute);
        } catch (dbError) {
            console.error("[Import Engine] DB Write Failure:", dbError);
            throw dbError;
        }
    },

    exportToWord: async function(pool, showToastCallback) {
        if (typeof docx === 'undefined') {
            return alert(i18n.t('export_err_word_lib'));
        }

        const { Document, Packer, Paragraph, TextRun, AlignmentType, HeadingLevel, Table, TableRow, TableCell, WidthType } = globalThis.docx;

        const layout = document.getElementById('word-layout')?.value || 'questions-only';
        const customHeader = document.getElementById('word-custom-header')?.value || i18n.t('default_word_header');
        const direction = document.getElementById('word-direction')?.value || 'rtl';
        const includeExplain = document.getElementById('word-include-explain')?.checked;
        const boldQuestion = document.getElementById('word-bold-question')?.checked;
        
        const showAnsInline = layout === 'with-answers';
        const isAnnex = layout === 'exam-annex';
        const isRtl = direction === 'rtl';

        const children = [
            new Paragraph({
                text: customHeader,
                heading: HeadingLevel.HEADING_1,
                alignment: AlignmentType.CENTER,
                spacing: { after: 200 }
            }),
            new Paragraph({
                children: [
                    new TextRun({ text: i18n.t('export_total_qs', { count: pool.length }), bold: true }),
                    new TextRun({ text: " | " }),
                    new TextRun({ text: i18n.t('export_date', { date: new Date().toLocaleDateString(state.language === 'ar' ? 'ar-EG' : 'en-US') }), bold: true }),
                ],
                alignment: AlignmentType.CENTER,
                spacing: { after: 400 },
            })
        ];

        let answersAnnex = [];

        pool.forEach((q, i) => {
            const qNum = i + 1;
            children.push(new Paragraph({
                spacing: { before: 400 },
                children: [
                    new TextRun({ text: `${i18n.t('nav_questions')} ${qNum} (${this.getQuestionTypeLabel(q.type)})`, bold: true, size: 24, color: "4361ee" }),
                ],
                alignment: isRtl ? AlignmentType.RIGHT : AlignmentType.LEFT
            }));

            children.push(new Paragraph({
                spacing: { after: 200 },
                children: [
                    new TextRun({ text: q.question, bold: boldQuestion, size: 28 }),
                ],
                alignment: isRtl ? AlignmentType.RIGHT : AlignmentType.LEFT,
                bidirectional: isRtl
            }));

            if (q.type === 'mcq') {
                (q.options || []).forEach((opt, idx) => {
                    const labels = isRtl ? ['أ', 'ب', 'ج', 'د'] : ['A', 'B', 'C', 'D'];
                    const label = labels[idx];
                    const isCorrect = opt === q.answer;
                    
                    let runOptions = { text: `${label}) ${opt}` };
                    if (showAnsInline && isCorrect) {
                        runOptions.bold = true;
                        runOptions.color = "2e7d32";
                    }
                    const run = new TextRun(runOptions);

                    children.push(new Paragraph({
                        children: [run],
                        indent: isRtl ? { right: 720 } : { left: 720 },
                        spacing: { after: 120 },
                        alignment: isRtl ? AlignmentType.RIGHT : AlignmentType.LEFT,
                        bidirectional: isRtl
                    }));
                });
                if (isAnnex) answersAnnex.push(`${qNum}. ${q.answer}`);

            } else if (q.type === 'boolean') {
                const ansText = q.answer ? i18n.t('quiz_true') : i18n.t('quiz_false');
                const childrenArray = [ new TextRun({ text: `${i18n.t('export_answer')}: (${i18n.t('quiz_true')} / ${i18n.t('quiz_false')})` }) ];
                if (showAnsInline) childrenArray.push(new TextRun({ text: ` [ ${ansText} ]`, bold: true, color: "2e7d32" }));

                children.push(new Paragraph({
                    children: childrenArray,
                    indent: isRtl ? { right: 720 } : { left: 720 },
                    alignment: isRtl ? AlignmentType.RIGHT : AlignmentType.LEFT
                }));
                if (isAnnex) answersAnnex.push(`${qNum}. ${ansText}`);

            } else if (q.type === 'match') {
                const rows = [
                    new TableRow({
                        children: [
                            new TableCell({ children: [new Paragraph({ text: i18n.t('q_pair_right'), bold: true, alignment: AlignmentType.CENTER })], shading: { fill: "f1f3f5" } }),
                            new TableCell({ children: [new Paragraph({ text: i18n.t('q_pair_left'), bold: true, alignment: AlignmentType.CENTER })], shading: { fill: "f1f3f5" } }),
                        ]
                    })
                ];
                (q.pairs || []).forEach(p => {
                    rows.push(new TableRow({
                        children: [
                            new TableCell({ children: [new Paragraph({ text: p.right, alignment: AlignmentType.CENTER })] }),
                            new TableCell({ children: [new Paragraph({ text: p.left, alignment: AlignmentType.CENTER })] }),
                        ]
                    }));
                });
                children.push(new Table({
                    width: { size: 100, type: WidthType.PERCENTAGE },
                    rows: rows
                }));
                if (isAnnex) {
                    const matchAns = (q.pairs || []).map(p => `${p.right} → ${p.left}`).join(', ');
                    answersAnnex.push(`${qNum}. ${matchAns}`);
                }

            } else if (q.type === 'written') {
                children.push(new Paragraph({
                    children: [new TextRun({ text: "................................................................................" })],
                    indent: isRtl ? { right: 720 } : { left: 720 },
                    alignment: isRtl ? AlignmentType.RIGHT : AlignmentType.LEFT
                }));
                if (isAnnex) {
                    const ansText = q.answer || (q.keywords || []).join(', ');
                    answersAnnex.push(`${qNum}. ${ansText}`);
                }
            }

            if (includeExplain && q.explain) {
                children.push(new Paragraph({
                    spacing: { before: 200 },
                    children: [
                        new TextRun({ text: `💡 ${i18n.t('export_explain')}: `, bold: true, color: "666666" }),
                        new TextRun({ text: q.explain, color: "666666", italic: true }),
                    ],
                    alignment: isRtl ? AlignmentType.RIGHT : AlignmentType.LEFT
                }));
            }

            children.push(new Paragraph({
                text: "________________________________________________________________________________",
                alignment: AlignmentType.CENTER,
                spacing: { before: 200, after: 200 },
                children: [ new TextRun({ text: "", size: 4 }) ]
            }));
        });

        if (isAnnex && answersAnnex.length > 0) {
            children.push(new Paragraph({
                text: i18n.t('export_annex_title'),
                heading: HeadingLevel.HEADING_2,
                alignment: AlignmentType.CENTER,
                spacing: { before: 800, after: 400 },
                pageBreakBefore: true
            }));

            answersAnnex.forEach(ans => {
                children.push(new Paragraph({
                    text: ans,
                    alignment: isRtl ? AlignmentType.RIGHT : AlignmentType.LEFT,
                    spacing: { after: 100 }
                }));
            });
        }

        const doc = new Document({
            sections: [{
                properties: { 
                    // Note: docx v7 uses bidirectional:true in paragraph/table settings for RTL
                    // Global section direction is often better handled per-paragraph
                },
                children: children
            }]
        });

        const blob = await Packer.toBlob(doc);
        globalThis.saveAs(blob, `qbank_export_${Date.now()}.docx`);
        if (showToastCallback) showToastCallback(i18n.t('export_word_success'));
    },

    exportToPdf(pool) {
        try {
            const layout = document.getElementById('pdf-layout')?.value || 'questions-only';
            const customHeader = document.getElementById('pdf-custom-header')?.value;
            const showImages = document.getElementById('pdf-show-images')?.checked;
            const direction = document.getElementById('pdf-direction')?.value || 'rtl';
            const twoColumns = document.getElementById('pdf-two-columns')?.checked;
            const selectedThemeName = document.getElementById('pdf-theme-selector')?.value || 'طابع تقني';

            const showAns = layout === 'with-answers';
            const isAnnex = layout === 'exam-annex';

            // Inject the selected theme CSS dynamically
            const themeCss = pdfThemes[selectedThemeName] || pdfThemes['طابع تقني'] || '';
            const styleEl = document.createElement('style');
            styleEl.id = 'dynamic-print-theme-styles';
            styleEl.innerHTML = themeCss + `
                @media print {
                    .pdf-question-block, .question-card, .question-item, .explanation-box, .print-question, .answer-box {
                        page-break-inside: avoid !important;
                        break-inside: avoid !important;
                        position: relative;
                    }
                }
            `;
            document.head.appendChild(styleEl);

            // Clean up the style block once printing is closed
            window.addEventListener('afterprint', () => {
                const el = document.getElementById('dynamic-print-theme-styles');
                if (el) el.remove();
            }, { once: true });

            let answersAnnex = '';
            // Load institution identity for PDF header branding
            const institution = (() => {
                try { return JSON.parse(localStorage.getItem('qbank_institution') || '{}'); } catch { return {}; }
            })();

            const logoHtml = institution.logo
                ? `<img src="${institution.logo}" style="height:60px; max-width:160px; object-fit:contain; margin-bottom:6px;">`
                : '';
            const institutionHtml = institution.name
                ? `<div style="font-size:1rem; font-weight:700; color:#555; margin-bottom:4px;">${Helpers.sanitize(institution.name)}</div>`
                : '';

            let bodyHtml = `<div class="print-header">
                ${logoHtml}
                ${institutionHtml}
                <h2 style="font-size:1.8rem;">${customHeader || i18n.t('export_title_default')}</h2>
                <p>${i18n.t('export_total_qs', { count: pool.length })} | ${i18n.t('export_date', { date: new Date().toLocaleDateString(state.language === 'ar' ? 'ar-EG' : 'en-US') })}</p>
            </div>`;

            if (twoColumns) bodyHtml += `<div style="column-count: 2; column-gap: 30px; column-rule: 1px solid #eee;">`;

            const getQuestionDuration = (q) => {
                if (q.type === 'mcq') return 1.5;
                if (q.type === 'boolean') return 1.0;
                if (q.type === 'match') return 2.5;
                if (q.type === 'written') return 4.0;
                return 2.0;
            };

            const renderSingleQuestionHtml = (q, idx) => {
                let html = '';
                const sQuestion = Helpers.sanitize(q.question);
                const sExplain = Helpers.sanitize(q.explain || '');
                html += `<div class="print-question" style="page-break-inside: avoid; border: 1px solid #eee; padding: 15px; margin-bottom: 20px; border-radius: 8px;">`;
                html += `<h3 style="margin: 0 0 10px 0; font-size: 1.1rem; font-weight: 700;"><span class="accent-badge" style="margin-inline-end: 8px;">${i18n.t('nav_questions')} ${idx + 1}</span>${sQuestion}</h3>`;
                
                if (showImages && q.image) {
                    html += `<div style="text-align: center; margin: 15px 0;"><img src="${q.image}" style="max-width: 100%; max-height: 250px; border-radius: 4px; border: 1px solid #ccc;"></div>`;
                }

                const labels = direction === 'rtl' ? ['أ', 'ب', 'ج', 'د'] : ['A', 'B', 'C', 'D'];

                if (q.type === 'mcq') {
                    html += `<ul style="list-style:none; padding-${direction === 'rtl' ? 'right' : 'left'}:20px; line-height:1.8; margin: 10px 0;">`;
                    (q.options || []).forEach((o, oIdx) => {
                        const sOpt = Helpers.sanitize(o);
                        const isCorrect = showAns && o === q.answer;
                        html += `<li style="margin-bottom: 5px; ${isCorrect ? 'font-weight:bold; color:#2a9d8f; background: rgba(42, 157, 143, 0.05); padding: 2px 8px; border-radius: 4px;' : ''}">${labels[oIdx] || oIdx + 1}) ${sOpt}</li>`;
                    });
                    html += `</ul>`;
                    if (isAnnex || showAns) {
                        const correctLabel = labels[q.options?.indexOf(q.answer)] || Helpers.sanitize(q.answer);
                        answersAnnex += `<div style="margin-bottom: 4px;"><strong>${idx + 1}.</strong> ${correctLabel}</div>`;
                    }
                } else if (q.type === 'boolean') {
                    html += `<p style="margin: 10px 0;">( ${i18n.t('quiz_true')} / ${i18n.t('quiz_false')} )</p>`;
                    const ansText = q.answer ? i18n.t('quiz_true') : i18n.t('quiz_false');
                    if (showAns) html += `<div class="answer-box" style="color:#2a9d8f; font-weight:bold; padding: 10px; margin-top: 10px;">${i18n.t('export_answer')}: ${ansText}</div>`;
                    if (isAnnex || showAns) answersAnnex += `<div style="margin-bottom: 4px;"><strong>${idx + 1}.</strong> ${ansText}</div>`;
                } else if (q.type === 'written') {
                    const ansText = Helpers.sanitize(q.answer || (q.keywords || []).join(' - '));
                    if (showAns) html += `<div class="answer-box" style="color:#2a9d8f; margin: 10px 0; padding: 10px;"><strong>${i18n.t('export_answer')}:</strong> ${ansText}</div>`;
                    else html += `<div style="height:100px; border-bottom:1px dashed #999; margin:15px 0;"></div>`;
                    if (isAnnex || showAns) answersAnnex += `<div style="margin-bottom: 4px;"><strong>${idx + 1}.</strong> ${ansText}</div>`;
                } else if (q.type === 'match') {
                    const pairs = q.pairs || [];
                    let rights = pairs.map(p => p.right);
                    if (!showAns) rights = [...rights].sort(() => Math.random() - 0.5);
                    const tableLabels = [i18n.t('q_pair_left'), i18n.t('export_answer'), i18n.t('q_pair_right')];
                    html += `
                        <table style="width:100%; border-collapse: collapse; margin: 15px 0; border: 1.5px solid #000; table-layout: fixed;">
                            <thead><tr style="background: #f2f2f2;"><th style="border:1px solid #000;padding:8px;text-align:center;width:40%;font-weight:bold;">${tableLabels[0]}</th><th style="border:1px solid #000;padding:8px;text-align:center;width:20%;font-weight:bold;">${tableLabels[1]}</th><th style="border:1px solid #000;padding:8px;text-align:center;width:40%;font-weight:bold;">${tableLabels[2]}</th></tr></thead>
                            <tbody>
                                ${pairs.map((p, pIdx) => {
                                    const sLeft = Helpers.sanitize(p.left);
                                    const rightLabel = String.fromCharCode(65 + pIdx); 
                                    let solution = '';
                                    if (showAns) solution = String.fromCharCode(65 + rights.indexOf(p.right));
                                    return `<tr><td style="border:1px solid #000;padding:10px;text-align:${direction==='rtl'?'right':'left'};">${pIdx+1}. ${sLeft}</td><td style="border:1px solid #000;padding:10px;text-align:center;font-weight:bold;color:${showAns?'#2a9d8f':'#000'};">${showAns?solution:'(........)'}</td><td style="border:1px solid #000;padding:10px;text-align:${direction==='rtl'?'right':'left'};">${rightLabel}. ${Helpers.sanitize(rights[pIdx])}</td></tr>`;
                                }).join('')}
                            </tbody>
                        </table>
                    `;
                    if (isAnnex || showAns) {
                        const solTable = `<table style="border-collapse:collapse;margin-top:5px;font-size:0.85rem;width:100%;max-width:150px;border:1px solid #ddd;"><tr style="background:#f9f9f9;">${pairs.map((_,pi)=>`<td style="border:1px solid #ddd;padding:2px;text-align:center;font-weight:bold;width:25%;">${pi+1}</td>`).join('')}</tr><tr>${pairs.map((p)=>`<td style="border:1px solid #ddd;padding:2px;text-align:center;color:#2a9d8f;font-weight:bold;">${String.fromCharCode(65+rights.indexOf(p.right))}</td>`).join('')}</tr></table>`;
                        answersAnnex += `<div style="margin-bottom:12px;break-inside:avoid;"><strong>${idx+1}.</strong> ${solTable}</div>`;
                    }
                }
                if (showAns && q.explain) html += `<div class="answer-box" style="margin-top:10px;border-${direction==='rtl'?'right':'left'}:4px solid #4361ee;padding-${direction==='rtl'?'right':'left'}:10px;color:#555;background:rgba(67, 97, 238, 0.05);"><strong>💡 ${i18n.t('export_explain')}:</strong> ${sExplain}</div>`;
                html += `</div>`;
                return html;
            };

            const splitSessions = document.getElementById('pdf-split-sessions')?.checked;
            const sessionDurationLimit = parseFloat(document.getElementById('pdf-session-duration')?.value) || 45;

            if (splitSessions) {
                // Group pool into sessions
                const sessions = [];
                let currentSession = [];
                let currentDur = 0;
                
                pool.forEach((q, idx) => {
                    const qDur = getQuestionDuration(q);
                    if (currentDur + qDur > sessionDurationLimit && currentSession.length > 0) {
                        sessions.push(currentSession);
                        currentSession = [ { q, idx } ];
                        currentDur = qDur;
                    } else {
                        currentSession.push( { q, idx } );
                        currentDur += qDur;
                    }
                });
                if (currentSession.length > 0) {
                    sessions.push(currentSession);
                }

                sessions.forEach((sQs, sIdx) => {
                    const startNum = sQs[0].idx + 1;
                    const endNum = sQs[sQs.length - 1].idx + 1;
                    const estMin = Math.round(sQs.reduce((acc, item) => acc + getQuestionDuration(item.q), 0));
                    
                    bodyHtml += `
                    <div class="session-cover-page" style="page-break-before: always; page-break-after: always; min-height: 80vh; display: flex; flex-direction: column; justify-content: center; align-items: center; border: 4px double #4361ee; padding: 40px; box-sizing: border-box; text-align: center; margin-top: 20px; margin-bottom: 40px;">
                        <h1 style="font-size: 2.5rem; color: #4361ee; margin-bottom: 20px; font-weight: 800;">جلسة مذاكرة ذكية</h1>
                        <h2 style="font-size: 1.8rem; color: var(--text-main); margin-bottom: 15px; font-weight: 700;">الجلسة رقم ${sIdx + 1}</h2>
                        <p style="font-size: 1.2rem; color: #666; margin-bottom: 30px;">الوقت المقدر لهذه الجلسة: ${estMin} دقيقة</p>
                        <div style="font-size: 1.1rem; color: #444; border-top: 1px solid #ddd; padding-top: 20px;">
                            تبدأ هذه الجلسة من السؤال رقم ${startNum} إلى السؤال رقم ${endNum}
                        </div>
                    </div>
                    `;

                    sQs.forEach(({ q, idx }, sIdxLocal) => {
                        bodyHtml += renderSingleQuestionHtml(q, idx);
                        // Put exactly 2 questions per page inside the generated PDF session
                        if (!twoColumns && (sIdxLocal + 1) % 2 === 0 && (sIdxLocal + 1) < sQs.length) {
                            bodyHtml += `<div class="page-break" style="page-break-after: always; break-after: page;"></div>`;
                        }
                    });
                });
            } else {
                pool.forEach((q, idx) => {
                    bodyHtml += renderSingleQuestionHtml(q, idx);
                    // Put exactly 2 questions per page inside the generated PDF
                    if (!twoColumns && (idx + 1) % 2 === 0 && (idx + 1) < pool.length) {
                        bodyHtml += `<div class="page-break" style="page-break-after: always; break-after: page;"></div>`;
                    }
                });
            }

            if (twoColumns) bodyHtml += `</div>`;
            if (isAnnex && answersAnnex) {
                bodyHtml += `<div style="page-break-before:always; margin-top:40px;"><h2 style="text-align:center; margin-bottom:20px; border-bottom: 2px solid #000; padding-bottom: 10px;">${i18n.t('export_annex_title')}</h2><div style="column-count: 3; column-gap: 40px; font-size: 0.95rem; line-height: 1.6;">${answersAnnex}</div></div>`;
            }

            const container = document.getElementById('print-container');
            if (container) {
                // Yield to the browser to allow UI updates (like the loading spinner)
                requestAnimationFrame(() => {
                    container.innerHTML = bodyHtml;
                    container.dir = direction;
                    
                    // Final yield before print to ensure layout is ready
                    setTimeout(() => {
                        globalThis.print();
                    }, 300);
                });
            }
        } catch (err) {
            alert(i18n.t('err_export_failed', { message: err.message }));
        }
    },

    getQuestionTypeLabel(type) {
        const key = `type_${type}`;
        const label = i18n.t(key);
        const selfHealed = String(key).split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join('');
        if (label === selfHealed) return type;
        return label;
    },

    /**
     * Normalizes text for the bridge to ensure consistent comparison in the target platform.
     * Removes extra spaces and punctuation.
     * @param {string} text 
     * @returns {string}
     */
    normalizeForBridge(text) {
        if (!text) return '';
        return text.trim()
            .replace(/\s+/g, ' ')
            .replace(/[.,!?;:]/g, '');
    },

    /**
     * Transmits selected questions to the external exam site (bridge).
     * @param {Array} pool - The questions to transmit.
     * @param {Function} handleErrorCallback - Callback for errors.
     * @param {Function} showToastCallback - Callback for success messages.
     */
    bridgeToExam(pool, handleErrorCallback, showToastCallback) {
        if (!pool || pool.length === 0) return;

        const sessionId = Helpers.generateId();
        const storageKey = `exam_session_${sessionId}`;
        
        // Prepare data in the format expected by the exam site (examwebsite)
        const bridgeData = pool.map(q => {
            let options = q.options || [];
            let ans = q.answer;

            // Transform Written/Essay to Full Sentence with normalization
            if (q.type === 'written') {
                // Prioritize q.answer (new full sentence field), fallback to keywords joined
                const rawAns = q.answer || (Array.isArray(q.keywords) ? q.keywords.join(' ') : '');
                ans = this.normalizeForBridge(rawAns);
            } 
            // Transform Boolean to MCQ for legacy/bridge support
            else if (q.type === 'boolean') {
                options = [i18n.t('quiz_true'), i18n.t('quiz_false')];
                ans = q.answer ? i18n.t('quiz_true') : i18n.t('quiz_false');
            }

            return {
                id: q.id,
                type: q.type,
                question: q.question, 
                answer: ans,          
                options: options,
                image: q.image || '',
                explain: q.explain || '',
                category: q.category || 'General',
                points: q.points || 1,
                pairs: q.pairs || [],
                keywords: q.keywords || []
            };
        });
        
        try {
            console.log(`🚀 Export Bridge: Sending ${bridgeData.length} items to simulation.`);
            localStorage.setItem(storageKey, JSON.stringify(bridgeData));
            const url = `examwebsite/index.html?session_id=${sessionId}`;
            globalThis.open(url, '_blank');
            if (showToastCallback) showToastCallback(bridgeData.length);
        } catch (e) {
            if (handleErrorCallback) handleErrorCallback(e, "Export Bridge Failed");
        }
    },

    referencesList: [],
    loadedReferenceData: null,

    initReferenceHub() {
        // Inject missing localization keys dynamically to keep surgical modifications localized to src/modules/export.js
        if (typeof i18n !== 'undefined' && i18n.locales) {
            if (i18n.locales.ar && !i18n.locales.ar['import_ref_title']) {
                i18n.locales.ar['import_ref_title'] = 'استيراد المراجع الطبية المعتمدة';
                i18n.locales.ar['select_ref_placeholder'] = '--- اختر المرجع الطبي المطلوب ---';
                i18n.locales.ar['btn_preview_ref'] = 'فحص ومعاينة المرجع 📡';
                i18n.locales.ar['ref_preview_title'] = '🔍 معاينة أول 3 أسئلة:';
                i18n.locales.ar['btn_confirm_ref_import'] = 'تأكيد الاستيراد الآمن 🚀';
                i18n.locales.ar['select_ref_first'] = 'يرجى اختيار مرجع أولاً.';
                i18n.locales.ar['err_fetch_manifest_failed'] = 'فشل جلب ملف المراجع المعتمدة.';
                i18n.locales.ar['err_fetch_ref_failed'] = 'فشل جلب ملف المرجع المختار.';
                i18n.locales.ar['msg_import_success'] = 'تم الاستيراد بنجاح وبدون أي تكرار!';
            }
            if (i18n.locales.en && !i18n.locales.en['import_ref_title']) {
                i18n.locales.en['import_ref_title'] = 'Import Approved Medical References';
                i18n.locales.en['select_ref_placeholder'] = '--- Select Medical Reference ---';
                i18n.locales.en['btn_preview_ref'] = 'Inspect & Preview Reference 📡';
                i18n.locales.en['ref_preview_title'] = '🔍 Previewing first 3 questions:';
                i18n.locales.en['btn_confirm_ref_import'] = 'Confirm Safe Import 🚀';
                i18n.locales.en['select_ref_first'] = 'Please select a reference first.';
                i18n.locales.en['err_fetch_manifest_failed'] = 'Failed to load references manifest.';
                i18n.locales.en['err_fetch_ref_failed'] = 'Failed to load selected reference.';
                i18n.locales.en['msg_import_success'] = 'Successfully imported without duplicates!';
            }
        }

        // Fetch references manifest
        fetch('docs/dev-notes/refrence/references-manifest.json')
            .then(res => {
                if (!res.ok) throw new Error('HTTP ' + res.status);
                return res.json();
            })
            .then(data => {
                ExportModule.referencesList = data;
                ExportModule.populateReferencesSelector();
            })
            .catch(err => {
                console.error('[Reference Hub] Failed to fetch manifest:', err);
                // Fallback to local hardcoded manifest if file fetch fails
                ExportModule.referencesList = [
                    {
                        "id": "ref-v0",
                        "name": "بنك الأسئلة الطبي - الإصدار v0",
                        "path": "docs/dev-notes/refrence/v0.json",
                        "version": "1.0.0",
                        "description": "مرجع شامل لأسئلة طب العيون والجراحة العامة والباطنة."
                    },
                    {
                        "id": "ref-v1",
                        "name": "بنك أسئلة الأنف والأذن والحنجرة - الإصدار v1",
                        "path": "docs/dev-notes/refrence/v1.json",
                        "version": "1.1.0",
                        "description": "أسئلة مخصصة لمادة الأنف والأذن والحنجرة لطلاب مرحلة البكالوريوس."
                    },
                    {
                        "id": "ref-v2",
                        "name": "بنك الأسئلة المطور - الإصدار v2",
                        "path": "docs/dev-notes/refrence/v2.json",
                        "version": "1.2.0",
                        "description": "تحديثات أسئلة التخصصات الطبية الإضافية والامتحانات الإكلينيكية الحالية."
                    }
                ];
                ExportModule.populateReferencesSelector();
            });

        // Bind events
        const previewBtn = document.getElementById('btn-preview-ref');
        const confirmBtn = document.getElementById('btn-confirm-ref-import');
        
        if (previewBtn) {
            previewBtn.onclick = (e) => {
                e.preventDefault();
                const selector = document.getElementById('reference-selector');
                const selectedId = selector ? selector.value : '';
                if (!selectedId) {
                    alert(i18n.t('select_ref_first'));
                    return;
                }
                const ref = ExportModule.referencesList.find(r => r.id === selectedId);
                if (ref) {
                    ExportModule.loadAndPreviewReference(ref.path);
                }
            };
        }

        if (confirmBtn) {
            confirmBtn.onclick = (e) => {
                e.preventDefault();
                ExportModule.executeReferenceImport();
            };
        }

        // Bind share link button
        const shareBtn = document.getElementById('btn-copy-ref-link');
        if (shareBtn) {
            shareBtn.onclick = (e) => {
                e.preventDefault();
                ExportModule.copyReferenceShareLink();
            };
        }

        // Bind direct link share button
        const copyDirectBtn = document.getElementById('btn-copy-direct-link');
        if (copyDirectBtn) {
            copyDirectBtn.onclick = (e) => {
                e.preventDefault();
                const inputField = document.getElementById('import-url');
                const inputUrl = inputField ? inputField.value.trim() : "";
                if (!inputUrl) {
                    UIComponents.showToast(i18n.t('msg_enter_url_first'), 'warning');
                    return;
                }
                const baseUrl = globalThis.location.origin + globalThis.location.pathname;
                const fullDirectUrl = `${baseUrl}?direct_url=${encodeURIComponent(inputUrl)}`;
                ExportModule.copyTextToClipboard(fullDirectUrl, 'msg_direct_share_copied');
            };
        }




    },

    populateReferencesSelector() {
        const selector = document.getElementById('reference-selector');
        if (selector) {
            selector.innerHTML = `<option value="">--- ${i18n.t('select_ref_placeholder')} ---</option>`;
            ExportModule.referencesList.forEach(ref => {
                const opt = document.createElement('option');
                opt.value = ref.id;
                opt.textContent = `${ref.name} (v${ref.version})`;
                selector.appendChild(opt);
            });

            // Bind change listener
            selector.onchange = (e) => {
                const selectedId = e.target.value;
                const panel = document.getElementById('reference-details-panel');
                const previewArea = document.getElementById('ref-preview-area');
                const confirmBtn = document.getElementById('btn-confirm-ref-import');
                
                if (!selectedId) {
                    if (panel) panel.style.display = 'none';
                    if (confirmBtn) {
                        confirmBtn.disabled = true;
                        confirmBtn.style.opacity = '0.5';
                        confirmBtn.style.cursor = 'not-allowed';
                    }
                    ExportModule.loadedReferenceData = null;
                    return;
                }
                
                const ref = ExportModule.referencesList.find(r => r.id === selectedId);
                if (ref && panel) {
                    document.getElementById('ref-detail-name').textContent = ref.name;
                    document.getElementById('ref-detail-desc').textContent = ref.description;
                    document.getElementById('ref-detail-version').textContent = `v${ref.version}`;
                    panel.style.display = 'block';
                    
                    if (previewArea) previewArea.style.display = 'none';
                    if (confirmBtn) {
                        confirmBtn.disabled = true;
                        confirmBtn.style.opacity = '0.5';
                        confirmBtn.style.cursor = 'not-allowed';
                    }
                    ExportModule.loadedReferenceData = null;
                }
            };
        }
    },

    loadAndPreviewReference: async function(path) {
        const previewBtn = document.getElementById('btn-preview-ref');
        const originalText = previewBtn ? previewBtn.textContent : '';
        if (previewBtn) {
            previewBtn.disabled = true;
            previewBtn.textContent = '...📡...';
        }

        try {
            const res = await fetch(path);
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const data = await res.json();
            
            const questions = Array.isArray(data) ? data : [data];
            ExportModule.loadedReferenceData = questions;
            
            const previewArea = document.getElementById('ref-preview-area');
            const questionsList = document.getElementById('ref-preview-questions-list');
            const confirmBtn = document.getElementById('btn-confirm-ref-import');
            
            if (questionsList) {
                questionsList.innerHTML = '';
                const previewItems = questions.slice(0, 3);
                
                previewItems.forEach((q, idx) => {
                    const itemDiv = document.createElement('div');
                    itemDiv.style.borderBottom = idx < previewItems.length - 1 ? '1px solid var(--border)' : 'none';
                    itemDiv.style.paddingBottom = '5px';
                    itemDiv.style.marginBottom = '5px';
                    
                    const qType = q.type ? q.type.toUpperCase() : 'MCQ';
                    itemDiv.innerHTML = `
                        <div style="font-weight: bold; color: var(--primary);">${idx + 1}. [${qType}] ${Helpers.sanitize(q.question || '')}</div>
                        <div style="color: var(--text-secondary); margin-top: 2px;">${i18n.t('answer_label') || 'الإجابة'}: ${Helpers.sanitize(String(q.answer || ''))}</div>
                    `;
                    questionsList.appendChild(itemDiv);
                });
                
                if (previewArea) previewArea.style.display = 'block';
            }
            
            if (confirmBtn) {
                confirmBtn.disabled = false;
                confirmBtn.style.opacity = '1';
                confirmBtn.style.cursor = 'pointer';
            }
            
        } catch (error) {
            console.error('[Reference Hub] Error loading reference file:', error);
            alert(i18n.t('err_fetch_ref_failed'));
            
            const confirmBtn = document.getElementById('btn-confirm-ref-import');
            if (confirmBtn) {
                confirmBtn.disabled = true;
                confirmBtn.style.opacity = '0.5';
                confirmBtn.style.cursor = 'not-allowed';
            }
            ExportModule.loadedReferenceData = null;
        } finally {
            if (previewBtn) {
                previewBtn.disabled = false;
                previewBtn.textContent = originalText;
            }
        }
    },

    executeReferenceImport: async function() {
        if (!ExportModule.loadedReferenceData) {
            alert(i18n.t('select_ref_first'));
            return;
        }

        const confirmBtn = document.getElementById('btn-confirm-ref-import');
        if (confirmBtn) confirmBtn.disabled = true;

        try {
            await ExportModule.processStrictImport(ExportModule.loadedReferenceData, (floatingCount, autoDistribute) => {
                ExportModule.loadedReferenceData = null;
                const selector = document.getElementById('reference-selector');
                if (selector) selector.value = '';
                
                const panel = document.getElementById('reference-details-panel');
                if (panel) panel.style.display = 'none';
                
                if (confirmBtn) {
                    confirmBtn.disabled = true;
                    confirmBtn.style.opacity = '0.5';
                    confirmBtn.style.cursor = 'not-allowed';
                }
                
                globalThis.app?.syncData?.();
                
                if (!autoDistribute) {
                    UIComponents.showToast(i18n.t('msg_import_success_forced'), 'success');
                } else if (floatingCount > 0) {
                    UIComponents.showToast(i18n.t('msg_import_success_floating', { count: floatingCount }), 'success');
                } else {
                    alert(i18n.t('msg_import_success'));
                }
            });
        } catch (err) {
            console.error('[Reference Hub] Import failed:', err);
            alert(i18n.t('err_import_failed', { message: err.message }));
            if (confirmBtn) confirmBtn.disabled = false;
        }
    },

    copyReferenceShareLink() {
        const selector = document.getElementById('reference-selector');
        if (!selector || !selector.value) {
            alert(i18n.t('select_ref_first'));
            return;
        }
        const baseUrl = globalThis.location.origin + globalThis.location.pathname;
        const fullUrl = `${baseUrl}?import_ref=${selector.value}`;
        this.copyTextToClipboard(fullUrl, 'msg_share_link_copied');
    },

    copyTextToClipboard(text, successMessageKey) {
        const showSuccess = () => {
            if (typeof UIComponents !== 'undefined') {
                UIComponents.showToast(i18n.t(successMessageKey), 'success');
            } else if (typeof app !== 'undefined') {
                app?.showToast?.(i18n.t(successMessageKey), 'success');
            } else {
                console.log(i18n.t(successMessageKey));
            }
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text)
                .then(() => showSuccess())
                .catch(() => this.fallbackCopyEngine(text, successMessageKey));
        } else {
            this.fallbackCopyEngine(text, successMessageKey);
        }
    },

    fallbackCopyEngine(text, successMessageKey) {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.opacity = "0";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
            if (document.execCommand('copy')) {
                const showSuccess = () => {
                    if (typeof UIComponents !== 'undefined') {
                        UIComponents.showToast(i18n.t(successMessageKey), 'success');
                    } else if (typeof app !== 'undefined') {
                        app?.showToast?.(i18n.t(successMessageKey), 'success');
                    } else {
                        console.log(i18n.t(successMessageKey));
                    }
                };
                showSuccess();
            } else { throw new Error(); }
        } catch (e) {
            console.error("Copy failed", e);
        }
        textArea.remove();
    }
};
