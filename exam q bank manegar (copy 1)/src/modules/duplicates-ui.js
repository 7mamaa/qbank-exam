/**
 * Duplicate Manager UI Module
 * Standalone logic for duplicates.html
 */
import { state } from '../core/state.js';
import { db } from '../core/db.js';
import { Helpers } from '../utils/helpers.js';
import { QuestionModule } from './questions.js';

export const DuplicateUI = {
    _dupGroups: [],

    init() {
        this.bindEvents();
        this.updateThresholdDisplay();
    },

    bindEvents() {
        const slider = document.getElementById('dup-threshold-slider');
        if (slider) {
            slider.addEventListener('input', () => this.updateThresholdDisplay());
        }
    },

    updateThresholdDisplay() {
        const slider = document.getElementById('dup-threshold-slider');
        const display = document.getElementById('dup-threshold-value');
        if (slider && display) {
            display.textContent = slider.value + '%';
        }
    },

    async startScan() {
        const slider = document.getElementById('dup-threshold-slider');
        const threshold = slider ? parseInt(slider.value) / 100 : 0.8;
        
        const scanBtn = document.getElementById('dup-scan-btn');
        const progressFill = document.getElementById('dup-progress-fill');
        const container = document.getElementById('duplicate-manager-list');

        // UI State: Loading
        if (scanBtn) scanBtn.disabled = true;
        if (progressFill) progressFill.style.width = '0%';
        if (container) {
            container.innerHTML = `
                <div class="dup-empty-state">
                    <div class="spinner"></div>
                    <p>جاري فحص قاعدة البيانات... قد يستغرق ذلك ثوانٍ قليلة</p>
                </div>`;
        }

        try {
            const onProgress = (pct) => {
                if (progressFill) progressFill.style.width = pct + '%';
            };

            const groups = await QuestionModule.findDuplicates(threshold, onProgress);
            this._dupGroups = groups;
            this.renderResults(groups, state.questions.length);
        } catch (err) {
            console.error('Scan failed:', err);
        } finally {
            if (scanBtn) scanBtn.disabled = false;
        }
    },

    renderResults(groups, totalScanned) {
        const container = document.getElementById('duplicate-manager-list');
        const summaryEl = document.getElementById('dup-summary');
        const batchBtn = document.getElementById('dup-merge-all-btn');
        
        if (!container) return;

        let totalPairs = 0;
        groups.forEach(g => totalPairs += g.duplicates.length);

        // Update Summary
        if (summaryEl) {
            summaryEl.innerHTML = totalPairs > 0 
                ? `<span>عثرنا على <strong>${totalPairs}</strong> تكرار في <strong>${groups.length}</strong> مجموعة</span>`
                : `<span>✅ البنك نظيف! لا توجد تكرارات بهذه النسبة.</span>`;
        }

        if (batchBtn) batchBtn.style.display = totalPairs > 0 ? 'flex' : 'none';

        if (totalPairs === 0) {
            container.innerHTML = `
                <div class="dup-empty-state">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="var(--success-color)" stroke-width="1.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                    <h3>لا توجد تكرارات</h3>
                    <p>جرّب تقليل نسبة التشابه للبحث عن تكرارات محتملة غير مطابقة تماماً.</p>
                </div>`;
            return;
        }

        container.innerHTML = groups.map(group => 
            group.duplicates.map(dup => this.createCardHtml(group.original, dup)).join('')
        ).join('');

        this.attachCardEvents();
    },

    createCardHtml(org, dup) {
        return `
        <div class="dup-card" data-dup-id="${dup.question.id}">
            <div class="dup-card-header">
                <span class="dup-pair-label">مجموعة تكرار</span>
                <span class="dup-sim-badge">${dup.similarity}% تشابه</span>
            </div>
            <div class="dup-compare-stack">
                <div class="dup-side-box original">
                    <div class="dup-side-tag is-original">النسخة الأصلية</div>
                    <div class="dup-q-text">${Helpers.sanitize(org.question)}</div>
                    <div class="dup-q-meta">📁 ${Helpers.sanitize(org.category || 'عام')}</div>
                </div>
                <div class="dup-vs-divider"></div>
                <div class="dup-side-box duplicate">
                    <div class="dup-side-tag is-duplicate">النسخة المكررة</div>
                    <div class="dup-q-text">${Helpers.sanitize(dup.question.question)}</div>
                    <div class="dup-q-meta">📁 ${Helpers.sanitize(dup.question.category || 'عام')}</div>
                </div>
            </div>
            <div class="dup-card-footer">
                <div class="dup-card-actions">
                    <button class="btn btn-primary btn-sm" onclick="window.DuplicateUI.merge('${org.id}', '${dup.question.id}')">دمج وحذف المكرر</button>
                    <button class="btn btn-secondary btn-sm" onclick="this.closest('.dup-card').remove()">تجاهل</button>
                </div>
            </div>
        </div>`;
    },

    attachCardEvents() {
        // Events are handled by inline onclick for simplicity in standalone page, 
        // but we can also use delegation.
    },

    async merge(orgId, dupId) {
        if (!confirm('هل أنت متأكد من دمج وحذف هذا السؤال؟')) return;
        
        const success = await QuestionModule.mergeQuestions(orgId, dupId);
        if (success) {
            const card = document.querySelector(`.dup-card[data-dup-id="${dupId}"]`);
            if (card) {
                card.style.opacity = '0';
                card.style.transform = 'scale(0.9)';
                setTimeout(() => card.remove(), 200);
            }
        }
    },

    async mergeAll() {
        const total = this._dupGroups.reduce((acc, g) => acc + g.duplicates.length, 0);
        if (total === 0) return;
        if (!confirm(`⚠️ تحذير: سيتم دمج ${total} تكرار وحذفهم نهائياً. هل أنت متأكد؟`)) return;

        const scanBtn = document.getElementById('dup-scan-btn');
        const batchBtn = document.getElementById('dup-merge-all-btn');
        if (scanBtn) scanBtn.disabled = true;
        if (batchBtn) batchBtn.disabled = true;

        try {
            let merged = 0;
            for (const group of this._dupGroups) {
                for (const dup of group.duplicates) {
                    await QuestionModule.mergeQuestions(group.original.id, dup.question.id);
                    merged++;
                }
            }
            alert(`✅ تم دمج ${merged} تكرار بنجاح!`);
            location.reload();
        } catch (err) {
            console.error('Batch merge failed:', err);
            alert('حدث خطأ أثناء الدمج الجماعي.');
        } finally {
            if (scanBtn) scanBtn.disabled = false;
            if (batchBtn) batchBtn.disabled = false;
        }
    }
};

window.DuplicateUI = DuplicateUI;
