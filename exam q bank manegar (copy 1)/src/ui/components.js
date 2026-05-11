import { i18n } from '../core/i18n.js';

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
            'quiz-notebook', 'import-notebook', 'bulk-notebook-move', 'notebook-parent'
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
            container.innerHTML = `<p class="text-muted" style="padding:10px 0;">${i18n.t('no_data_yet')}</p>`;
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
                <span class="chart-bar-tooltip">${item.label}: ${item.count}</span>
                <span class="chart-bar-label">${item.label}</span>
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
     * Renders the Duplicate Manager list into its container.
     * @param {Array} groups - Groups of duplicates found.
     */
    renderDuplicateManager(groups) {
        const container = document.getElementById('duplicate-manager-list');
        if (!container) return;

        if (groups.length === 0) {
            container.innerHTML = `<div style="text-align:center; padding:40px; color:var(--success-color); font-weight:bold;">🎉 ${i18n.t('dup_no_found')}</div>`;
            return;
        }

        container.innerHTML = groups.map(group => `
            <div class="stat-card" style="margin-bottom:20px; border:1px solid var(--border); background:var(--bg-main); padding:0; overflow:hidden;">
                <div style="padding:10px 15px; background:var(--primary); color:white; font-weight:bold; font-size:0.9rem; display:flex; justify-content:space-between; align-items:center;">
                    <span>🎯 ${i18n.t('dup_original')}</span>
                    <span style="font-size:0.75rem; opacity:0.8;">ID: ${group.original.id}</span>
                </div>
                <div style="padding:15px; border-bottom:1px solid var(--border);">
                    <div style="font-weight:600; margin-bottom:8px; line-height:1.5;">${Helpers.sanitize(group.original.question)}</div>
                    <div style="font-size:0.8rem; color:var(--text-secondary);">
                        📁 ${Helpers.sanitize(group.original.category || i18n.t('general'))} | 
                        🏷️ ${(group.original.tags || []).map(t => '#' + Helpers.sanitize(t)).join(' ')}
                    </div>
                </div>
                
                <div style="padding:8px 15px; background:rgba(230, 57, 70, 0.05); font-weight:bold; font-size:0.85rem; border-top:1px solid var(--border); color:var(--danger-color); display:flex; align-items:center; gap:8px;">
                    <span>🚨 ${i18n.t('dup_found_count', {count: group.duplicates.length})}</span>
                </div>

                ${group.duplicates.map(dup => `
                    <div style="padding:15px; background:var(--surface-color); border-top:1px solid var(--border); display:flex; gap:15px; align-items:center;">
                        <div style="flex:1;">
                            <div style="margin-bottom:8px; line-height:1.4;">${Helpers.sanitize(dup.question.question)}</div>
                            <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
                                <span class="q-badge" style="background:var(--danger-color); color:white; font-weight:bold;">${i18n.t('dup_similarity')}: ${dup.similarity}%</span>
                                <span style="font-size:0.75rem; color:var(--text-secondary);">ID: ${dup.question.id}</span>
                            </div>
                        </div>
                        <div style="display:flex; gap:10px;">
                            <button class="btn btn-sm" onclick="app.executeMerge('${group.original.id}', '${dup.question.id}')" style="background:var(--success-color); color:white; border:none; padding:8px 15px; border-radius:8px; cursor:pointer; font-weight:bold; transition:var(--transition);">
                                ${i18n.t('dup_merge_btn')}
                            </button>
                            <button class="btn btn-sm" onclick="this.closest('div[style*=\'border-top\']').remove()" style="background:var(--text-secondary); color:white; border:none; padding:8px 15px; border-radius:8px; cursor:pointer; font-weight:bold; transition:var(--transition);">
                                ${i18n.t('dup_ignore_btn')}
                            </button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `).join('');
    }
};
