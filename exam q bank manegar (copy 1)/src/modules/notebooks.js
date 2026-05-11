import { db } from '../core/db.js';
import { state } from '../core/state.js';
import { Helpers } from '../utils/helpers.js';
import { i18n } from '../core/i18n.js';

export const NotebookModule = {
    async loadNotebooks(renderCallback, updateDropdownsCallback) {
        state.notebooks = await db.getAll('notebooks');
        if (updateDropdownsCallback) updateDropdownsCallback();
        if (renderCallback) renderCallback();
    },

    updateNotebookDropdowns(syncCustomDropdown) {
        const qSelect = document.getElementById('question-notebook');
        const fSelect = document.getElementById('filter-notebook');
        const imSelect = document.getElementById('import-notebook');
        const qzSelect = document.getElementById('quiz-notebook');
        const prSelect = document.getElementById('print-notebook');
        const bulkSelect = document.getElementById('bulk-notebook-move');

        if (!state.notebooks) return;

        const options = state.notebooks.map(nb => `<option value="${nb.id}">${Helpers.sanitize(nb.name)}</option>`).join('');
        
        const hasOrphans = state.questions.some(q => !state.notebooks.some(n => n.id === q.notebookId));
        let filterOptions = `<option value="">${i18n.t('all_notebooks')}</option>` + options;
        if (hasOrphans) {
            filterOptions += `<option value="orphaned" style="color:#ff4d4d; font-weight:bold;">${i18n.t('orphaned_qs')}</option>`;
        }

        if (qSelect) qSelect.innerHTML = options;
        if (fSelect) fSelect.innerHTML = filterOptions;
        if (imSelect) imSelect.innerHTML = options;
        if (qzSelect) qzSelect.innerHTML = filterOptions;
        if (prSelect) prSelect.innerHTML = options;
        if (bulkSelect) {
            let bulkOptions = `<option value="">${i18n.t('move_to_notebook')}</option>` + options;
            bulkSelect.innerHTML = bulkOptions;
        }

        if (syncCustomDropdown) {
            ['filter-notebook', 'quiz-notebook', 'import-notebook', 'bulk-notebook-move'].forEach(id => syncCustomDropdown(id));
        }
    },

    async handleNotebookSubmit(e, syncDataCallback, closeModalCallback) {
        e.preventDefault();
        const idInput = document.getElementById('notebook-id').value;
        const name = document.getElementById('notebook-name').value.trim();
        const description = document.getElementById('notebook-desc').value.trim();
        const color = document.getElementById('notebook-color').value;

        const isDuplicate = state.notebooks.some(nb => 
            nb.name.toLowerCase() === name.toLowerCase() && nb.id !== idInput
        );

        if (isDuplicate) {
            alert(i18n.t('err_notebook_exists', { name: name }));
            return;
        }

        const notebookData = {
            id: idInput || Date.now().toString(),
            name: name,
            description: description,
            color: color,
            createdAt: idInput ? undefined : new Date().toISOString()
        };

        if (idInput) {
            const existing = state.notebooks.find(n => n.id === idInput);
            if (existing) notebookData.createdAt = existing.createdAt;
        }

        await db.put('notebooks', notebookData);
        if (syncDataCallback) await syncDataCallback();
        if (closeModalCallback) closeModalCallback('notebook-modal');
    },

    async deleteNotebook(id, syncDataCallback, resetFilterCallback) {
        if (confirm(i18n.t('notebook_delete_confirm'))) {
            const questionsToDelete = state.questions.filter(q => q.notebookId === id);
            
            await Helpers.runInChunks(questionsToDelete, 50, async (q) => {
                await db.delete('questions', q.id);
            });

            await db.delete('notebooks', id);
            
            if (resetFilterCallback) resetFilterCallback(id);
            if (syncDataCallback) await syncDataCallback();
        }
    },

    editNotebook(id, openModalCallback) {
        const notebook = state.notebooks.find(n => n.id === id);
        if (!notebook) return;

        document.getElementById('notebook-id').value = notebook.id;
        document.getElementById('notebook-name').value = notebook.name;
        document.getElementById('notebook-desc').value = notebook.description || '';
        document.getElementById('notebook-color').value = notebook.color || '#4361ee';

        if (openModalCallback) openModalCallback('notebook-modal');
    },

    /**
     * Navigates to questions view filtered by a specific notebook.
     */
    viewNotebook(id, navigateCallback) {
        state.selectionCriteria.notebooks.clear();
        state.selectionCriteria.notebooks.add(id);
        if (navigateCallback) navigateCallback('questions');
    },

    renderNotebooks(editCallback, deleteCallback, viewCallback) {
        const container = document.getElementById('notebooks-container');
        const emptyState = document.getElementById('notebooks-empty-state');
        if (!container || !emptyState) return;

        if (state.notebooks.length === 0) {
            container.innerHTML = '';
            emptyState.style.display = 'block';
        } else {
            emptyState.style.display = 'none';
            container.innerHTML = `<div class="notebooks-grid">
                ${state.notebooks.map(notebook => {
                    const nbQuestions = state.questions.filter(q => q.notebookId === notebook.id);
                    const qCount = nbQuestions.length;
                    
                    const easy = nbQuestions.filter(q => q.difficulty === 'easy').length;
                    const medium = nbQuestions.filter(q => q.difficulty === 'medium').length;
                    const hard = nbQuestions.filter(q => q.difficulty === 'hard').length;

                    const sName = Helpers.sanitize(notebook.name);
                    const sDesc = Helpers.sanitize(notebook.description || i18n.t('no_desc'));

                    return `
                        <div class="notebook-card" style="border-top: 5px solid ${notebook.color || 'var(--primary)'}; display: flex; flex-direction: column; position: relative;">
                            <div class="notebook-q-badge" title="إجمالي الأسئلة">${qCount}</div>
                            
                            <div class="notebook-header" style="margin-bottom: 5px;">
                                <div class="notebook-title" onclick="app.viewNotebook('${notebook.id}')" style="font-size: 1.25rem; font-weight: 800; color: var(--text-title); cursor: pointer; transition: var(--transition);" onmouseover="this.style.color='var(--primary)'" onmouseout="this.style.color='var(--text-title)'">📁 ${sName}</div>
                                <div class="notebook-actions">
                                    <button class="btn-icon" onclick="app.editNotebook('${notebook.id}')" title="تعديل">✏️</button>
                                    <button class="btn-icon" onclick="app.deleteNotebook('${notebook.id}')" title="حذف" style="color:var(--danger-color);">🗑️</button>
                                </div>
                            </div>
                            <div class="notebook-desc" onclick="app.viewNotebook('${notebook.id}')" style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 15px; flex-grow: 1; cursor: pointer;">${sDesc}</div>
                            
                            <div class="notebook-stats-mini" style="display: flex; gap: 8px; margin-top: 10px; border-top: 1px solid var(--border); padding-top: 10px;">
                                <div class="stat-mini-item" title="${i18n.t('difficulty_easy')}" style="background: rgba(44, 182, 125, 0.1); color: #2cb67d;">${easy}</div>
                                <div class="stat-mini-item" title="${i18n.t('difficulty_medium')}" style="background: rgba(244, 162, 97, 0.1); color: #f4a261;">${medium}</div>
                                <div class="stat-mini-item" title="${i18n.t('difficulty_hard')}" style="background: rgba(230, 57, 70, 0.1); color: #e63946;">${hard}</div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>`;
        }
    }
};
