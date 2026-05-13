import { db } from '../core/db.js';
import { state } from '../core/state.js';
import { QuestionModule } from './questions.js';
import { UIComponents } from '../ui/components.js';
import { i18n } from '../core/i18n.js';

/**
 * @file duplicates.js
 * @description Decoupled module for managing duplicate questions.
 * Handles the orchestration of finding and merging duplicate questions.
 */

export const DuplicateModule = {
    /**
     * Initializes the duplicate manager page.
     */
    async init() {
        console.log('[DuplicateModule] Initializing...');
        await db.init();
        await this.syncData();
        this.bindEvents();
        
        // Initial check if we should auto-scan
        // this.scan(); 
    },

    /**
     * Synchronizes local state for the duplicate manager.
     */
    async syncData() {
        try {
            const questions = await db.getAll('questions');
            state.questions = questions;
            console.log(`[DuplicateModule] Synced ${questions.length} questions.`);
        } catch (e) {
            console.error('[DuplicateModule] Sync failed:', e);
        }
    },

    /**
     * Binds events specific to the duplicate manager UI.
     */
    bindEvents() {
        const thresholdSlider = document.getElementById('dup-threshold-slider');
        const thresholdValue = document.getElementById('dup-threshold-value');
        const scanBtn = document.getElementById('dup-scan-btn');
        const mergeAllBtn = document.getElementById('dup-merge-all-btn');

        if (thresholdSlider && thresholdValue) {
            thresholdSlider.addEventListener('input', (e) => {
                thresholdValue.textContent = `${e.target.value}%`;
            });
        }

        if (scanBtn) {
            scanBtn.addEventListener('click', () => this.scan());
        }

        if (mergeAllBtn) {
            mergeAllBtn.addEventListener('click', () => this.mergeAll());
        }
    },

    /**
     * Scans for duplicate questions based on the current threshold.
     */
    async scan() {
        const thresholdSlider = document.getElementById('dup-threshold-slider');
        const threshold = parseInt(thresholdSlider?.value) || 80;
        
        const progressBar = document.getElementById('dup-progress-bar');
        const progressFill = document.getElementById('dup-progress-fill');
        const list = document.getElementById('duplicate-manager-list');
        const summary = document.getElementById('dup-summary');
        const batchActions = document.getElementById('dup-batch-actions');

        if (!list) return;

        // Reset UI
        list.innerHTML = `
            <div class="dup-scanning-state" style="text-align: center; padding: 50px;">
                <div class="loading-spinner" style="margin: 0 auto 20px;"></div>
                <p style="color: var(--text-secondary);">جاري تحليل الأسئلة... قد يستغرق ذلك وقتاً للبيانات الضخمة</p>
            </div>
        `;
        if (progressBar) progressBar.style.display = 'block';
        if (summary) summary.style.display = 'none';
        if (batchActions) batchActions.style.display = 'none';

        const onProgress = (percent) => {
            if (progressFill) {
                progressFill.style.width = `${percent}%`;
            }
        };

        try {
            const totalQuestions = state.questions.length;
            const groups = await QuestionModule.findDuplicates(threshold, onProgress);
            
            // Render results
            UIComponents.renderDuplicateManager(groups, totalQuestions);
            
            // Update UI after render
            if (groups.length > 0) {
                if (batchActions) batchActions.style.display = 'flex';
                if (progressBar) progressBar.style.display = 'none';
            } else {
                if (progressBar) progressBar.style.display = 'none';
                list.innerHTML = `
                    <div class="dup-empty-state" style="text-align: center; padding: 50px; opacity: 0.6;">
                        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 20px;"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                        <p>لم يتم العثور على تكرارات بنسبة تشابه ${threshold}%</p>
                    </div>
                `;
            }
        } catch (e) {
            console.error('[DuplicateModule] Scan failed:', e);
            UIComponents.showToast('⚠️ فشل فحص التكرارات', 'error');
        }
    },

    /**
     * Merges a single duplicate into its original counterpart.
     * @param {string} originalId 
     * @param {string} duplicateId 
     */
    async merge(originalId, duplicateId) {
        try {
            const success = await QuestionModule.mergeQuestions(originalId, duplicateId);
            if (success) {
                UIComponents.showToast(i18n.t('msg_merge_success') || 'تم الدمج بنجاح', 'success');
                await this.syncData();
                await this.scan(); // Refresh list
            }
        } catch (e) {
            console.error('[DuplicateModule] Merge failed:', e);
            UIComponents.showToast('⚠️ فشل دمج الأسئلة', 'error');
        }
    },

    /**
     * Merges all detected duplicate groups.
     */
    async mergeAll() {
        const list = document.getElementById('duplicate-manager-list');
        const groups = Array.from(list.querySelectorAll('.dup-group-card'));
        
        if (groups.length === 0) return;
        
        if (!confirm('هل أنت متأكد من دمج كافة التكرارات المكتشفة تلقائياً؟ لا يمكن التراجع عن هذه الخطوة.')) return;

        let mergedCount = 0;
        try {
            // Re-run scan to get fresh groups from state
            const threshold = parseInt(document.getElementById('dup-threshold-slider')?.value) || 80;
            const freshGroups = await QuestionModule.findDuplicates(threshold);

            for (const group of freshGroups) {
                for (const dup of group.duplicates) {
                    await QuestionModule.mergeQuestions(group.original.id, dup.question.id);
                    mergedCount++;
                }
            }

            UIComponents.showToast(`✅ تم دمج ${mergedCount} سؤال مكرر بنجاح`, 'success');
            await this.syncData();
            await this.scan();
        } catch (e) {
            console.error('[DuplicateModule] Bulk merge failed:', e);
            UIComponents.showToast('⚠️ حدث خطأ أثناء الدمج الشامل', 'error');
        }
    }
};

// Global expose for components logic compatibility
window.app = window.app || {};
window.app.executeMerge = (orig, dup) => DuplicateModule.merge(orig, dup);
window.app.editQuestion = (id) => {
    window.location.href = `index.html?edit=${id}`;
};
window.app.closeModal = () => {}; // No-op in standalone page
window.app.playSound = () => {}; // Optional sound support could be added later
