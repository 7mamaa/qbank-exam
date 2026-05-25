import { i18n } from '../core/i18n.js?v=16.6.1';
import { Helpers } from '../utils/helpers.js?v=16.6.1';
import { app } from '../../app.js?v=16.6.1';

/**
 * @module UIComponents
 * @description Shared UI components and logic for custom dropdowns and notifications.
 */
export const UIComponents = {
    /**
     * Initializes all custom V8 dropdowns in the application.
     */
    initCustomDropdowns() {
        const selects = [
            'filter-notebook', 'filter-category', 'filter-tag', 'filter-type', 'filter-difficulty', 
            'export-sort-order', 'pdf-direction', 'pdf-layout',
            'quiz-notebook', 'import-notebook', 'bulk-notebook-move', 'notebook-parent',
            'question-type', 'theme-selector'
        ];
        selects.forEach(id => {
            const selectEl = document.getElementById(id);
            if (!selectEl || document.getElementById(`v8-dd-${id}`)) return;

            const wrapper = document.createElement('div');
            wrapper.className = 'v8-dropdown';
            wrapper.id = `v8-dd-${id}`;
            wrapper.tabIndex = 1;
            
            const span = document.createElement('span');
            span.textContent = selectEl.options[selectEl.selectedIndex]?.text || i18n.t('select_dot');
            
            const ul = document.createElement('ul');
            ul.className = `dropdown-menu dd-type-${id}`;

            wrapper.appendChild(span);
            wrapper.appendChild(ul);

            selectEl.parentNode.insertBefore(wrapper, selectEl.nextSibling);
            selectEl.classList.add('hidden-select');

            wrapper.addEventListener('click', (e) => {
                const isActive = wrapper.classList.contains('active');
                document.querySelectorAll('.v8-dropdown').forEach(d => d.classList.remove('active'));
                if (!isActive) wrapper.classList.add('active');
                e.stopPropagation();
            });

            this.syncCustomDropdown(id);
        });

        // Close dropdowns on outside click
        document.addEventListener('click', () => {
            document.querySelectorAll('.v8-dropdown').forEach(d => d.classList.remove('active'));
        });

        // Setup listener for language changes to sync dropdown text
        if (!this._i18nListenerAdded) {
            document.addEventListener('languageChanged', () => {
                selects.forEach(id => this.syncCustomDropdown(id));
            });
            this._i18nListenerAdded = true;
        }
    },


    /**
     * Synchronizes a custom dropdown UI with its underlying native select element.
     * @param {string} selectId - ID of the original select element.
     */
    syncCustomDropdown(selectId) {
        const selectEl = document.getElementById(selectId);
        const wrapper = document.getElementById(`v8-dd-${selectId}`);
        if (!selectEl || !wrapper) return;

        const ul = wrapper.querySelector('.dropdown-menu');
        const span = wrapper.querySelector('span');
        
        ul.innerHTML = '';
        Array.from(selectEl.options).forEach(opt => {
            const li = document.createElement('li');
            li.textContent = opt.text;
            li.dataset.value = opt.value;
            li.addEventListener('click', (e) => {
                selectEl.value = opt.value;
                span.textContent = opt.text;
                selectEl.dispatchEvent(new Event('change'));
                wrapper.classList.remove('active');
                e.stopPropagation();
            });
            ul.appendChild(li);
        });
        
        span.textContent = selectEl.options[selectEl.selectedIndex]?.text || i18n.t('select_dot');
    },


    /**
     * Opens a modal by ID.
     * @param {string} id 
     * @param {Function} [playSoundCallback] 
     */
    openModal(id, playSoundCallback) {
        const modal = document.getElementById(id);
        if (modal) {
            modal.classList.add('active');
            if (playSoundCallback) playSoundCallback('modal');
        }
    },

    /**
     * Closes a modal by ID.
     * @param {string} id 
     * @param {Function} [playSoundCallback] 
     */
    closeModal(id, playSoundCallback) {
        const modal = document.getElementById(id);
        if (modal) {
            modal.classList.remove('active');
            if (playSoundCallback) playSoundCallback('nav');
        }
    },

    /**
     * Updates the dashboard statistics.
     * @param {Object} stats 
     */
    updateDashboard(stats) {
        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.textContent = val;
        };

        setVal('stat-total-questions', stats.totalQs);
        setVal('stat-total-notebooks', stats.totalNbs);
        setVal('stat-total-categories', stats.totalCategories);
        setVal('stat-pinned-questions', stats.pinnedQs);
    },

    /**
     * Renders the activity chart on the dashboard.
     * @param {Array} typeCounts - Array of objects with label and count.
     */
    renderActivityChart(typeCounts) {
        this._renderBarChart('chart-types', typeCounts, null);
    },

    renderDifficultyChart(difficultyCounts) {
        const colors = {
            [i18n.t('difficulty_easy')]:   '#2cb67d',
            [i18n.t('difficulty_medium')]: '#f4a261',
            [i18n.t('difficulty_hard')]:   '#e63946'
        };
        this._renderBarChart('chart-difficulty', difficultyCounts, colors);
    },

    /**
     * Shared animated bar chart renderer.
     * Bars grow from 0→target height via CSS transition for a premium feel.
     * Hover reveals a tooltip with the exact count.
     * @private
     */
    _renderBarChart(containerId, data, colorMap) {
        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = '';
        if (!data.length || data.every(d => d.count === 0)) {
            container.innerHTML = `
                <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding:40px 20px; opacity:0.15;">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom:12px;"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"></path><path d="M22 12A10 10 0 0 0 12 2v10z"></path></svg>
                    <p style="font-weight:600; font-size:0.85rem;">${i18n.t('no_data_yet')}</p>
                </div>
            `;
            return;
        }

        const max = Math.max(...data.map(d => d.count)) || 1;
        const wrapper = document.createElement('div');
        wrapper.className = 'activity-chart-wrapper';

        const bars = [];
        data.forEach(item => {
            const targetPct = (item.count / max) * 100;
            const color = colorMap ? (colorMap[item.label] || 'var(--primary)') : 'var(--primary)';

            const bar = document.createElement('div');
            bar.className = 'chart-bar';
            bar.style.cssText = `background: ${color};`;
            bar.innerHTML = `
                <span class="chart-bar-count">${item.count}</span>
                <span class="chart-bar-tooltip">${Helpers.sanitize(item.label)}: ${item.count}</span>
                <span class="chart-bar-label">${Helpers.sanitize(item.label)}</span>
            `;
            wrapper.appendChild(bar);
            bars.push({ el: bar, targetPct });
        });

        container.appendChild(wrapper);

        // Defer height assignment by one frame so CSS transition fires (0 → target)
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                bars.forEach(({ el, targetPct }) => {
                    el.style.setProperty('height', `${targetPct}%`, 'important');
                });
            });
        });
    },


    /**
     * Displays a modern toast notification.
     * @param {string} message - The message to show.
     * @param {'info'|'success'|'warning'|'error'} [type='info'] - Type of notification.
     */
    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container') || this.createToastContainer();
        
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        const icon = {
            info: 'ℹ️',
            success: '✅',
            warning: '⚠️',
            error: '❌'
        }[type];

        // Duration scales with severity so errors stay visible long enough to read
        const duration = { error: 8000, warning: 6000, success: 3500, info: 3500 }[type] ?? 3500;

        toast.innerHTML = `<span class="toast-icon">${icon}</span><span class="toast-message"></span>`;
        toast.querySelector('.toast-message').textContent = message;

        container.appendChild(toast);

        // Animation in
        setTimeout(() => toast.classList.add('visible'), 10);

        // Remove after type-appropriate delay
        setTimeout(() => {
            toast.classList.remove('visible');
            setTimeout(() => toast.remove(), 300);
        }, duration);
    },

    /**
     * Creates the container for toast notifications if it doesn't exist.
     * @private
     * @returns {HTMLElement}
     */
    createToastContainer() {
        const container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
        return container;
    },

    /**
     * Renders the Duplicate Manager v2 results.
     * @param {Array} groups - Duplicate groups from findDuplicates.
     * @param {number} totalScanned - Total questions scanned.
     */
    renderDuplicateManager(groups, totalScanned = 0) {
        const container = document.getElementById('duplicate-manager-list');
        const summaryEl = document.getElementById('dup-summary');
        const batchEl = document.getElementById('dup-batch-actions');
        if (!container) return;

        let totalPairs = 0;
        groups.forEach(g => totalPairs += g.duplicates.length);

        if (summaryEl) {
            summaryEl.style.display = 'flex';
            if (totalPairs === 0) {
                summaryEl.innerHTML = `<span class="dup-stat">${i18n.t('dup_stats_summary', { total: totalScanned })}</span>`;
            } else {
                summaryEl.innerHTML = `<span class="dup-stat">${i18n.t('dup_stats_groups', { count: groups.length })}</span><span class="dup-stat">${i18n.t('dup_stats_pairs', { count: totalPairs })}</span>`;
            }
        }

        if (batchEl) batchEl.style.display = totalPairs > 0 ? 'flex' : 'none';

        if (totalPairs === 0) {
            container.innerHTML = `<div class="dup-empty-state">${i18n.t('dup_clean_msg')}</div>`;
            return;
        }

        const cards = [];
        let pairIndex = 0;

        groups.forEach(group => {
            group.duplicates.forEach(dup => {
                pairIndex++;
                const sim = dup.similarity;
                const org = group.original;
                const dq = dup.question;

                cards.push(`
                <div class="dup-card" data-org-id="${org.id}" data-dup-id="${dq.id}">
                    <div class="dup-card-header">
                        <span class="dup-pair-label">${i18n.t('dup_pair_num', { index: pairIndex })}</span>
                        <span class="dup-sim-badge">${sim}% ${i18n.t('dup_similarity')}</span>
                    </div>
                    
                    <div class="dup-compare-stack">
                        <!-- Original -->
                        <div class="dup-side-box original">
                            <div class="dup-side-tag is-original">
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4"><path d="M20 6L9 17l-5-5"></path></svg>
                                ${i18n.t('dup_keep_original')}
                            </div>
                            <div class="dup-q-text">${Helpers.sanitize(org.question)}</div>
                            <div class="dup-q-meta">
                                <span>📁 ${Helpers.sanitize(org.category || i18n.t('q_no_cat'))}</span>
                                <span>📓 ${Helpers.sanitize(org.notebookName || '')}</span>
                            </div>
                        </div>

                        <div class="dup-vs-divider"></div>

                        <!-- Duplicate -->
                        <div class="dup-side-box duplicate">
                            <div class="dup-side-tag is-duplicate">
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                                ${i18n.t('dup_delete_duplicate')}
                            </div>
                            <div class="dup-q-text">${Helpers.sanitize(dq.question)}</div>
                            <div class="dup-q-meta">
                                <span>📁 ${Helpers.sanitize(dq.category || i18n.t('q_no_cat'))}</span>
                                <span>📓 ${Helpers.sanitize(dq.notebookName || '')}</span>
                            </div>
                        </div>
                    </div>

                    <div class="dup-card-footer">
                        <div class="dup-card-actions">
                            <button class="btn btn-sm dup-action-merge" data-org="${org.id}" data-dup="${dq.id}" style="background:var(--primary); color:#000; border:none;">${i18n.t('dup_merge_btn')}</button>
                            <button class="btn btn-sm dup-action-edit" data-id="${dq.id}" style="background:var(--accent); color:white; border:none;">${i18n.t('dup_edit_duplicate')}</button>
                            <button class="btn btn-sm dup-action-dismiss" style="background:transparent; border:1px solid var(--border); color:var(--text-secondary);">${i18n.t('dup_ignore_btn')}</button>
                        </div>
                    </div>
                </div>`);
            });
        });

        container.innerHTML = cards.join('');

        // Re-attach Event Delegation
        container.onclick = (e) => {
            const mergeBtn = e.target.closest('.dup-action-merge');
            if (mergeBtn) {
                app.executeMerge(mergeBtn.dataset.org, mergeBtn.dataset.dup);
                return;
            }
            const editBtn = e.target.closest('.dup-action-edit');
            if (editBtn) {
                app.closeModal('duplicate-manager-modal');
                app.editQuestion(editBtn.dataset.id);
                return;
            }
            const dismissBtn = e.target.closest('.dup-action-dismiss');
            if (dismissBtn) {
                const card = dismissBtn.closest('.dup-card');
                if (card) {
                    card.style.opacity = '0';
                    card.style.transform = 'scale(0.95)';
                    setTimeout(() => card.remove(), 200);
                }
            }
        };
    }
};
