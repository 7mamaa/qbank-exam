import { db } from '../core/db.js?v=16.6.1';
import { state } from '../core/state.js?v=16.6.1';
import { Helpers } from '../utils/helpers.js?v=16.6.1';
import { i18n } from '../core/i18n.js?v=16.6.1';

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
            const targetCountVal = document.getElementById('notebook-target-count').value;
            const targetCount = (targetCountVal && !isNaN(targetCountVal)) ? Math.max(0, parseInt(targetCountVal, 10)) : null;

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
                id: idInput || Helpers.generateId(),
                name: name,
                description: description,
                color: color,
                parentId: parentId,
                targetCount: targetCount,
                createdAt: idInput ? undefined : new Date().toISOString()
            };

            if (idInput) {
                const existing = state.notebooks.find(n => n.id === idInput);
                if (existing) {
                    notebookData.createdAt = existing.createdAt;
                    notebookData.lastReviewed = existing.lastReviewed;
                    if (targetCount === null) {
                        notebookData.targetCount = existing.targetCount;
                    }
                }
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
        document.getElementById('notebook-target-count').value = notebook.targetCount || '';
        
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

    async updateLastReviewed(notebookId) {
        if (!notebookId || notebookId === 'orphaned') return;
        const notebook = state.notebooks.find(n => String(n.id) === String(notebookId));
        if (notebook) {
            notebook.lastReviewed = new Date().toISOString();
            await db.put('notebooks', notebook);
        }
    },

    renderNotebooks() {
        const container = document.getElementById('notebooks-container');
        const emptyState = document.getElementById('notebooks-empty-state');
        if (!container || !emptyState) return;

        if (state.notebooks.length === 0) {
            container.innerHTML = '';
            emptyState.style.display = 'block';
        } else {
            emptyState.style.display = 'none';
            const tree = this.buildNotebookTree();
            
            // Performance Optimization: Pre-calculate counts in a single pass
            const countsMap = {};
            state.questions.forEach(q => {
                if (q.notebookId) countsMap[q.notebookId] = (countsMap[q.notebookId] || 0) + 1;
            });

            container.innerHTML = `<div class="notebook-tree">
                ${this._renderTreeNodes(tree, 0, countsMap)}
            </div>`;
        }
    },

    /**
     * Recursive renderer for tree view.
     * @private
     */
    _renderTreeNodes(nodes, depth = 0, countsMap = {}) {
        return nodes.map(node => {
            const nbQuestionsCount = countsMap[node.id] || 0;
            const childIds = this.getAllDescendantIds(node.id);
            let totalQuestionsIncludingChildren = nbQuestionsCount;
            
            childIds.forEach(cid => {
                totalQuestionsIncludingChildren += (countsMap[cid] || 0);
            });
            
            const sName = Helpers.sanitize(node.name);
            const sDesc = Helpers.sanitize(node.description || '');

            // Calculate difficulty distribution
            const nbQs = state.questions.filter(q => q.notebookId === node.id || childIds.includes(q.notebookId));
            const easyCount = nbQs.filter(q => q.difficulty === 'easy').length;
            const mediumCount = nbQs.filter(q => q.difficulty === 'medium').length;
            const hardCount = nbQs.filter(q => q.difficulty === 'hard').length;
            const totalNbQs = nbQs.length;

            let difficultyChartHtml = '';
            if (totalNbQs > 0) {
                const easyPct = (easyCount / totalNbQs) * 100;
                const mediumPct = (mediumCount / totalNbQs) * 100;
                const hardPct = (hardCount / totalNbQs) * 100;
                
                difficultyChartHtml = `
                    <div class="nb-difficulty-chart" style="margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--border);">
                        <div style="font-size:0.75rem; color:var(--text-secondary); margin-bottom:4px; font-weight:700;">📊 توزيع الصعوبة:</div>
                        <div style="display:flex; height:8px; border-radius:4px; overflow:hidden; border: 1px solid var(--border);">
                            ${easyCount > 0 ? `<div style="width:${easyPct}%; background:#2cb67d;" title="سهل: ${easyCount}"></div>` : ''}
                            ${mediumCount > 0 ? `<div style="width:${mediumPct}%; background:#f4a261;" title="متوسط: ${mediumCount}"></div>` : ''}
                            ${hardCount > 0 ? `<div style="width:${hardPct}%; background:#e63946;" title="صعب: ${hardCount}"></div>` : ''}
                        </div>
                        <div style="display:flex; justify-content:space-between; font-size:0.65rem; color:var(--text-secondary); margin-top:3px;">
                            <span style="color:#2cb67d; font-weight:bold;">🟢 سهل: ${easyCount}</span>
                            <span style="color:#f4a261; font-weight:bold;">🟡 متوسط: ${mediumCount}</span>
                            <span style="color:#e63946; font-weight:bold;">🔴 صعب: ${hardCount}</span>
                        </div>
                    </div>
                `;
            }

            let progressHtml = '';
            if (node.targetCount && node.targetCount > 0) {
                const pct = Math.min(Math.round((totalQuestionsIncludingChildren / node.targetCount) * 100), 100);
                progressHtml = `
                    <div class="nb-progress-container" style="margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--border);">
                        <div style="display:flex; justify-content:space-between; font-size:0.75rem; color:var(--text-secondary); margin-bottom:4px; font-weight:700;">
                            <span>🎯 المستهدف: ${totalQuestionsIncludingChildren}/${node.targetCount}</span>
                            <span>${pct}%</span>
                        </div>
                        <div style="height:6px; background:rgba(0,0,0,0.05); border-radius:3px; overflow:hidden; border: 1px solid var(--border);">
                            <div style="width:${pct}%; background:var(--primary); height:100%; border-radius:3px; transition: width 0.3s ease;"></div>
                        </div>
                    </div>
                `;
            }

            let lastReviewedHtml = '';
            if (node.lastReviewed) {
                const formattedDate = new Date(node.lastReviewed).toLocaleString(state.language === 'ar' ? 'ar-EG' : 'en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });
                lastReviewedHtml = `
                    <div style="font-size:0.7rem; color:var(--text-secondary); margin-top:8px; display:flex; align-items:center; gap:4px; opacity:0.8; padding-top: 8px; border-top: 1px solid var(--border);">
                        <span>📅 آخر مراجعة:</span>
                        <span style="font-weight:700;">${formattedDate}</span>
                    </div>
                `;
            }

            return `
                <div class="tree-node ${depth > 0 ? 'notebook-child' : ''}" data-depth="${depth}">
                    <div class="notebook-card" style="border-top: 5px solid ${node.color || 'var(--primary)'};">
                        <div class="notebook-q-badge" title="إجمالي الأسئلة المباشرة">${nbQuestionsCount}</div>
                        <div class="notebook-header">
                            <div class="notebook-title" onclick="app.viewNotebook('${node.id}')" style="display:flex; align-items:center; gap:8px;">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                                ${sName} 
                                ${totalQuestionsIncludingChildren > nbQuestionsCount ? `<small class="total-count-badge" style="opacity:0.6; font-size:0.7rem;">(Total: ${totalQuestionsIncludingChildren})</small>` : ''}
                            </div>
                            <div class="notebook-actions">
                                <button class="btn-icon" onclick="app.editNotebook('${node.id}')" title="تعديل">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                </button>
                                <button class="btn-icon" onclick="app.deleteNotebook('${node.id}')" title="حذف" style="color:var(--danger-color);">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                                </button>
                            </div>
                        </div>
                        ${sDesc ? `<div class="notebook-desc">${sDesc}</div>` : ''}
                        ${difficultyChartHtml}
                        ${progressHtml}
                        ${lastReviewedHtml}
                    </div>
                    ${node.children && node.children.length > 0 ? this._renderTreeNodes(node.children, depth + 1, countsMap) : ''}
                </div>
            `;
        }).join('');
    }
};
