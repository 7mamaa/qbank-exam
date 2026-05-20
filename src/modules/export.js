/* global pako, React, ReactPDF */
import { state } from '../core/state.js?v=16.6.0';
import { db } from '../core/db.js?v=16.6.0';
import { QueryEngine } from '../core/query.js?v=16.6.0';
import { i18n } from '../core/i18n.js?v=16.6.0';
import { Helpers } from '../utils/helpers.js?v=16.6.0';
import { Logger } from '../utils/logger.js?v=16.6.0';

export const ExportModule = {
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
        // Use passed pool from UI scope, fallback to dashboard QueryEngine if missing
        const pool = passedPool && Array.isArray(passedPool) ? passedPool : QueryEngine.getQueryPool();
        if (pool.length === 0) {
            alert(i18n.t('export_no_questions'));
            return;
        }

        const ts = Date.now();

        if (fmt === 'json') {
            try {
                const beautifyEl = document.getElementById('exportBeautify');
                const compressEl = document.getElementById('exportCompress');
                const isBeautify = beautifyEl ? beautifyEl.checked : false;
                const isCompress = compressEl ? compressEl.checked : true;

                const clean = pool.map(q => { const temp = { ...q }; delete temp.id; return temp; }); // Export clean schema
                const jsonString = isBeautify ? JSON.stringify(clean, null, 4) : JSON.stringify(clean);

                if (isCompress && typeof pako !== 'undefined') {
                    const uint8Array = new TextEncoder().encode(jsonString);
                    const compressedData = pako.gzip(uint8Array);
                    const blob = new Blob([compressedData], { type: 'application/gzip' });
                    this.downloadFile(blob, `qbank_${Date.now()}.json.gz`);
                } else {
                    const blob = new Blob([jsonString], { type: 'application/json' });
                    this.downloadFile(blob, `qbank_${Date.now()}.json`);
                }
            } catch (err) {
                Logger.error('ExportModule', 'Failed to export JSON', err);
                alert((i18n.t('err_export_failed') ? i18n.t('err_export_failed', { message: err.message }) : `فشل التصدير: ${err.message}`));
            }
            return;

        } else if (fmt === 'csv') {
            const headers = ['question', 'type', 'category', 'difficulty', 'answer', 'tags', 'explain'];
            const rows = pool.map(q => headers.map(h => {
                let val = q[h] || '';
                if (Array.isArray(val)) val = val.join('|');
                return `"${String(val).replace(/"/g, '""')}"`;
            }).join(','));
            const csv = [headers.join(','), ...rows].join('\n');
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            this.downloadFile(blob, `qbank_export_${ts}.csv`);

        } else if (fmt === 'md') {
            let md = `# ${i18n.t('question_bank')} - ${new Date().toLocaleDateString(state.language === 'ar' ? 'ar-EG' : 'en-US')}\n\n`;
            pool.forEach((q, i) => {
                md += `### ${i + 1}. ${q.question}\n`;
                if (q.type === 'mcq') {
                    const labels = state.language === 'ar' ? ['أ', 'ب', 'ج', 'د'] : ['A', 'B', 'C', 'D'];
                    q.options.forEach((o, j) => md += `- ${labels[j] || String.fromCharCode(65+j)} ${o}\n`);
                    md += `\n**${i18n.t('export_answer')}:** ${q.answer}\n`;
                } else if (q.type === 'boolean') {
                    md += `\n**${i18n.t('export_answer')}:** ${q.answer ? i18n.t('quiz_true') : i18n.t('quiz_false')}\n`;
                } else if (q.type === 'match') {
                    md += `\n| ${i18n.t('q_pair_right')} | ${i18n.t('q_pair_left')} |\n| :--- | :--- |\n`;
                    (q.pairs || []).forEach(p => md += `| ${p.left} | ${p.right} |\n`);
                } else if (q.type === 'written') {
                    const ansText = q.answer || (q.keywords || []).join(', ');
                    md += `\n**${i18n.t('export_answer')}:** ${ansText}\n`;
                }
                
                if (q.explain) md += `\n> 💡 ${q.explain}\n`;
                if (q.tags && q.tags.length) md += `\n*${i18n.t('all_tags')}: ${q.tags.map(t => `#${t}`).join(' ')}*\n`;
                md += `\n---\n\n`;
            });
            const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' });
            this.downloadFile(blob, `qbank_${ts}.md`);

        } else if (fmt === 'anki') {
            const deckName = document.getElementById('ankiDeckName')?.value || `QBank_Anki_${ts}`;
            let csvContent = `#separator:comma\n#html:true\n#tags column:3\n#deck:${deckName}\nFront,Back,Tags\n`;

            pool.forEach(q => {
                let frontHtml = `<div><strong>${q.question || ''}</strong></div>`;
                let backHtml = `<div><strong>${i18n.t('export_answer')}:</strong> ${q.answer || ''}</div>`;

                // إضافة الخيارات إذا كان السؤال MCQ
                if (q.type === 'mcq' && Array.isArray(q.options)) {
                    frontHtml += `<ul style="text-align: ${state.direction === 'rtl' ? 'right' : 'left'};">`;
                    q.options.forEach(opt => {
                        frontHtml += `<li>${opt}</li>`;
                    });
                    frontHtml += `</ul>`;
                }

                // معالجة المزاوجة (Matching) - تحويلها لجدول في الظهر
                if (q.type === 'match' && Array.isArray(q.pairs)) {
                    backHtml += `<br><table border="1" style="border-collapse: collapse; width: 100%;">`;
                    q.pairs.forEach(pair => {
                        backHtml += `<tr><td style="padding: 5px;">${pair.left || ''}</td><td style="padding: 5px;">${pair.right || ''}</td></tr>`;
                    });
                    backHtml += `</table>`;
                }

                // إضافة الشرح (Explanation) إن وجد
                if (q.explain) {
                    backHtml += `<br><div style="color: #555;"><em>${i18n.t('export_explain')}:</em> ${q.explain}</div>`;
                }

                // معالجة الوسوم (Tags) - أنكي يفضل مسافات بين الوسوم وليس فواصل
                let tagsString = Array.isArray(q.tags) ? q.tags.map(t => t.replace(/\s+/g, '_')).join(' ') : '';

                // تطبيق دالة الحماية وتجميع السطر
                const csvRow = [
                    this.escapeCSV(frontHtml),
                    this.escapeCSV(backHtml),
                    this.escapeCSV(tagsString)
                ].join(',');

                csvContent += csvRow + '\n';
            });

            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            this.downloadFile(blob, `qbank_anki_${ts}.csv`);

        } else if (fmt === 'word') {
            await this.exportToWord(pool, showToastCallback);

        } else if (fmt === 'pdf') {
            this.exportToPdf(pool);
        }
    },

    downloadFile(blob, filename) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    },

    async importData(jsonText, syncCallback) {
        let importedCount = 0;
        try {
            let data;
            try {
                data = JSON.parse(jsonText);
            } catch (e) {
                Logger.error('ExportModule', 'Aborted: JSON data-payload is malformed or corrupted', e);
                throw new Error(i18n.t('err_invalid_format'), { cause: e });
            }

            if (!Array.isArray(data)) throw new Error(i18n.t('err_must_be_array'));

            const manualTargetNb = document.getElementById('import-notebook').value;
            const autoDistribute = document.getElementById('import-auto-distribute')?.checked;

            if (!manualTargetNb && !autoDistribute) throw new Error(i18n.t('err_import_no_target'));

            const questionsToSave = [];
            const qNumberCache = {}; 

            for (const item of data) {
                // Deep clone the incoming item to break all references
                const cleanItem = JSON.parse(JSON.stringify(item));

                if (!cleanItem.type || !['mcq', 'boolean', 'match', 'written'].includes(cleanItem.type)) continue;
                if (!cleanItem.question) continue;

                let finalNbId = manualTargetNb;
                const sourceName = cleanItem.notebookName || (typeof cleanItem.notebookId === 'string' && isNaN(cleanItem.notebookId) ? cleanItem.notebookId : null);

                if (autoDistribute && sourceName) {
                    let existingNb = state.notebooks.find(n => n.name === sourceName || n.id === sourceName);
                    if (existingNb) {
                        finalNbId = existingNb.id;
                    } else {
                        const newNb = {
                            id: Helpers.generateId(),
                            name: sourceName,
                            icon: '📁',
                            color: '#4361ee',
                            createdAt: Date.now()
                        };
                        await db.put('notebooks', newNb);
                        state.notebooks.push(newNb);
                        finalNbId = newNb.id;
                    }
                }

                if (!qNumberCache[finalNbId]) {
                    const nbQs = state.questions.filter(q => q.notebookId === finalNbId);
                    qNumberCache[finalNbId] = nbQs.length + 1;
                }

                const newQ = {
                    id: Helpers.generateId(),
                    notebookId: finalNbId,
                    type: cleanItem.type,
                    question: cleanItem.question,
                    category: cleanItem.category || i18n.t('general'),
                    difficulty: cleanItem.difficulty || 'medium',
                    options: cleanItem.options || [],
                    answer: cleanItem.answer || '',
                    keywords: cleanItem.keywords || [],
                    pairs: cleanItem.pairs || [],
                    explain: cleanItem.explain || '',
                    image: cleanItem.image || null,
                    tags: cleanItem.tags || [],
                    qNumber: qNumberCache[finalNbId]++,
                    createdAt: Date.now()
                };

                questionsToSave.push(newQ);
                importedCount++;
            }

            // Bulk Save: Optimized to use single transaction instead of Promise.all loops
            if (questionsToSave.length > 0) {
                await db.bulkPut('questions', questionsToSave);
            }

            alert(i18n.t('msg_questions_found', { count: importedCount }));
            if (syncCallback) await syncCallback();
        } catch (err) {
            alert(i18n.t('err_import_failed', { message: err.message }));
        }
    },

    /**
     * المعالجة الصارمة للاستيراد: تمنع تمرير المراجع (References) وتمنع تصادم الـ IDs
     */
    async processStrictImport(parsedData, successCallback) {
        // 1. ضمان أن البيانات مصفوفة
        const dataArray = Array.isArray(parsedData) ? parsedData : [parsedData];
        const cleanQuestions = [];

        dataArray.forEach((item, index) => {
            // 2. الاستنساخ العميق (Deep Clone) لقطع أي صلة مرجعية بالسؤال الأصلي
            const cleanItem = JSON.parse(JSON.stringify(item));

            // 3. توليد ID عسكري (مستحيل يتكرر حتى لو في نفس الملي ثانية)
            const cryptoId = (typeof crypto !== 'undefined' && crypto.randomUUID) 
                ? crypto.randomUUID() 
                : `import_${Date.now()}_${Math.random().toString(36).substring(2, 10)}_${index}`;

            cleanItem.id = cryptoId;

            // 4. تأمين المصفوفات الداخلية (خيارات ووسوم)
            cleanItem.options = Array.isArray(cleanItem.options) ? [...cleanItem.options] : [];
            cleanItem.tags = Array.isArray(cleanItem.tags) ? [...cleanItem.tags] : [];
            cleanItem.pairs = Array.isArray(cleanItem.pairs) ? [...cleanItem.pairs] : [];

            // 5. تأكيد الطابع الزمني الجديد
            cleanItem.createdAt = Date.now() + index; // إضافة الـ index لمنع تطابق التوقيت تماماً

            // Set mandatory fields missing in strict mode
            cleanItem.notebookId = cleanItem.notebookId || 'orphaned';
            cleanItem.type = cleanItem.type || 'mcq';

            cleanQuestions.push(cleanItem);
        });

        // 6. الحفظ الجماعي (Bulk Save) - تفريغ المصفوفة في قاعدة البيانات (Optimized Architecture)
        try {
            await db.bulkPut('questions', cleanQuestions);
            console.log(`[Import Engine] Successfully injected ${cleanQuestions.length} unique items.`);
            if (successCallback) successCallback();
        } catch (dbError) {
            console.error("[Import Engine] DB Write Failure:", dbError);
            throw dbError;
        }
    },

    exportToWord: async function(pool, showToastCallback) {
        if (typeof docx === 'undefined') {
            return alert(i18n.t('export_err_word_lib'));
        }

        const { Document, Packer, Paragraph, TextRun, AlignmentType, HeadingLevel, Table, TableRow, TableCell, WidthType } = window.docx;

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
        window.saveAs(blob, `qbank_export_${Date.now()}.docx`);
        if (showToastCallback) showToastCallback(i18n.t('export_word_success'));
    },

    exportToPdf(pool) {
        try {
            const layout = document.getElementById('pdf-layout')?.value || 'questions-only';
            const customHeader = document.getElementById('pdf-custom-header')?.value;
            const showImages = document.getElementById('pdf-show-images')?.checked;
            const direction = document.getElementById('pdf-direction')?.value || 'rtl';
            const twoColumns = document.getElementById('pdf-two-columns')?.checked;

            const showAns = layout === 'with-answers';
            const isAnnex = layout === 'exam-annex';

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

            pool.forEach((q, idx) => {
                const sQuestion = Helpers.sanitize(q.question);
                const sExplain = Helpers.sanitize(q.explain || '');
                bodyHtml += `<div class="print-question" style="page-break-inside: avoid; border: 1px solid #eee; padding: 15px; margin-bottom: 20px; border-radius: 8px;">`;
                bodyHtml += `<h3 style="margin: 0 0 10px 0; font-size: 1.1rem; font-weight: 700;">${i18n.t('nav_questions')} ${idx + 1}: ${sQuestion}</h3>`;
                
                if (showImages && q.image) {
                    bodyHtml += `<div style="text-align: center; margin: 15px 0;"><img src="${q.image}" style="max-width: 100%; max-height: 250px; border-radius: 4px; border: 1px solid #ccc;"></div>`;
                }

                const labels = direction === 'rtl' ? ['أ', 'ب', 'ج', 'د'] : ['A', 'B', 'C', 'D'];

                if (q.type === 'mcq') {
                    bodyHtml += `<ul style="list-style:none; padding-${direction === 'rtl' ? 'right' : 'left'}:20px; line-height:1.8; margin: 10px 0;">`;
                    (q.options || []).forEach((o, oIdx) => {
                        const sOpt = Helpers.sanitize(o);
                        const isCorrect = showAns && o === q.answer;
                        bodyHtml += `<li style="margin-bottom: 5px; ${isCorrect ? 'font-weight:bold; color:#2a9d8f; background: rgba(42, 157, 143, 0.05); padding: 2px 8px; border-radius: 4px;' : ''}">${labels[oIdx] || oIdx + 1}) ${sOpt}</li>`;
                    });
                    bodyHtml += `</ul>`;
                    if (isAnnex || showAns) {
                        const correctLabel = labels[q.options?.indexOf(q.answer)] || Helpers.sanitize(q.answer);
                        answersAnnex += `<div style="margin-bottom: 4px;"><strong>${idx + 1}.</strong> ${correctLabel}</div>`;
                    }
                } else if (q.type === 'boolean') {
                    bodyHtml += `<p style="margin: 10px 0;">( ${i18n.t('quiz_true')} / ${i18n.t('quiz_false')} )</p>`;
                    const ansText = q.answer ? i18n.t('quiz_true') : i18n.t('quiz_false');
                    if (showAns) bodyHtml += `<p style="color:#2a9d8f; font-weight:bold;">${i18n.t('export_answer')}: ${ansText}</p>`;
                    if (isAnnex || showAns) answersAnnex += `<div style="margin-bottom: 4px;"><strong>${idx + 1}.</strong> ${ansText}</div>`;
                } else if (q.type === 'written') {
                    const ansText = Helpers.sanitize(q.answer || (q.keywords || []).join(' - '));
                    if (showAns) bodyHtml += `<p style="color:#2a9d8f; margin: 10px 0;"><strong>${i18n.t('export_answer')}:</strong> ${ansText}</p>`;
                    else bodyHtml += `<div style="height:100px; border-bottom:1px dashed #999; margin:15px 0;"></div>`;
                    if (isAnnex || showAns) answersAnnex += `<div style="margin-bottom: 4px;"><strong>${idx + 1}.</strong> ${ansText}</div>`;
                } else if (q.type === 'match') {
                    const pairs = q.pairs || [];
                    let rights = pairs.map(p => p.right);
                    if (!showAns) rights = [...rights].sort(() => Math.random() - 0.5);
                    const tableLabels = [i18n.t('q_pair_left'), i18n.t('export_answer'), i18n.t('q_pair_right')];
                    bodyHtml += `
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
                if (showAns && q.explain) bodyHtml += `<p style="margin-top:10px;border-${direction==='rtl'?'right':'left'}:4px solid #4361ee;padding-${direction==='rtl'?'right':'left'}:10px;color:#555;background:rgba(67, 97, 238, 0.05);"><strong>💡 ${i18n.t('export_explain')}:</strong> ${sExplain}</p>`;
                bodyHtml += `</div>`;
            });

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
                        window.print();
                    }, 300);
                });
            }
        } catch (err) {
            alert(i18n.t('err_export_failed', { message: err.message }));
        }
    },

    getQuestionTypeLabel(type) {
        const key = `type_${type}`;
        return i18n.t(key);
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
            window.open(url, '_blank');
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
            await ExportModule.processStrictImport(ExportModule.loadedReferenceData, () => {
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
                
                if (window.app && typeof window.app.syncData === 'function') {
                    window.app.syncData();
                }
                
                alert(i18n.t('msg_import_success'));
            });
        } catch (err) {
            console.error('[Reference Hub] Import failed:', err);
            alert(i18n.t('err_import_failed', { message: err.message }));
            if (confirmBtn) confirmBtn.disabled = false;
        }
    }
};
