import { DuplicatesLogic } from './duplicates.js?v=16.6.1';
import { i18n } from '../core/i18n.js?v=16.6.1';

/**
 * @file duplicates-ui.js
 * @description UI controller for the Duplicate Manager. Optimized for Cluster handling.
 */

export const DuplicatesUI = {
    _results: [],
    _selectedIndices: new Set(),
    _threshold: 0.9,
    _ignorePrevious: false,
    _permanentlyIgnoredIds: new Set(JSON.parse(localStorage.getItem('qbank_ignored_duplicates') || '[]')),

    /**
     * Initializes and opens the Duplicate Manager modal.
     */
    async init() {
        const modal = document.getElementById('duplicates-modal');
        if (!modal) return;

        modal.classList.add('active');
        this.showSetup();
    },

    /**
     * Displays the pre-scan configuration screen.
     */
    showSetup() {
        const container = document.getElementById('duplicates-results-container');
        const loading = document.getElementById('duplicates-loading');
        const empty = document.getElementById('duplicates-empty');
        
        loading.style.display = 'none';
        empty.style.display = 'none';
        
        container.innerHTML = `
            <div style="max-width: 600px; margin: 40px auto; text-align: center; animation: fadeIn 0.5s ease;">
                <div style="font-size: 4rem; margin-bottom: 20px;">🔍</div>
                <h2 style="color: var(--text-title); margin-bottom: 10px;">${i18n.t('dup_manager_title')}</h2>
                <p style="color: var(--text-secondary); line-height: 1.6; margin-bottom: 30px;">${i18n.t('dup_manager_desc')}</p>
                
                <div style="background: var(--card-bg); border: 1px solid var(--border); padding: 30px; border-radius: var(--radius-lg); text-align: start; box-shadow: var(--shadow-sm);">
                    <div style="margin-bottom: 25px;">
                        <label style="display: block; font-weight: 700; color: var(--text-title); margin-bottom: 15px; display: flex; justify-content: space-between;">
                            <span>${i18n.t('dup_similarity_threshold')}</span>
                            <span id="threshold-val" style="color: var(--primary);">${Math.round(this._threshold * 100)}%</span>
                        </label>
                        <input type="range" min="50" max="100" value="${this._threshold * 100}" 
                            style="width: 100%; margin-bottom: 10px; cursor: pointer;"
                            oninput="DuplicatesUI.updateThreshold(this.value)">
                        <div style="display: flex; justify-content: space-between; font-size: 0.8rem; color: var(--text-secondary);">
                            <span>50% (${i18n.t('dup_broad')})</span>
                            <span>100% (${i18n.t('dup_exact')})</span>
                        </div>
                    </div>

                    <div style="padding-top: 20px; border-top: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between;">
                        <span style="font-weight: 600; color: var(--text-title);">${i18n.t('dup_ignore_previous')}</span>
                        <label class="switch">
                            <input type="checkbox" ${this._ignorePrevious ? 'checked' : ''} onchange="DuplicatesUI._ignorePrevious = this.checked">
                            <span class="slider round"></span>
                        </label>
                    </div>
                </div>
                
                <button class="btn btn-primary" style="margin-top: 40px; padding: 14px 60px; font-size: 1.1rem; border-radius: 30px; box-shadow: 0 10px 20px rgba(37, 99, 235, 0.2);" 
                    onclick="DuplicatesUI.scan()">
                    ${i18n.t('dup_scan_btn')}
                </button>
            </div>
        `;
    },

    updateThreshold(val) {
        this._threshold = val / 100;
        const display = document.getElementById('threshold-val');
        if (display) display.textContent = `${val}%`;
    },

    /**
     * Triggers the scan and renders results.
     */
    async scan() {
        const loading = document.getElementById('duplicates-loading');
        const container = document.getElementById('duplicates-results-container');
        const empty = document.getElementById('duplicates-empty');
        const progressFill = document.getElementById('duplicates-progress-fill');
        const progressText = document.getElementById('duplicates-progress-text');

        container.innerHTML = '';
        empty.style.display = 'none';
        loading.style.display = 'block';
        if (progressFill) progressFill.style.width = '0%';

        try {
            let results = await DuplicatesLogic.findDuplicates(this._threshold, (progress) => {
                if (progressFill) progressFill.style.width = `${progress}%`;
                if (progressText) {
                    const key = progress < 50 ? 'dup_processing_streaming' : 'dup_processing_clustering';
                    progressText.textContent = i18n.t(key);
                }
            });

            // Filter out ignored questions if toggle is on
            if (this._ignorePrevious) {
                results = results.filter(group => {
                    return !group.duplicates.some(dup => this._permanentlyIgnoredIds.has(dup.question.id));
                });
            }

            loading.style.display = 'none';
            this._results = results;
            this._selectedIndices.clear();

            if (results.length === 0) {
                empty.style.display = 'block';
            } else {
                this.renderResults();
            }
        } catch (error) {
            console.error('Scan failed:', error);
            loading.style.display = 'none';
        }
    },

    /**
     * Renders the results with toolbar.
     */
    renderResults() {
        const container = document.getElementById('duplicates-results-container');
        
        container.innerHTML = `
            <div id="dup-toolbar" style="position: sticky; top: -28px; z-index: 100; background: var(--bg-main); padding: 15px 0; border-bottom: 1px solid var(--border); margin-bottom: 25px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 15px;">
                <div style="display: flex; align-items: center; gap: 15px;">
                    <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-weight: 600;">
                        <input type="checkbox" id="select-all-groups" onchange="DuplicatesUI.toggleSelectAll(this.checked)">
                        ${i18n.t('select_all')}
                    </label>
                    <span id="selected-count" style="font-weight: 700; color: var(--primary); font-size: 0.9rem;">0 ${i18n.t('selected')}</span>
                </div>
                
                <div style="display: flex; align-items: center; gap: 10px;">
                    <select class="theme-select" style="padding: 6px 12px; font-size: 0.85rem;" onchange="DuplicatesUI.sortResults(this.value)">
                        <option value="sim_desc">${i18n.t('sort_sim_desc')}</option>
                        <option value="sim_asc">${i18n.t('sort_sim_asc')}</option>
                        <option value="size_desc">${i18n.t('sort_size_desc')}</option>
                        <option value="size_asc">${i18n.t('sort_size_asc')}</option>
                    </select>
                    
                    <div style="display: flex; gap: 8px;">
                        <button id="bulk-ignore" class="btn btn-secondary btn-sm" disabled onclick="DuplicatesUI.bulkIgnore()">${i18n.t('dup_ignore_btn')}</button>
                        <button id="bulk-delete" class="btn btn-danger btn-sm" disabled onclick="DuplicatesUI.bulkDelete()">${i18n.t('delete_btn')}</button>
                        <button id="bulk-merge" class="btn btn-primary btn-sm" disabled onclick="DuplicatesUI.bulkMerge()">${i18n.t('dup_merge_btn')}</button>
                    </div>
                </div>
            </div>
            <div id="bulk-progress" style="display:none; background: var(--card-bg); border: 1px solid var(--border); padding: 15px; border-radius: 8px; margin-bottom: 20px; text-align: center;">
                <div style="font-weight: 600; margin-bottom: 8px;" id="bulk-progress-text"></div>
                <div style="width:100%; height:6px; background:#ddd; border-radius:3px; overflow:hidden;">
                    <div id="bulk-progress-fill" style="width:0%; height:100%; background:var(--primary); transition: width 0.2s;"></div>
                </div>
            </div>
            <div id="groups-list"></div>
        `;

        this.renderGroups();
    },

    renderGroups() {
        const listContainer = document.getElementById('groups-list');
        listContainer.innerHTML = '';

        this._results.forEach((group, index) => {
            const isSelected = this._selectedIndices.has(index);
            const groupEl = document.createElement('div');
            groupEl.className = 'duplicate-group-card';
            groupEl.dataset.index = index;
            groupEl.style = `
                background: var(--card-bg);
                border: 1px solid ${isSelected ? 'var(--primary)' : 'var(--border)'};
                border-radius: var(--radius-lg);
                margin-bottom: 25px;
                overflow: hidden;
                box-shadow: ${isSelected ? '0 0 0 2px rgba(37, 99, 235, 0.1), var(--shadow-md)' : 'var(--shadow-sm)'};
                transition: all 0.2s ease;
            `;

            groupEl.innerHTML = `
                <div style="background: ${isSelected ? 'rgba(37, 99, 235, 0.05)' : 'rgba(0,0,0,0.02)'}; padding: 12px 24px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center;">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <input type="checkbox" ${isSelected ? 'checked' : ''} onchange="DuplicatesUI.toggleGroupSelection(${index}, this.checked)">
                        <span style="font-weight: 800; color: var(--text-secondary); font-size: 0.85rem;">${i18n.t('dup_group')} #${index + 1} (${group.duplicates.length + 1} ${i18n.t('questions')})</span>
                    </div>
                    <span class="badge" style="background: var(--primary); color: white; padding: 4px 12px; border-radius: 20px; font-weight: 700; font-size: 0.8rem;">
                        ${i18n.t('dup_similarity')}: ${group.duplicates[0].similarity}%
                    </span>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0;">
                    <div style="border-inline-end: 1px solid var(--border); padding: 20px;">
                        <div style="font-size: 0.7rem; text-transform: uppercase; color: var(--primary); font-weight: 800; margin-bottom: 10px;">${i18n.t('dup_keep_original')}</div>
                        <div style="font-size: 1rem; line-height: 1.6; color: var(--text-title); font-weight: 500;">${group.original.question}</div>
                    </div>
                    <div style="padding: 20px; background: rgba(239, 68, 68, 0.01);">
                        <div style="font-size: 0.7rem; text-transform: uppercase; color: var(--danger-color); font-weight: 800; margin-bottom: 10px;">${i18n.t('dup_delete_duplicate')}</div>
                        <div style="display: flex; flex-direction: column; gap: 12px;">
                            ${group.duplicates.map(dup => `
                                <div style="font-size: 0.95rem; line-height: 1.5; color: var(--text-title); opacity: 0.8; padding-bottom: 8px; border-bottom: 1px dashed var(--border);">
                                    <div style="font-size: 0.7rem; color: var(--danger-color); margin-bottom: 4px;">${i18n.t('dup_similarity')}: ${dup.similarity}%</div>
                                    ${dup.question.question}
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
                <div style="background: var(--bg-main); padding: 12px 24px; display: flex; gap: 10px; justify-content: flex-end; border-top: 1px solid var(--border);">
                    <button class="btn btn-secondary btn-sm" onclick="DuplicatesUI.ignoreGroup(${index}, this, true)">${i18n.t('dup_ignore_btn')}</button>
                    <button class="btn btn-danger btn-sm" onclick="DuplicatesUI.deleteGroup(${index}, this)">${i18n.t('delete_btn')}</button>
                    <button class="btn btn-primary btn-sm" onclick="DuplicatesUI.mergeGroup(${index}, this)">${i18n.t('dup_merge_btn')}</button>
                </div>
            `;
            listContainer.appendChild(groupEl);
        });
    },

    toggleGroupSelection(index, checked) {
        if (checked) this._selectedIndices.add(index);
        else this._selectedIndices.delete(index);
        this.updateToolbar();
    },

    toggleSelectAll(checked) {
        if (checked) this._results.forEach((_, i) => this._selectedIndices.add(i));
        else this._selectedIndices.clear();
        this.renderGroups();
        this.updateToolbar();
    },

    updateToolbar() {
        const count = this._selectedIndices.size;
        const selCountEl = document.getElementById('selected-count');
        if (selCountEl) selCountEl.textContent = `${count} ${i18n.t('selected')}`;
        ['bulk-ignore', 'bulk-delete', 'bulk-merge'].forEach(id => {
            const btn = document.getElementById(id);
            if (btn) btn.disabled = count === 0;
        });
    },

    sortResults(criteria) {
        switch(criteria) {
            case 'sim_desc': this._results.sort((a, b) => b.duplicates[0].similarity - a.duplicates[0].similarity); break;
            case 'sim_asc': this._results.sort((a, b) => a.duplicates[0].similarity - b.duplicates[0].similarity); break;
            case 'size_desc': this._results.sort((a, b) => b.duplicates.length - a.duplicates.length); break;
            case 'size_asc': this._results.sort((a, b) => a.duplicates.length - b.duplicates.length); break;
        }
        this._selectedIndices.clear();
        this.renderGroups();
        this.updateToolbar();
    },

    /**
     * Bulk Operations (Sequential to prevent race conditions)
     */
    async bulkIgnore() {
        const indices = Array.from(this._selectedIndices).sort((a, b) => b - a);
        indices.forEach(idx => {
            const group = this._results[idx];
            group.duplicates.forEach(dup => this._permanentlyIgnoredIds.add(dup.question.id));
            this._results.splice(idx, 1);
        });
        localStorage.setItem('qbank_ignored_duplicates', JSON.stringify(Array.from(this._permanentlyIgnoredIds)));
        this._selectedIndices.clear();
        this.renderResults();
    },

    async bulkDelete() {
        if (!confirm(i18n.t('q_delete_confirm'))) return;
        const indices = Array.from(this._selectedIndices).sort((a, b) => b - a);
        const total = indices.length;
        let count = 0;

        this.updateBulkProgress(0, total);
        
        for (const idx of indices) {
            const group = this._results[idx];
            for (const dup of group.duplicates) {
                await DuplicatesLogic.delete(dup.question.id);
            }
            this._results.splice(idx, 1);
            count++;
            this.updateBulkProgress(count, total);
        }
        
        setTimeout(() => this.scan(), 800);
        if (window.app?.renderQuestions) window.app.renderQuestions();
    },

    async bulkMerge() {
        const indices = Array.from(this._selectedIndices).sort((a, b) => b - a);
        const total = indices.length;
        let count = 0;

        this.updateBulkProgress(0, total);
        
        for (const idx of indices) {
            const group = this._results[idx];
            for (const dup of group.duplicates) {
                await DuplicatesLogic.merge(group.original.id, dup.question.id);
            }
            this._results.splice(idx, 1);
            count++;
            this.updateBulkProgress(count, total);
        }
        
        setTimeout(() => this.scan(), 800);
        if (window.app?.renderQuestions) window.app.renderQuestions();
    },

    updateBulkProgress(current, total) {
        const container = document.getElementById('bulk-progress');
        const text = document.getElementById('bulk-progress-text');
        const fill = document.getElementById('bulk-progress-fill');
        
        if (!container) return;

        if (current === total && total > 0) {
            text.textContent = i18n.t('dup_done_refresh');
            setTimeout(() => container.style.display = 'none', 1000);
            return;
        }

        container.style.display = 'block';
        text.textContent = i18n.t('dup_bulk_progress', { current, total });
        fill.style.width = `${(current / total) * 100}%`;
    },

    /**
     * Single Cluster Actions
     */
    ignoreGroup(index, btn, permanently = false) {
        const group = this._results[index];
        if (permanently) {
            group.duplicates.forEach(dup => this._permanentlyIgnoredIds.add(dup.question.id));
            localStorage.setItem('qbank_ignored_duplicates', JSON.stringify(Array.from(this._permanentlyIgnoredIds)));
        }

        const card = btn.closest('.duplicate-group-card');
        card.style.opacity = '0';
        card.style.transform = 'translateY(10px)';
        setTimeout(() => {
            this._results.splice(index, 1);
            this._selectedIndices.delete(index);
            this.renderGroups();
            this.updateToolbar();
        }, 300);
    },

    async deleteGroup(index, btn) {
        if (!confirm(i18n.t('q_delete_confirm'))) return;
        const group = this._results[index];
        for (const dup of group.duplicates) {
            await DuplicatesLogic.delete(dup.question.id);
        }
        this.ignoreGroup(index, btn);
        if (window.app?.renderQuestions) window.app.renderQuestions();
        setTimeout(() => this.scan(), 1000);
    },

    async mergeGroup(index, btn) {
        const group = this._results[index];
        for (const dup of group.duplicates) {
            await DuplicatesLogic.merge(group.original.id, dup.question.id);
        }
        this.ignoreGroup(index, btn);
        if (window.app?.renderQuestions) window.app.renderQuestions();
        setTimeout(() => this.scan(), 1000);
    }
};

export default DuplicatesUI;
