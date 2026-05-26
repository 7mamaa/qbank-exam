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
        Array.from(selectEl.options).forEach((opt, idx) => {
            const li = document.createElement('li');
            li.dataset.value = opt.value;
            if (idx === selectEl.selectedIndex) {
                li.classList.add('selected');
            }

            if (selectId === 'theme-selector') {
                let iconSvg;
                let text = opt.text;
                // Strip emojis from text
                text = text.replace(/[\u{1F300}-\u{1F9FF}]/gu, '').replace(/☕/g, '').trim();
                
                if (opt.value === 'default') {
                    iconSvg = `<svg class="theme-icon-svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M12 2v20"></path></svg>`;
                } else if (opt.value === 'apple') {
                    iconSvg = `<svg class="theme-icon-svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20.94c-1.54.24-3.05-.18-4.36-1.22a5.9 5.9 0 0 1-2.02-4.57 6 6 0 0 1 5.67-6c1.1.08 2.27.42 2.71.56.45-.14 1.62-.48 2.71-.56a6 6 0 0 1 5.67 6 5.9 5.9 0 0 1-2.02 4.57c-1.31 1.04-2.82 1.46-4.36 1.22z"></path><path d="M12 9V5c0-1.1.9-2 2-2"></path></svg>`;
                } else if (opt.value === 'cream-earthy') {
                    iconSvg = `<svg class="theme-icon-svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"></path><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"></path><line x1="6" y1="1" x2="6" y2="4"></line><line x1="10" y1="1" x2="10" y2="4"></line><line x1="14" y1="1" x2="14" y2="4"></line></svg>`;
                } else if (opt.value === 'gray-orange') {
                    iconSvg = `<svg class="theme-icon-svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="3" x2="9" y2="21"></line></svg>`;
                } else if (opt.value === 'tech-violet') {
                    iconSvg = `<svg class="theme-icon-svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2 12 22"></polygon></svg>`;
                } else if (opt.value === 'deep-orange') {
                    iconSvg = `<svg class="theme-icon-svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path><path d="M2 12h20"></path></svg>`;
                } else {
                    iconSvg = `<svg class="theme-icon-svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"></path><path d="M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"></path></svg>`;
                }
                li.innerHTML = `${iconSvg}<span>${text}</span>`;
            } else {
                li.textContent = opt.text;
            }

            li.addEventListener('click', (e) => {
                selectEl.value = opt.value;
                if (selectId === 'theme-selector') {
                    span.textContent = opt.text.replace(/[\u{1F300}-\u{1F9FF}]/gu, '').replace(/☕/g, '').trim();
                } else {
                    span.textContent = opt.text;
                }
                selectEl.dispatchEvent(new Event('change'));
                wrapper.classList.remove('active');
                e.stopPropagation();
            });
            ul.appendChild(li);
        });
        
        const selectedOptText = selectEl.options[selectEl.selectedIndex]?.text || i18n.t('select_dot');
        if (selectId === 'theme-selector') {
            span.textContent = selectedOptText.replace(/[\u{1F300}-\u{1F9FF}]/gu, '').replace(/☕/g, '').trim();
        } else {
            span.textContent = selectedOptText;
        }
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

    renderDailyActivityHeatmap(questions, quizHistory) {
        try {
            const container = document.getElementById('heatmap-container');
            if (!container) return;

            const activityMap = {};
            const oneDayMs = 24 * 60 * 60 * 1000;

            (questions || []).forEach(q => {
                let dateObj = null;
                if (q.createdAt) {
                    dateObj = new Date(q.createdAt);
                } else if (typeof q.id === 'number') {
                    dateObj = new Date(q.id);
                } else if (typeof q.id === 'string' && !isNaN(q.id)) {
                    dateObj = new Date(Number(q.id));
                }
                if (dateObj && !isNaN(dateObj.getTime())) {
                    const dateStr = dateObj.toISOString().split('T')[0];
                    activityMap[dateStr] = (activityMap[dateStr] || 0) + 1;
                }
            });

            (quizHistory || []).forEach(quiz => {
                if (quiz.date) {
                    const dateStr = quiz.date.split('T')[0];
                    activityMap[dateStr] = (activityMap[dateStr] || 0) + 1;
                }
            });

            const today = new Date();
            const dates = [];
            const startDate = new Date(today.getTime() - 364 * oneDayMs);
            const startDayOfWeek = startDate.getDay();
            const adjustedStartDate = new Date(startDate.getTime() - startDayOfWeek * oneDayMs);

            for (let i = 0; i < 371; i++) {
                const d = new Date(adjustedStartDate.getTime() + i * oneDayMs);
                dates.push(d);
            }

            let rects = '';
            for (let col = 0; col < 53; col++) {
                for (let row = 0; row < 7; row++) {
                    const index = col * 7 + row;
                    const d = dates[index];
                    if (!d) continue;

                    const dateStr = d.toISOString().split('T')[0];
                    const count = activityMap[dateStr] || 0;

                    let color = 'rgba(128, 128, 128, 0.12)';
                    let tooltipSuffix = 'لا نشاط';
                    if (count > 0) {
                        if (count === 1) {
                            color = 'rgba(244, 162, 97, 0.3)';
                            tooltipSuffix = 'نشاط واحد';
                        } else if (count <= 3) {
                            color = 'rgba(244, 162, 97, 0.7)';
                            tooltipSuffix = `${count} نشاطات`;
                        } else if (count <= 5) {
                            color = 'rgba(114, 9, 183, 0.6)';
                            tooltipSuffix = `${count} نشاطات`;
                        } else {
                            color = 'rgba(114, 9, 183, 1)';
                            tooltipSuffix = `${count} نشاطات`;
                        }
                    }

                    const x = col * 12;
                    const y = row * 12;

                    rects += `
                        <rect x="${x}" y="${y}" width="10" height="10" rx="2" ry="2" fill="${color}" style="transition: fill 0.3s ease; cursor: pointer;">
                            <title>${dateStr}: ${tooltipSuffix}</title>
                        </rect>
                    `;
                }
            }

            container.innerHTML = `
                <svg viewBox="0 0 636 84" width="100%" height="100%" style="max-width: 636px;">
                    ${rects}
                </svg>
            `;
        } catch (err) {
            console.error('Heatmap render error', err);
        }
    },

    renderVulnerabilityDetector(quizHistory) {
        try {
            const catStats = {};
            const tagStats = {};

            (quizHistory || []).forEach(quiz => {
                (quiz.questions || []).forEach(q => {
                    const isCorrect = q.correct ? 1 : 0;
                    
                    if (q.category && q.category.trim()) {
                        const cat = q.category.trim();
                        if (!catStats[cat]) catStats[cat] = { total: 0, correct: 0 };
                        catStats[cat].total++;
                        catStats[cat].correct += isCorrect;
                    }

                    (q.tags || []).forEach(tag => {
                        if (tag && tag.trim()) {
                            const t = tag.trim();
                            if (!tagStats[t]) tagStats[t] = { total: 0, correct: 0 };
                            tagStats[t].total++;
                            tagStats[t].correct += isCorrect;
                        }
                    });
                });
            });

            const vulnerabilities = [];
            Object.entries(catStats).forEach(([cat, stat]) => {
                const pct = Math.round((stat.correct / stat.total) * 100);
                if (stat.total >= 2 && pct < 50) {
                    vulnerabilities.push({ name: cat, pct: pct, total: stat.total });
                }
            });
            Object.entries(tagStats).forEach(([tag, stat]) => {
                const pct = Math.round((stat.correct / stat.total) * 100);
                if (stat.total >= 2 && pct < 50) {
                    vulnerabilities.push({ name: `#${tag}`, pct: pct, total: stat.total });
                }
            });

            const container = document.getElementById('vulnerability-container');
            if (!container) return;

            if (vulnerabilities.length === 0) {
                container.innerHTML = `
                    <div style="padding: 15px; text-align: center; color: var(--success-color); background: rgba(42, 157, 143, 0.05); border: 1px dashed var(--success-color); border-radius: 12px; font-weight: 700; font-size: 0.85rem;">
                        🛡️ لا توجد نقاط ضعف حالياً.
                    </div>
                `;
                return;
            }

            vulnerabilities.sort((a, b) => a.pct - b.pct);

            container.innerHTML = vulnerabilities.slice(0, 3).map(v => `
                <div style="background: rgba(230, 57, 70, 0.05); border: 1.5px solid rgba(230, 57, 70, 0.1); border-left: 5px solid #e63946; padding: 10px; border-radius: 10px; margin-bottom: 8px; display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 1.2rem; flex-shrink:0;">⚠️</span>
                    <div style="text-align: start;">
                        <h4 style="margin: 0; color: var(--text-title); font-size: 0.85rem; font-weight: 800; text-align: start;">
                            تراجع في: <span style="color:#e63946;">${Helpers.sanitize(v.name)}</span>
                        </h4>
                        <p style="margin: 0; font-size: 0.75rem; color: var(--text-secondary); font-weight: 600; text-align: start;">
                            الإجابات الصحيحة ${v.pct}% (${v.total} أسئلة)
                        </p>
                    </div>
                </div>
            `).join('');
        } catch (err) {
            console.error('Vulnerability Detector render error', err);
        }
    },

    renderHistoricalQuizChart(quizHistory) {
        try {
            const container = document.getElementById('chart-history-container');
            if (!container) return;

            if (!quizHistory || quizHistory.length === 0) {
                container.innerHTML = `
                    <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding:40px 20px; opacity:0.15;">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom:12px;"><path d="M12 20V10"></path><path d="M18 20V4"></path><path d="M6 20v-4"></path></svg>
                        <p style="font-weight:600; font-size:0.85rem;">لا توجد نتائج اختبارات سابقة.</p>
                    </div>
                `;
                return;
            }

            const recentQuizzes = quizHistory
                .slice(-10)
                .sort((a, b) => new Date(a.date) - new Date(b.date));

            const width = 600;
            const height = 180;
            const padLeft = 40;
            const padRight = 20;
            const padTop = 20;
            const padBottom = 30;

            const plotWidth = width - padLeft - padRight;
            const plotHeight = height - padTop - padBottom;

            let gridLines = '';
            const percentages = [0, 50, 100];
            percentages.forEach(p => {
                const y = padTop + plotHeight - (p / 100) * plotHeight;
                gridLines += `
                    <line x1="${padLeft}" y1="${y}" x2="${width - padRight}" y2="${y}" stroke="var(--border)" stroke-width="1" stroke-dasharray="4,4" />
                    <text x="${padLeft - 8}" y="${y + 4}" font-size="9" fill="var(--text-secondary)" text-anchor="end" font-weight="700">${p}%</text>
                `;
            });

            const points = [];
            recentQuizzes.forEach((quiz, i) => {
                const pct = quiz.percent || 0;
                const x = recentQuizzes.length === 1 
                    ? padLeft + plotWidth / 2 
                    : padLeft + i * (plotWidth / (recentQuizzes.length - 1));
                const y = padTop + plotHeight - (pct / 100) * plotHeight;
                points.push({ x, y, pct, date: quiz.date, index: i + 1, score: quiz.score, total: quiz.total });
            });

            let pathD = '';
            if (points.length > 0) {
                pathD = `M ${points[0].x} ${points[0].y} ` + points.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ');
            }

            let areaPathD = '';
            if (points.length > 0) {
                areaPathD = `${pathD} L ${points[points.length - 1].x} ${padTop + plotHeight} L ${points[0].x} ${padTop + plotHeight} Z`;
            }

            let chartElements = `
                <defs>
                    <linearGradient id="chart-grad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stop-color="var(--primary)" stop-opacity="0.3"/>
                        <stop offset="100%" stop-color="var(--primary)" stop-opacity="0"/>
                    </linearGradient>
                </defs>
                ${gridLines}
            `;

            if (areaPathD) {
                chartElements += `<path d="${areaPathD}" fill="url(#chart-grad)" />`;
            }

            if (pathD) {
                chartElements += `<path d="${pathD}" fill="none" stroke="var(--primary)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />`;
            }

            points.forEach(p => {
                const formattedDate = new Date(p.date).toLocaleDateString(document.documentElement.lang === 'ar' ? 'ar-EG' : 'en-US', {
                    month: 'short',
                    day: 'numeric'
                });

                chartElements += `
                    <g style="cursor: pointer;">
                        <circle cx="${p.x}" cy="${p.y}" r="4" fill="var(--card-bg)" stroke="var(--primary)" stroke-width="2" />
                        <text x="${p.x}" y="${padTop + plotHeight + 15}" font-size="8" fill="var(--text-secondary)" text-anchor="middle" font-weight="700">${formattedDate}</text>
                        <title>اختبار #${p.index} | الدرجة: ${p.score}/${p.total} (${p.pct}%)</title>
                    </g>
                `;
            });

            container.innerHTML = `
                <svg viewBox="0 0 ${width} ${height}" width="100%" height="100%" style="overflow: visible;">
                    ${chartElements}
                </svg>
            `;
        } catch (err) {
            console.error('Historical chart render error', err);
        }
    },

    renderDailyAnalyticsWrap(questions, quizHistory) {
        try {
            const todayStr = new Date().toISOString().split('T')[0];

            const addedToday = (questions || []).filter(q => {
                let dateObj = null;
                if (q.createdAt) {
                    dateObj = new Date(q.createdAt);
                } else if (typeof q.id === 'number') {
                    dateObj = new Date(q.id);
                } else if (typeof q.id === 'string' && !isNaN(q.id)) {
                    dateObj = new Date(Number(q.id));
                }
                return dateObj && dateObj.toISOString().split('T')[0] === todayStr;
            }).length;

            const solvedToday = (quizHistory || []).filter(quiz => {
                return quiz.date && quiz.date.split('T')[0] === todayStr;
            });

            const solvedCountToday = solvedToday.length;
            const highestScoreToday = solvedCountToday > 0 
                ? Math.max(...solvedToday.map(q => q.percent || 0)) 
                : 0;

            const container = document.getElementById('daily-wrap-container');
            if (!container) return;

            if (addedToday === 0 && solvedCountToday === 0) {
                container.innerHTML = `
                    <div style="font-weight: 600; color: var(--text-secondary); text-align: start; font-size: 0.9rem;">
                        أهلاً بك اليوم! البنك جاهز دائماً. لم تقم بإضافة أسئلة أو حل اختبارات اليوم بعد. 🚀
                    </div>
                `;
                return;
            }

            let summaryText = `النهارده أضفت <strong style="color: var(--primary); font-size:1.1rem;">${addedToday}</strong> سؤالاً جديداً 📚`;
            if (solvedCountToday > 0) {
                summaryText += `، وحللت <strong style="color: var(--accent); font-size:1.1rem;">${solvedCountToday}</strong> اختباراً 🧪، وحققت أعلى درجة <strong style="color: #2cb67d; font-size:1.1rem;">${highestScoreToday}%</strong> 🎉.`;
            } else {
                summaryText += `، ولم تقم بحل أي اختبارات اليوم.`;
            }

            container.innerHTML = `
                <div style="background: rgba(114, 9, 183, 0.04); border: 1px solid rgba(114, 9, 183, 0.08); padding: 12px; border-radius: 10px; font-weight: 600; color: var(--text-title); animation: fadeIn 0.4s ease; text-align: start; font-size: 0.9rem; line-height: 1.5;">
                    ${summaryText}
                </div>
            `;
        } catch (err) {
            console.error('Daily wrap render error', err);
        }
    },

    renderOrphanCounter(questions) {
        try {
            const orphanCount = (questions || []).filter(q => {
                const hasCategory = q.category && q.category.trim() !== '';
                const hasTags = q.tags && q.tags.length > 0;
                return !hasCategory && !hasTags;
            }).length;

            const valEl = document.getElementById('orphan-count-value');
            if (valEl) {
                valEl.textContent = orphanCount;
            }
        } catch (err) {
            console.error('Orphan counter render error', err);
        }
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
