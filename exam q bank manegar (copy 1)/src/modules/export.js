import { state } from '../core/state.js';
import { db } from '../core/db.js';
import { QueryEngine } from '../core/query.js';
import { i18n } from '../core/i18n.js';
import { Helpers } from '../utils/helpers.js';

export const ExportModule = {
    updateExportScopeCounts() {
        const pool = QueryEngine.getQueryPool();
        const count = pool.length;
        
        const countEls = document.querySelectorAll('.export-scope-count');
        countEls.forEach(el => {
            el.textContent = i18n.t('export_questions_count', { count });
        });
    },

    async exportData(fmt, showToastCallback) {
        const pool = QueryEngine.getQueryPool();
        if (pool.length === 0) {
            alert(i18n.t('export_no_questions'));
            return;
        }

        const ts = Date.now();

        if (fmt === 'json') {
            const clean = pool.map(({id, ...rest}) => rest); // Export clean schema
            const blob = new Blob([JSON.stringify(clean, null, 2)], { type: 'application/json' });
            this.downloadFile(blob, `qbank_export_${ts}.json`);

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
                    md += `\n**${i18n.t('export_keywords')}:** ${(q.keywords || []).join(', ')}\n`;
                }
                
                if (q.explain) md += `\n> 💡 ${q.explain}\n`;
                if (q.tags && q.tags.length) md += `\n*${i18n.t('all_tags')}: ${q.tags.map(t => `#${t}`).join(' ')}*\n`;
                md += `\n---\n\n`;
            });
            const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' });
            this.downloadFile(blob, `qbank_${ts}.md`);

        } else if (fmt === 'anki') {
            let txt = '#separator:tab\n#html:false\n';
            pool.forEach(q => {
                let front = q.question;
                let back = '';
                const isRtl = state.direction === 'rtl';
                if (q.type === 'mcq') {
                    const labels = isRtl ? ['أ', 'ب', 'ج', 'د'] : ['A', 'B', 'C', 'D'];
                    back = `${i18n.t('export_answer')}: ${q.answer}\n` + (q.options || []).map((o, i) => `${labels[i] || String.fromCharCode(65+i)}) ${o}`).join('\n');
                }
                else if (q.type === 'boolean') back = `${i18n.t('export_answer')}: ${q.answer ? i18n.t('quiz_true') : i18n.t('quiz_false')}`;
                else if (q.type === 'written') back = `${i18n.t('export_keywords')}: ${(q.keywords || []).join(' - ')}`;
                else if (q.type === 'match') back = (q.pairs || []).map(p => `${p.left} → ${p.right}`).join('\n');
                if (q.explain) back += `\n\n${i18n.t('export_explain')}: ${q.explain}`;
                txt += `${front}\t${back}\n`;
            });
            const blob = new Blob([txt], { type: 'text/plain;charset=utf-8;' });
            this.downloadFile(blob, `qbank_anki_${ts}.txt`);

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
        try {
            let data;
            try {
                data = JSON.parse(jsonText);
            } catch (e) {
                console.error("Parse error:", e);
                throw new Error(i18n.t('err_invalid_format'));
            }

            if (!Array.isArray(data)) throw new Error(i18n.t('err_must_be_array'));

            const manualTargetNb = document.getElementById('import-notebook').value;
            const autoDistribute = document.getElementById('import-auto-distribute')?.checked;

            if (!manualTargetNb && !autoDistribute) throw new Error(i18n.t('err_import_no_target'));

            let importedCount = 0;
            const qNumberCache = {}; 

            for (const item of data) {
                if (!item.type || !['mcq', 'boolean', 'match', 'written'].includes(item.type)) continue;
                if (!item.question) continue;

                let finalNbId = manualTargetNb;
                // Identify source name: prefer notebookName, then notebookId (even if numeric)
                const sourceName = item.notebookName || (item.notebookId ? String(item.notebookId) : null);

                if (autoDistribute && sourceName) {
                    let existingNb = state.notebooks.find(n => n.name === sourceName || n.id === sourceName);
                    if (existingNb) {
                        finalNbId = existingNb.id;
                    } else {
                        const newNb = {
                            id: 'nb-' + (item.notebookId || Date.now().toString() + Math.random().toString(36).substr(2, 5)),
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
                    const maxNum = nbQs.reduce((max, q) => Math.max(max, q.qNumber || 0), 0);
                    qNumberCache[finalNbId] = maxNum + 1;
                }

                // Normalize Boolean Answer
                let finalAnswer = item.answer;
                if (item.type === 'boolean') {
                    if (typeof finalAnswer === 'string') {
                        const lowAns = finalAnswer.toLowerCase().trim();
                        if (lowAns === 'true' || lowAns === '1' || lowAns === 'صح' || lowAns === 'yes') finalAnswer = true;
                        else if (lowAns === 'false' || lowAns === '0' || lowAns === 'خطأ' || lowAns === 'no' || lowAns === '') finalAnswer = false;
                    }
                }

                const newQ = {
                    id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
                    notebookId: finalNbId,
                    type: item.type,
                    question: item.question,
                    category: item.category || i18n.t('general'),
                    difficulty: item.difficulty || 'medium',
                    options: item.options || [],
                    answer: finalAnswer !== undefined ? finalAnswer : '',
                    keywords: item.keywords || [],
                    pairs: item.pairs || [],
                    explain: item.explain || '',
                    image: item.image || null,
                    tags: Array.isArray(item.tags) ? item.tags : (item.tags ? [item.tags] : []),
                    qNumber: item.qNumber || qNumberCache[finalNbId]++,
                    createdAt: item.createdAt || Date.now()
                };

                await db.put('questions', newQ);
                importedCount++;
            }

            alert(i18n.t('msg_questions_found', { count: importedCount }));
            if (syncCallback) syncCallback();
        } catch (err) {
            alert(i18n.t('err_import_failed', { message: err.message }));
        }
    },

    async exportToWord(pool, showToastCallback) {
        if (typeof docx === 'undefined') {
            return alert(i18n.t('export_err_word_lib'));
        }

        const { Document, Packer, Paragraph, TextRun, AlignmentType, HeadingLevel, Table, TableRow, TableCell, WidthType } = docx;

        const layout = document.getElementById('word-layout')?.value || 'questions-only';
        const customHeader = document.getElementById('word-custom-header')?.value || 'بنك الأسئلة الاحترافي - QBank';
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
                if (isAnnex) answersAnnex.push(`${qNum}. ${ (q.keywords || []).join(', ') }`);
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
        saveAs(blob, `qbank_export_${Date.now()}.docx`);
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
                try { return JSON.parse(localStorage.getItem('qbank_institution') || '{}'); } catch(e) { return {}; }
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
                    const kws = (q.keywords || []).map(k => Helpers.sanitize(k)).join(' - ');
                    if (showAns) bodyHtml += `<p style="color:#2a9d8f; margin: 10px 0;"><strong>${i18n.t('export_keywords')}:</strong> ${kws}</p>`;
                    else bodyHtml += `<div style="height:100px; border-bottom:1px dashed #999; margin:15px 0;"></div>`;
                    if (isAnnex || showAns) answersAnnex += `<div style="margin-bottom: 4px;"><strong>${idx + 1}.</strong> ${kws}</div>`;
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
                                    const sRight = Helpers.sanitize(p.right);
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
    }
};
