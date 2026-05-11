import { i18n } from '../core/i18n.js';
import { state } from '../core/state.js';

export const AIModule = {
    regeneratePrompt() {
        const topic = document.getElementById('ai-topic')?.value || i18n.t('q_not_defined');
        const difficulty = document.getElementById('ai-difficulty')?.value || i18n.t('difficulty_medium');
        const lang = document.getElementById('ai-lang')?.value || (state.language === 'ar' ? 'العربية' : 'English');
        const level = document.getElementById('ai-level')?.value || '';

        const countMcq = parseInt(document.getElementById('ai-count-mcq')?.value) || 0;
        const countBoolean = parseInt(document.getElementById('ai-count-boolean')?.value) || 0;
        const countMatch = parseInt(document.getElementById('ai-count-match')?.value) || 0;
        const countWritten = parseInt(document.getElementById('ai-count-written')?.value) || 0;

        const totalCount = countMcq + countBoolean + countMatch + countWritten;

        if (totalCount === 0) {
            const el = document.getElementById('ai-prompt-text');
            // Provide a clear, actionable message instead of the generic error key
            if (el) el.value = state.language === 'ar'
                ? '⚠️ يرجى تحديد عدد الأسئلة لكل نوع أولاً (مثال: 5 اختيار من متعدد، 3 صح/خطأ).'
                : '⚠️ Please set the number of questions for at least one type (e.g. 5 MCQ, 3 True/False).';
            return;
        }


        const isAr = state.language === 'ar';
        const typesStr = [
            countMcq > 0 ? `${countMcq} ${i18n.t('type_mcq')}` : null,
            countBoolean > 0 ? `${countBoolean} ${i18n.t('type_boolean')}` : null,
            countMatch > 0 ? `${countMatch} ${i18n.t('type_match')}` : null,
            countWritten > 0 ? `${countWritten} ${i18n.t('type_written')}` : null
        ].filter(Boolean).join(isAr ? '، و ' : ', and ');

        let prompt = i18n.t('ai_prompt_template');
        prompt = prompt.replace(/{topic}/g, topic)
                       .replace(/{totalCount}/g, totalCount)
                       .replace(/{typesStr}/g, typesStr)
                       .replace(/{lang}/g, lang)
                       .replace(/{level}/g, level)
                       .replace(/{difficulty}/g, difficulty);

        const el = document.getElementById('ai-prompt-text');
        if (el) el.value = prompt;
    },

    async copyAiPrompt() {
        const text = document.getElementById('ai-prompt-text').value;
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (e) {
            return false;
        }
    }
};
