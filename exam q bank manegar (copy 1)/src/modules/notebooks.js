import { db } from '../core/db.js';
import { state } from '../core/state.js';
import { Helpers } from '../utils/helpers.js';
import { i18n } from '../core/i18n.js';

export const NotebookModule = {
    async loadNotebooks(renderCallback, updateDropdownsCallback) {
        try {
            state.notebooks = await db.getAll('notebooks');
            // Ensure parentId exists for all (migration)
            state.notebooks.forEach(nb => {
                if (nb.parentId === undefined) nb.parentId = null;
            });
            if (updateDropdownsCallback) updateDropdownsCallback();
            if (renderCallback) renderCallback();
        } catch (err) {
            console.error('[NotebookModule] Load Error:', err);
        }
    },

    /**
     * Builds a tree structure from flat notebook list.
     * @returns {Array} Array of root nodes with children.
     */
    buildNotebookTree() {
        const map = {};
        const roots = [];
        
        state.notebooks.forEach(nb => {
            map[nb.id] = { ...nb, children: [] };
        });

        state.notebooks.forEach(nb => {
            if (nb.parentId && map[nb.parentId]) {
                map[nb.parentId].children.push(map[nb.id]);
            } else {
                roots.push(map[nb.id]);
            }
        });

        return roots;
    },

    /**
     * Gets the full path string for a notebook (e.g. "Root > Sub > Child")
     */
    getNotebookFullPath(id, notebooks = state.notebooks) {
        const nb = notebooks.find(n => n.id === id);
        if (!nb) return '';
        if (!nb.parentId) return nb.name;
        
        const path = [];
        let current = nb;
        while (current) {
            path.unshift(current.name);
            current = notebooks.find(n => n.id === current.parentId);
            // Safety break for cycles (though logic should prevent them)
            if (path.length > 20) break;
        }
        return path.join(' > ');
    },

    /**
     * Recursively gets all descendant IDs of a notebook.
     */
    getAllDescendantIds(parentId, notebooks = state.notebooks) {
        const ids = [];
        const children = notebooks.filter(nb => nb.parentId === parentId);
        children.forEach(child => {
            ids.push(child.id);
            ids.push(...this.getAllDescendantIds(child.id, notebooks));
        });
        return ids;
    },

    /**
     * Checks if a new parent would cause a circular dependency.
     */
    isCircularDependency(nbId, newParentId) {
        if (!newParentId) return false;
        if (nbId === newParentId) return true;
        
        const descendants = this.getAllDescendantIds(nbId);
        return descendants.includes(newParentId);
    },

    updateNotebookDropdowns(syncCustomDropdown) {
        const selects = [
            'question-notebook', 'filter-notebook', 'import-notebook', 
            'quiz-notebook', 'print-notebook', 'bulk-notebook-move', 'notebook-parent'
        ];
        
        const notebookMap = {};
        state.notebooks.forEach(nb => notebookMap[nb.id] = nb);

        // Prepare options with paths
        const optionsWithPaths = state.notebooks.map(nb => ({
            id: nb.id,
            path: this.getNotebookFullPath(nb.id, state.notebooks)
        })).sort((a, b) => a.path.localeCompare(b.path));

        const optionsHtml = optionsWithPaths.map(opt => 
            `<option value="${opt.id}">${Helpers.sanitize(opt.path)}</option>`
        ).join('');

        const hasOrphans = state.questions.some(q => !state.notebooks.some(n => n.id === q.notebookId));
        
        selects.forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;

            if (id === 'notebook-parent') {
                const currentEditId = document.getElementById('notebook-id').value;
                const filteredOptions = optionsWithPaths.filter(opt => opt.id !== currentEditId);
                el.innerHTML = `<option value="">${i18n.t('root_notebook')}</option>` + 
                    filteredOptions.map(opt => `<option value="${opt.id}">${Helpers.sanitize(opt.path)}</option>`).join('');
            } else if (id === 'filter-notebook' || id === 'quiz-notebook') {
                let filterOptions = `<option value="">${i18n.t('all_notebooks')}</option>` + optionsHtml;
                if (hasOrphans) {
                    filterOptions += `<option value="orphaned" style="color:#ff4d4d; font-weight:bold;">${i18n.t('orphaned_qs')}</option>`;
                }
                el.innerHTML = filterOptions;
            } else if (id === 'bulk-notebook-move') {
                el.innerHTML = `<option value="">${i18n.t('move_to_notebook')}</option>` + optionsHtml;
            } else {
                el.innerHTML = optionsHtml;
            }
        });

        if (syncCustomDropdown) {
            ['filter-notebook', 'quiz-notebook', 'import-notebook', 'bulk-notebook-move', 'notebook-parent'].forEach(id => syncCustomDropdown(id));
        }
    },

    async handleNotebookSubmit(e, syncDataCallback, closeModalCallback) {
        e.preventDefault();
        try {
            const idInput = document.getElementById('notebook-id').value;
            const name = document.getElementById('notebook-name').value.trim();
            const description = document.getElementById('notebook-desc').value.trim();
            const color = document.getElementById('notebook-color').value;
            const parentId = document.getElementById('notebook-parent').value || null;

            if (idInput && this.isCircularDependency(idInput, parentId)) {
                alert(i18n.t('err_circular_dependency'));
                return;
            }

            const isDuplicate = state.notebooks.some(nb => 
                nb.name.toLowerCase() === name.toLowerCase() && nb.id !== idInput && nb.parentId === parentId
            );

            if (isDuplicate) {
                alert(i18n.t('err_notebook_exists', { name: name }));
                return;
            }

            const notebookData = {
                id: idInput || Date.now().toString() + Math.random().toString(36).substr(2, 5),
                name: name,
                description: description,
                color: color,
                parentId: parentId,
                createdAt: idInput ? undefined : new Date().toISOString()
            };

            if (idInput) {
                const existing = state.notebooks.find(n => n.id === idInput);
                if (existing) notebookData.createdAt = existing.createdAt;
            }

            await db.put('notebooks', notebookData);
            if (syncDataCallback) await syncDataCallback();
            if (closeModalCallback) closeModalCallback('notebook-modal');
        } catch (err) {
            console.error('[NotebookModule] Submit Error:', err);
        }
    },

    async deleteNotebook(id, syncDataCallback, resetFilterCallback) {
        if (confirm(i18n.t('notebook_delete_confirm'))) {
            try {
                // Move children to root to prevent loss
                const children = state.notebooks.filter(nb => nb.parentId === id);
                for (const child of children) {
                    child.parentId = null;
                    await db.put('notebooks', child);
                }

                const questionsToDelete = state.questions.filter(q => q.notebookId === id);
                await Helpers.runInChunks(questionsToDelete, 50, async (q) => {
                    await db.delete('questions', q.id);
                });

                await db.delete('notebooks', id);
                
                if (resetFilterCallback) resetFilterCallback(id);
                if (syncDataCallback) await syncDataCallback();
            } catch (err) {
                console.error('[NotebookModule] Delete Error:', err);
            }
        }
    },

    editNotebook(id, openModalCallback, syncDropdownsCallback) {
        const notebook = state.notebooks.find(n => n.id === id);
        if (!notebook) return;

        document.getElementById('notebook-id').value = notebook.id;
        document.getElementById('notebook-name').value = notebook.name;
        document.getElementById('notebook-desc').value = notebook.description || '';
        document.getElementById('notebook-color').value = notebook.color || '#4361ee';
        
        // Populate parent dropdown first to ensure current nb is excluded
        if (syncDropdownsCallback) syncDropdownsCallback();
        document.getElementById('notebook-parent').value = notebook.parentId || '';

        if (openModalCallback) openModalCallback('notebook-modal');
    },

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
            const tree = this.buildNotebookTree();
            
            container.innerHTML = `<div class="notebook-tree">
                ${this._renderTreeNodes(tree)}
            </div>`;
        }
    },

    /**
     * Recursive renderer for tree view.
     * @private
     */
    _renderTreeNodes(nodes, depth = 0) {
        return nodes.map(node => {
            const nbQuestions = state.questions.filter(q => q.notebookId === node.id);
            const childIds = this.getAllDescendantIds(node.id);
            const totalQuestionsIncludingChildren = nbQuestions.length + state.questions.filter(q => childIds.includes(q.notebookId)).length;
            
            const sName = Helpers.sanitize(node.name);
            const sDesc = Helpers.sanitize(node.description || '');

            return `
                <div class="tree-node ${depth > 0 ? 'notebook-child' : ''}" data-depth="${depth}">
                    <div class="notebook-card" style="border-top: 5px solid ${node.color || 'var(--primary)'};">
                        <div class="notebook-q-badge" title="إجمالي الأسئلة المباشرة">${nbQuestions.length}</div>
                        <div class="notebook-header">
                            <div class="notebook-title" onclick="app.viewNotebook('${node.id}')">
                                📁 ${sName} 
                                ${totalQuestionsIncludingChildren > nbQuestions.length ? `<small class="total-count-badge">(Total: ${totalQuestionsIncludingChildren})</small>` : ''}
                            </div>
                            <div class="notebook-actions">
                                <button class="btn-icon" onclick="app.editNotebook('${node.id}')" title="تعديل">✏️</button>
                                <button class="btn-icon" onclick="app.deleteNotebook('${node.id}')" title="حذف" style="color:var(--danger-color);">🗑️</button>
                            </div>
                        </div>
                        ${sDesc ? `<div class="notebook-desc">${sDesc}</div>` : ''}
                    </div>
                    ${node.children && node.children.length > 0 ? this._renderTreeNodes(node.children, depth + 1) : ''}
                </div>
            `;
        }).join('');
    }
};
