import { db } from '../core/db.js?v=16.6.0';
import { state } from '../core/state.js?v=16.6.0';
import { Helpers } from '../utils/helpers.js?v=16.6.0';
import { i18n } from '../core/i18n.js?v=16.6.0';
import { NotebookModule } from './notebooks.js?v=16.6.0';

/**
 * @module QuestionModule
 * @description Handles all operations related to questions including CRUD, rendering, and validation.
 */
export const QuestionModule = {
    /**
     * Loads all questions from database into state and triggers callbacks.
     * @param {Function} [renderCallback] - Callback to refresh UI.
     * @param {Function} [updateExportCountsCallback] - Callback to update export scope counts.
     */
    async loadQuestions(renderCallback, updateExportCountsCallback) {
        state.questions = await db.getAll('questions');
        if (renderCallback) renderCallback();
        if (updateExportCountsCallback) updateExportCountsCallback();
    },

    /**
     * Normalizes a medical answer by removing common filler words and normalizing whitespace.
     * @param {string} text 
     * @returns {string}
     */
    normalizeMedicalAnswer(text) {
        if (!text) return '';
        return text.toLowerCase()
            .replace(/\b(the|a|an|is|are|was|were|be|been|being|in|on|at|of|to|for|with|by|from|up|down|and|but|or|yet|so)\b/gi, '')
            .replace(/\s+/g, ' ')
            .trim();
    },

    /**
     * Adds a new match pair row to the form.
     */
    addMatchPairRow() {
        const container = document.getElementById('match-pairs-container');
        if (!container) return;
        const row = document.createElement('div');
        row.className = 'match-pair-row';
        row.style = 'display:flex; gap:10px; margin-bottom:10px;';
        row.innerHTML = `
            <input type="text" class="form-control pair-left" placeholder="${i18n.t('q_pair_left')}" required>
            <input type="text" class="form-control pair-right" placeholder="${i18n.t('q_pair_right')}" required>
            <button type="button" class="btn btn-sm btn-danger" onclick="this.parentElement.remove()">X</button>
        `;
        container.appendChild(row);
    },

    /**
     * Renders dynamic fields in the question modal based on question type.
     * @param {string} type - Question type (mcq, boolean, written, match).
     * @param {Object} [data] - Existing question data for editing.
     */
    renderDynamicFields(type, data = null) {
        const container = document.getElementById('dynamic-fields-container');
        if (!container) return;
        let html = '';

        if (type === 'mcq') {
            const opts = data?.options || ['', '', '', ''];
            const ans = data?.answer || '';
            const labels = ['A', 'B', 'C', 'D'];
            html = `
                <div style="display:block; margin-bottom:10px; font-weight:bold;">${i18n.t('q_mcq_hint')}</div>
                ${opts.map((opt, i) => `
                    <div style="display:flex; gap:10px; margin-bottom:8px; align-items:center;">
                        <div style="width:28px; height:28px; background:var(--primary); color:white; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:bold; font-size:0.8rem; flex-shrink:0;">${labels[i]}</div>
                        <input type="radio" name="mcq_answer" id="radio_opt_${i}" value="${i}" ${ans === opt && ans !== '' ? 'checked' : (i === 0 ? 'checked' : '')} style="width: 20px; height: 20px; cursor:pointer;">
                        <label for="mcq_opt_${i}" style="display:none;">${i18n.t('q_mcq_opt_label', { label: labels[i] })}</label>
                        <input type="text" id="mcq_opt_${i}" class="form-control" placeholder="${i18n.t('q_mcq_opt_placeholder')}" value="${Helpers.sanitize(opt)}" required style="flex:1;">
                    </div>
                `).join('')}
            `;
        } else if (type === 'boolean') {
            const ans = data?.answer !== undefined ? data.answer : true;
            html = `
                <label for="bool_answer" style="display:block; margin-bottom:10px; font-weight:bold;">${i18n.t('q_bool_correct')}</label>
                <select id="bool_answer" class="form-control">
                    <option value="true" ${ans === true ? 'selected' : ''}>${i18n.t('quiz_true')}</option>
                    <option value="false" ${ans === false ? 'selected' : ''}>${i18n.t('quiz_false')}</option>
                </select>
            `;
        } else if (type === 'written') {
            const answer = data?.answer || (data?.keywords ? data.keywords.join(', ') : '');
            html = `
                <label for="written_answer" style="display:block; margin-bottom:10px; font-weight:bold;">${i18n.t('q_written_ans_label')}</label>
                <textarea id="written_answer" class="form-control" rows="4" placeholder="${i18n.t('q_written_ans_placeholder')}">${Helpers.sanitize(answer)}</textarea>
            `;
        } else if (type === 'match') {
            html = `
                <div style="display:block; margin-bottom:10px; font-weight:bold;">${i18n.t('q_match_title')}</div>
                <div id="match-pairs-container">
                    ${(data?.pairs || [{left:'', right:''}]).map(p => `
                        <div class="match-pair-row" style="display:flex; gap:10px; margin-bottom:10px;">
                            <input type="text" class="form-control pair-left" placeholder="${i18n.t('q_pair_left')}" value="${Helpers.sanitize(p.left)}" required>
                            <input type="text" class="form-control pair-right" placeholder="${i18n.t('q_pair_right')}" value="${Helpers.sanitize(p.right)}" required>
                            <button type="button" class="btn btn-sm btn-danger" onclick="this.parentElement.remove()">X</button>
                        </div>
                    `).join('')}
                </div>
                <button type="button" class="btn btn-sm" onclick="app.addMatchPairRow()">${i18n.t('q_match_add')}</button>
            `;
        }

        container.innerHTML = html;
    },

    /**
     * Handles question form submission (Add/Edit).
     * @param {Event} e - Form submit event.
     * @param {Function} performActionCallback - Global app action handler.
     * @param {Function} closeModalCallback - Global modal closer.
     * @param {Function} setPendingQuestionCallback - Handler for duplicate confirmation.
     */
    async handleQuestionSubmit(e, performActionCallback, closeModalCallback, setPendingQuestionCallback) {
        e.preventDefault();
        const idInput = document.getElementById('question-id').value;
        const type = document.getElementById('question-type').value;

        let qData = {
            id: idInput || Helpers.generateId(),
            notebookId: document.getElementById('question-notebook').value,
            type: type,
            question: document.getElementById('question-text').value,
            category: document.getElementById('question-category').value,
            difficulty: document.getElementById('question-difficulty').value,
            tags: document.getElementById('question-tags').value.split(',').map(t => t.trim()).filter(t => t),
            explain: document.getElementById('question-explain').value,
        };

        if (type === 'mcq') {
            qData.options = [
                document.getElementById('mcq_opt_0').value,
                document.getElementById('mcq_opt_1').value,
                document.getElementById('mcq_opt_2').value,
                document.getElementById('mcq_opt_3').value
            ];
            const selectedIdx = document.querySelector('input[name="mcq_answer"]:checked').value;
            qData.answer = qData.options[selectedIdx];
        } else if (type === 'boolean') {
            qData.answer = document.getElementById('bool_answer').value === 'true';
        } else if (type === 'written') {
            qData.answer = document.getElementById('written_answer').value.trim();
            // Optional: keep keywords for backward compatibility if needed, but the lead wants full sentences.
            // We'll just use answer.
        } else if (type === 'match') {
            qData.pairs = [];
            document.querySelectorAll('.match-pair-row').forEach(row => {
                qData.pairs.push({
                    left: row.querySelector('.pair-left').value,
                    right: row.querySelector('.pair-right').value
                });
            });
        }

        // Logic for qNumber assignment
        const originalQ = idInput ? state.questions.find(x => x.id === idInput) : null;
        const notebookChanged = originalQ && String(originalQ.notebookId) !== String(qData.notebookId);

        if (!idInput || notebookChanged) {
            const nbQs = state.questions.filter(q => String(q.notebookId) === String(qData.notebookId));
            qData.qNumber = nbQs.length + (idInput ? 0 : 1);
        } else {
            qData.qNumber = originalQ.qNumber;
        }

        // Duplicate Check
        if (!idInput) {
            let highestMatch = 0;
            for (let ex of state.questions) {
                let sim = Helpers.calculateSimilarity(ex.question, qData.question);
                if (sim > highestMatch) highestMatch = sim;
            }

            if (highestMatch >= 75) {
                if (setPendingQuestionCallback) setPendingQuestionCallback(qData);
                const msgEl = document.getElementById('duplicate-msg');
                if (msgEl) msgEl.textContent = i18n.t('q_duplicate_found', { percent: Math.round(highestMatch) });
                const modalEl = document.getElementById('duplicate-modal');
                if (modalEl) modalEl.classList.add('active');
                return;
            }
        }

        const imgB64 = document.getElementById('question-image-base64').value;
        if (imgB64) qData.image = imgB64;

        if (idInput) {
            const exQ = state.questions.find(x => x.id === idInput);
            if (exQ && exQ.isPinned) qData.isPinned = true;
        }

        if (performActionCallback) await performActionCallback(idInput ? 'edit_question' : 'add_question', qData);

        localStorage.removeItem('qbank_draft');
        if (closeModalCallback) closeModalCallback('question-modal');
    },

    /**
     * Deletes a question after confirmation.
     * @param {string} id - Question ID.
     * @param {Function} performActionCallback - Global app action handler.
     */
    async deleteQuestion(id, performActionCallback) {
        if (confirm(i18n.t('q_delete_confirm'))) {
            if (performActionCallback) await performActionCallback('delete_question', id);
        }
    },

    /**
     * populates the modal with question data for editing.
     * @param {string} id - Question ID.
     * @param {Function} openModalCallback - Global modal opener.
     * @param {Function} removeImageCallback - Image cleanup helper.
     */
    editQuestion(id, openModalCallback, removeImageCallback) {
        const q = state.questions.find(x => x.id === id);
        if (!q) return;

        document.getElementById('question-id').value = q.id;
        document.getElementById('question-notebook').value = q.notebookId;
        document.getElementById('question-type').value = q.type;
        document.getElementById('question-text').value = q.question;
        document.getElementById('question-category').value = q.category;
        document.getElementById('question-difficulty').value = q.difficulty;
        document.getElementById('question-tags').value = (q.tags || []).join(', ');
        document.getElementById('question-explain').value = q.explain || '';

        if (q.image) {
            document.getElementById('question-image-base64').value = q.image;
            const preview = document.getElementById('question-image-preview');
            if (preview) {
                preview.src = q.image;
                preview.style.display = 'block';
            }
            const btnRemove = document.getElementById('btn-remove-image');
            if (btnRemove) btnRemove.style.display = 'inline-block';
        } else {
            if (removeImageCallback) removeImageCallback();
        }

        this.renderDynamicFields(q.type, q);
        if (openModalCallback) openModalCallback('question-modal');
    },

    /**
     * Handles image upload and compression to WebP.
     * @param {Event} e - Change event from file input.
     */
    handleImageUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 800;
                let width = img.width;
                let height = img.height;
                if (width > MAX_WIDTH) {
                    height *= MAX_WIDTH / width;
                    width = MAX_WIDTH;
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                const dataUrl = canvas.toDataURL('image/webp', 0.8);

                document.getElementById('question-image-base64').value = dataUrl;
                const preview = document.getElementById('question-image-preview');
                if (preview) {
                    preview.src = dataUrl;
                    preview.style.display = 'block';
                }
                const btnRemove = document.getElementById('btn-remove-image');
                if (btnRemove) btnRemove.style.display = 'inline-block';
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    },

    /**
     * Removes image from the question draft.
     */
    removeImage() {
        const uploadEl = document.getElementById('question-image-upload');
        if (uploadEl) uploadEl.value = '';
        const base64El = document.getElementById('question-image-base64');
        if (base64El) base64El.value = '';
        const previewEl = document.getElementById('question-image-preview');
        if (previewEl) {
            previewEl.src = '';
            previewEl.style.display = 'none';
        }
        const btnRemoveEl = document.getElementById('btn-remove-image');
        if (btnRemoveEl) btnRemoveEl.style.display = 'none';
    },

    /**
     * Updates the datalist for tags based on existing questions.
     */
    updateTagsDatalist() {
        const allTags = new Set();
        state.questions.forEach(q => {
            if (q.tags && Array.isArray(q.tags)) {
                q.tags.forEach(t => allTags.add(t.trim()));
            }
        });
        const datalist = document.getElementById('tags-list');
        if (datalist) {
            datalist.innerHTML = Array.from(allTags).map(t => `<option value="${Helpers.sanitize(t)}">`).join('');
        }
    },

    /**
     * Updates the main filter dropdowns for categories and tags.
     */
    updateFilterDropdowns() {
        const catSelect = document.getElementById('filter-category');
        const tagSelect = document.getElementById('filter-tag');
        if (!catSelect || !tagSelect) return;

        const categories = [...new Set(state.questions.map(q => q.category))].filter(Boolean).sort((a, b) => {
            const valA = typeof a === 'object' ? (a.order ?? a.id ?? a) : a;
            const valB = typeof b === 'object' ? (b.order ?? b.id ?? b) : b;
            const numA = Number(valA);
            const numB = Number(valB);
            if (!isNaN(numA) && !isNaN(numB)) {
                return numA - numB;
            }
            return String(valA).localeCompare(String(valB), undefined, { numeric: true, sensitivity: 'base' });
        });
        const tags = [...new Set(state.questions.flatMap(q => q.tags || []))].filter(Boolean).sort((a, b) => {
            const valA = typeof a === 'object' ? (a.order ?? a.id ?? a) : a;
            const valB = typeof b === 'object' ? (b.order ?? b.id ?? b) : b;
            const numA = Number(valA);
            const numB = Number(valB);
            if (!isNaN(numA) && !isNaN(numB)) {
                return numA - numB;
            }
            return String(valA).localeCompare(String(valB), undefined, { numeric: true, sensitivity: 'base' });
        });

        let catHtml = `<option value="">${i18n.t('all_categories')}</option>`;
        catHtml += `<option value="__none__" style="color:var(--danger-color); font-weight:bold;">${i18n.t('q_no_cat')}</option>`;
        catHtml += categories.map(c => `<option value="${Helpers.sanitize(c)}">${Helpers.sanitize(c)}</option>`).join('');
        catSelect.innerHTML = catHtml;

        let tagHtml = `<option value="">${i18n.t('all_tags')}</option>`;
        tagHtml += `<option value="__none__" style="color:var(--danger-color); font-weight:bold;">${i18n.t('q_no_tag')}</option>`;
        tagHtml += tags.map(t => `<option value="${Helpers.sanitize(t)}">#${Helpers.sanitize(t)}</option>`).join('');
        tagSelect.innerHTML = tagHtml;
    },

    /**
     * Finds similar tags using Levenshtein distance and suggests merges.
     * @returns {Array} List of suggestions {from, to, fromCount, toCount}.
     */
    suggestTagMerges() {
        const allTags = state.questions.flatMap(q => q.tags || []).filter(Boolean);
        const counts = {};
        allTags.forEach(t => counts[t] = (counts[t] || 0) + 1);
        
        const uniqueTags = Object.keys(counts);
        const suggestions = [];
        const handled = new Set();

        for (let i = 0; i < uniqueTags.length; i++) {
            for (let j = i + 1; j < uniqueTags.length; j++) {
                const t1 = uniqueTags[i];
                const t2 = uniqueTags[j];
                
                if (handled.has(t1) || handled.has(t2)) continue;

                const distance = Helpers.levenshtein(t1.toLowerCase(), t2.toLowerCase());
                
                if (distance > 0 && distance <= 2) {
                    const [target, source] = counts[t1] >= counts[t2] ? [t1, t2] : [t2, t1];
                    suggestions.push({ from: source, to: target, fromCount: counts[source], toCount: counts[target] });
                    handled.add(source); 
                }
            }
        }
        return suggestions;
    },

    /**
     * Applies tag merges to all questions in IndexedDB.
     * @param {Array} merges - List of {from, to} pairs.
     */
    async applyTagMerges(merges) {
        if (!merges || merges.length === 0) return;
        
        let updateCount = 0;
        await Helpers.runInChunks(state.questions, 100, async (q) => {
            let changed = false;
            if (q.tags && Array.isArray(q.tags)) {
                const newTags = q.tags.map(tag => {
                    const merge = merges.find(m => m.from === tag);
                    if (merge) {
                        changed = true;
                        return merge.to;
                    }
                    return tag;
                });

                if (changed) {
                    q.tags = [...new Set(newTags)].filter(Boolean);
                    await db.put('questions', q);
                    updateCount++;
                }
            }
        });
        return updateCount;
    },

    /**
     * Finds similar categories using Levenshtein distance and suggests merges.
     * @returns {Array} List of suggestions {from, to, fromCount, toCount}.
     */
    suggestCategoryMerges() {
        const allCats = state.questions.map(q => q.category).filter(Boolean);
        const counts = {};
        allCats.forEach(c => counts[c] = (counts[c] || 0) + 1);
        
        const uniqueCats = Object.keys(counts);
        const suggestions = [];
        const handled = new Set();

        for (let i = 0; i < uniqueCats.length; i++) {
            for (let j = i + 1; j < uniqueCats.length; j++) {
                const c1 = uniqueCats[i];
                const c2 = uniqueCats[j];
                
                if (handled.has(c1) || handled.has(c2)) continue;

                const distance = Helpers.levenshtein(c1.toLowerCase(), c2.toLowerCase());
                
                if (distance > 0 && distance <= 2) {
                    const [target, source] = counts[c1] >= counts[c2] ? [c1, c2] : [c2, c1];
                    suggestions.push({ from: source, to: target, fromCount: counts[source], toCount: counts[target] });
                    handled.add(source); 
                }
            }
        }
        return suggestions;
    },

    /**
     * Applies category merges to all questions in IndexedDB.
     * @param {Array} merges - List of {from, to} pairs.
     */
    async applyCategoryMerges(merges) {
        if (!merges || merges.length === 0) return;

        let updateCount = 0;
        await Helpers.runInChunks(state.questions, 100, async (q) => {
            const merge = merges.find(m => m.from === q.category);
            if (merge) {
                q.category = merge.to;
                await db.put('questions', q);
                updateCount++;
            }
        });
        return updateCount;
    },

    /**
     * Renders the question list with filtering and pagination.
     * @param {Function} editCallback - Callback for editing a question.
     * @param {Function} toggleSelectCallback - Callback for bulk selection.
     */
    renderQuestions(editCallback) {
        const container = document.getElementById('questions-container');
        const emptyState = document.getElementById('questions-empty-state');
        const paginationControls = document.getElementById('pagination-controls');
        if (!container || !emptyState || !paginationControls) return;

        const filters = {
            notebook: document.getElementById("filter-notebook").value,
            category: document.getElementById("filter-category").value,
            tag: document.getElementById("filter-tag").value,
            type: document.getElementById("filter-type").value,
            difficulty: document.getElementById("filter-difficulty").value,
            search: document.getElementById("filter-search").value.toLowerCase().trim()
        };

        // Performance Optimization: Pre-calculate descendant IDs once
        let descendantIds = null;
        if (filters.notebook && filters.notebook !== 'orphaned') {
            descendantIds = NotebookModule.getAllDescendantIds(filters.notebook, state.notebooks);
        }

        let filtered = state.questions.filter(q => {
            if (filters.notebook === 'orphaned') {
                if (state.notebooks.some(n => String(n.id) === String(q.notebookId))) return false;
            } else if (filters.notebook) {
                const qNbId = String(q.notebookId);
                const targetNbId = String(filters.notebook);
                const mappedDescendantIds = (descendantIds || []).map(String);
                if (qNbId !== targetNbId && !mappedDescendantIds.includes(qNbId)) return false;
            }
            
            if (filters.category === '__none__') {
                if (q.category && q.category.trim() !== '') return false;
            } else if (filters.category && q.category !== filters.category) return false;

            if (filters.tag === '__none__') {
                if (q.tags && q.tags.length > 0) return false;
            } else if (filters.tag && !(q.tags || []).includes(filters.tag)) return false;

            if (filters.type && q.type !== filters.type) return false;
            if (filters.difficulty && q.difficulty !== filters.difficulty) return false;
            if (filters.search) {
                const tagStr = (q.tags || []).join(' ');
                const mainText = `${q.question} ${tagStr} ${q.category || ''}`;
                if (!Helpers.fuzzyMatch(mainText, filters.search)) return false;
            }
            return true;
        });

        filtered.sort((a, b) => {
            if (a.isPinned && !b.isPinned) return -1;
            if (!a.isPinned && b.isPinned) return 1;
            const valA = a.qNumber ?? a.id;
            const valB = b.qNumber ?? b.id;
            const numA = Number(valA);
            const numB = Number(valB);
            if (!isNaN(numA) && !isNaN(numB)) {
                return numA - numB;
            }
            return String(valA).localeCompare(String(valB), undefined, { numeric: true, sensitivity: 'base' });
        });

        state.virtual.filteredQuestions = filtered;

        const itemsPerPage = state.virtual.itemsPerPage;
        const totalPages = Math.ceil(filtered.length / itemsPerPage) || 1;
        if (state.virtual.currentPage > totalPages) state.virtual.currentPage = totalPages;

        const start = (state.virtual.currentPage - 1) * itemsPerPage;
        const pageItems = filtered.slice(start, start + itemsPerPage);

        if (filtered.length === 0) {
            container.innerHTML = "";
            emptyState.style.display = 'block';
            paginationControls.style.display = 'none';
        } else {
            emptyState.style.display = 'none';
            paginationControls.style.display = totalPages > 1 ? 'flex' : 'none';

            // Performance Optimization: Pre-calculate notebook lookup map
            const notebookMap = {};
            state.notebooks.forEach(n => notebookMap[n.id] = n.name);

            // Use string building + single innerHTML update for massive performance gain
            container.innerHTML = pageItems.map(q => {
                const nbName = notebookMap[q.notebookId] || i18n.t('q_not_defined');
                return this.getQuestionCardHTML(q, nbName);
            }).join('');

            // Event Delegation for clicks
            container.onclick = (e) => {
                const card = e.target.closest('.question-card');
                if (!card) return;
                
                // If user clicked an action button inside the card, let the button handle it
                if (e.target.closest('.q-card-actions') || e.target.closest('.btn-icon')) return;
                
                const qId = card.dataset.id;
                if (editCallback) editCallback(qId);
            };
        }
        
        this.updatePaginationUI(totalPages);
    },

    /**
     * Helper to create a question card HTML string.
     * @private
     */
    getQuestionCardHTML(q, nbName) {
        const svgIcons = {
            mcq: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>`,
            boolean: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path></svg>`,
            written: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>`,
            match: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="6" y1="3" x2="6" y2="15"></line><circle cx="18" cy="6" r="3"></circle><circle cx="6" cy="18" r="3"></circle><path d="M18 9a9 9 0 0 1-9 9"></path></svg>`
        };

        const labelMap = { mcq: 'MCQ', boolean: 'T/F', written: i18n.t('type_written') || 'مقالي', match: i18n.t('type_match') || 'مزاوجة' };
        const icon     = svgIcons[q.type] || `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>`;
        const typeLabel = labelMap[q.type] || q.type;
        const diffLabel = i18n.t(`difficulty_${q.difficulty}`);

        const sQuestion = Helpers.sanitize(q.question);
        const sNbName   = Helpers.sanitize(nbName);

        const tagsHtml = (q.tags || []).map(t =>
            `<span class="q-tag">#${Helpers.sanitize(t)}</span>`
        ).join('');

        return `
            <div class="question-card ${q.isPinned ? 'pinned' : ''}" data-id="${q.id}">
                <div class="drag-handle">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
                </div>
                <div style="display:flex; align-items:center; gap:8px; min-width:50px; flex-shrink:0;">
                    <span style="font-size:0.8rem; font-weight:800; color:var(--primary); opacity:0.6;">#${q.qNumber || '?'}</span>
                    <input type="checkbox" class="bulk-cb" value="${q.id}" ${state.selectedIds.has(q.id) ? 'checked' : ''}
                        onclick="event.stopPropagation(); app.toggleSelect('${q.id}')"
                        style="width:18px; height:18px; cursor:pointer; flex-shrink:0;">
                </div>
                <div class="q-compact-icon" style="color: var(--primary); opacity: 0.8;">${icon}</div>
                <div class="q-compact-main">
                    <div class="q-card-meta-strip">
                        <span class="q-type-badge q-type-${q.type}">${typeLabel}</span>
                        <span class="q-badge q-badge-${q.difficulty}">${diffLabel}</span>
                        <span class="text-muted" style="font-size:0.75rem; font-weight:500; display:flex; align-items:center; gap:4px;">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                            ${sNbName}
                        </span>
                        ${tagsHtml}
                    </div>
                    <div class="q-compact-title" style="font-weight: 600; color: var(--text-title);">${sQuestion}</div>
                    ${q.answer ? `<div class="q-answer-preview">${Helpers.sanitize(q.answer)}</div>` : ''}
                </div>

                <!-- ── Per-card action buttons ── -->
                <div class="q-card-actions" onclick="event.stopPropagation()">
                    <div class="q-action-dropdown">
                        <button class="q-action-btn" title="نسخ" aria-label="نسخ السؤال">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                        </button>
                        <div class="q-action-menu">
                            <button onclick="app.copyQuestion('${q.id}','json')">📋 نسخ كـ JSON</button>
                            <button onclick="app.copyQuestion('${q.id}','text')">📄 نسخ كنص</button>
                        </div>
                    </div>
                    <button class="q-action-btn" title="QR Code" aria-label="توليد QR Code"
                        onclick="app.showQRCode('${q.id}')">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
                    </button>
                    <button class="q-action-btn ${q.isPinned ? 'active' : ''}" title="${q.isPinned ? i18n.t('unpin') : i18n.t('pin')}" 
                        onclick="app.togglePin('${q.id}')" style="${q.isPinned ? 'color:var(--accent); opacity:1;' : ''}">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="${q.isPinned ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                    </button>
                    <button class="q-action-btn q-action-delete" title="حذف" aria-label="حذف السؤال"
                        onclick="app.deleteQuestion('${q.id}')">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                    </button>
                </div>
            </div>
        `;
    },

    /**
     * Updates pagination controls UI.
     * @private
     */
    updatePaginationUI(totalPages) {
        const pageInfo = document.getElementById('page-info');
        if (pageInfo) pageInfo.textContent = i18n.t('page_info', { current: state.virtual.currentPage, total: totalPages });
        
        const btnPrev = document.getElementById('btn-prev-page');
        if (btnPrev) btnPrev.disabled = state.virtual.currentPage === 1;
        
        const btnNext = document.getElementById('btn-next-page');
        if (btnNext) btnNext.disabled = state.virtual.currentPage === totalPages;
    },

    /**
     * Initializes SortableJS on the question list.
     * @param {Function} syncCallback - Callback to sync data after reordering.
     */
    initSortable(syncCallback) {
        const container = document.getElementById('questions-container');
        if (!container || typeof window.Sortable === 'undefined') return;

        if (this.sortableInstance) {
            this.sortableInstance.destroy();
        }

        this.sortableInstance = new window.Sortable(container, {
            handle: '.drag-handle',
            animation: 150,
            ghostClass: 'sortable-ghost',
            dragClass: 'sortable-drag',
            onEnd: async (evt) => {
                const newIndex = evt.newIndex;
                const oldIndex = evt.oldIndex;
                if (newIndex === oldIndex) return;

                const filtered = state.virtual.filteredQuestions;
                const start = (state.virtual.currentPage - 1) * state.virtual.itemsPerPage;
                
                const actualOldIdx = start + oldIndex;
                const actualNewIdx = start + newIndex;

                const [movedItem] = filtered.splice(actualOldIdx, 1);
                filtered.splice(actualNewIdx, 0, movedItem);

                await Helpers.runInChunks(filtered, 50, async (q, i) => {
                    const newNum = i + 1;
                    if (q.qNumber !== newNum) {
                        q.qNumber = newNum;
                        await db.put('questions', q);
                    }
                });

                if (syncCallback) await syncCallback();
            }
        });
    },

    /**
     * Scans all questions for potential duplicates based on text similarity.
     * Uses Helpers.runInChunks for outer loop yielding (every 20 items).
     * @param {number} [threshold=0.8] - Similarity percentage threshold (0.0 to 1.0).
     * @param {Function} [onProgress] - Callback with progress percentage (0-100).
     * @returns {Array} List of duplicate groups with {original, duplicates[{question, similarity}]}.
     */
    async findDuplicates(threshold = 0.8, onProgress = null) {
        const pool = state.questions;
        const results = [];
        const handled = new Set();
        let processed = 0;
        const total = pool.length;

        const poolData = pool.map(q => {
            const text = (q.question || "").trim().toLowerCase();
            return {
                id: q.id,
                text: text,
                len: text.length,
                words: new Set(text.split(/\s+/).filter(w => w.length > 2))
            };
        });

        await Helpers.runInChunks(pool, 25, async (itemI, idxI) => {
            processed++;
            if (onProgress && processed % 10 === 0) {
                onProgress(Math.round((processed / total) * 100));
            }

            if (handled.has(itemI.id)) return;
            
            const dataI = poolData[idxI];
            const group = { original: itemI, duplicates: [] };

            for (let j = idxI + 1; j < pool.length; j++) {
                const itemJ = pool[j];
                if (handled.has(itemJ.id)) continue;

                const dataJ = poolData[j];
                
                // 1. Fast Length Heuristic: If lengths are wildly different, they can't be duplicates
                const maxLen = Math.max(dataI.len, dataJ.len);
                const minLen = Math.min(dataI.len, dataJ.len);
                if (maxLen > 0 && (minLen / maxLen) < (threshold - 0.1)) continue;

                // 2. Word Intersection Heuristic
                const setI = dataI.words;
                const setJ = dataJ.words;
                if (setI.size > 0 && setJ.size > 0) {
                    let intersection = 0;
                    for (let w of setI) if (setJ.has(w)) intersection++;
                    if (intersection / Math.min(setI.size, setJ.size) < (threshold - 0.15)) continue;
                }

                // 3. Exact match
                if (dataI.text === dataJ.text) {
                    group.duplicates.push({ question: itemJ, similarity: 100 });
                    handled.add(itemJ.id);
                    continue;
                }

                // 4. Heavy calculation (Levenshtein)
                const similarity = Helpers.calculateSimilarity(dataI.text, dataJ.text);
                if (similarity >= threshold) {
                    group.duplicates.push({ 
                        question: itemJ, 
                        similarity: Math.round(similarity * 100) 
                    });
                    handled.add(itemJ.id);
                }
            }

            if (group.duplicates.length > 0) {
                results.push(group);
            }
        });
        
        if (onProgress) onProgress(100);
        return results;
    },

    /**
     * Merges a duplicate question into an original one.
     * @param {string} originalId 
     * @param {string} duplicateId 
     */
    async mergeQuestions(originalId, duplicateId) {
        const original = state.questions.find(q => q.id === originalId);
        const duplicate = state.questions.find(q => q.id === duplicateId);
        
        if (!original || !duplicate) return false;

        // 1. Data Integration: Transfer Tags
        const mergedTags = new Set([...(original.tags || []), ...(duplicate.tags || [])]);
        original.tags = Array.from(mergedTags).filter(Boolean);

        // 2. Data Integration: Transfer Category if original is "General" or empty
        const isGeneral = original.category === i18n.t('general') || !original.category;
        if (isGeneral && duplicate.category && duplicate.category !== i18n.t('general')) {
            original.category = duplicate.category;
        }

        // 3. Persist original
        await db.put('questions', original);

        // 4. Wipe duplicate from DB
        await db.delete('questions', duplicateId);

        // 5. Update State
        state.questions = state.questions.filter(q => q.id !== duplicateId);
        
        return true;
    }
};
