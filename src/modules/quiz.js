import { state } from '../core/state.js';
import { AudioManager } from '../ui/audio.js';
import { Helpers } from '../utils/helpers.js';
import { i18n } from '../core/i18n.js';
import { QuestionModule } from './questions.js';

import { NotebookModule } from './notebooks.js';

/**
 * @module QuizModule
 * @description Logic for the interactive quiz system, timer, and scoring.
 */
export const QuizModule = {
    /**
     * Starts a new quiz session based on user selection.
     * @param {Function} renderCallback - Callback to render the first question.
     */
    startQuiz(renderCallback) {
        const nbId = document.getElementById('quiz-notebook').value;
        const limit = parseInt(document.getElementById('quiz-count').value) || 20;

        let pool = state.questions;
        if (nbId) {
            if (nbId === 'orphaned') {
                pool = pool.filter(q => !state.notebooks.some(n => n.id === q.notebookId));
            } else {
                const descendantIds = NotebookModule.getAllDescendantIds(nbId, state.notebooks);
                const allowedIds = [nbId, ...descendantIds];
                pool = pool.filter(q => allowedIds.includes(q.notebookId));
            }
        }

        if (pool.length === 0) return alert(i18n.t('quiz_err_empty'));

        // Shuffle and limit
        pool = [...pool].sort(() => Math.random() - 0.5).slice(0, limit);

        const timeLimit = parseInt(document.getElementById('quiz-time').value) || 15;
        
        state.quizState = {
            pool: pool,
            currentIdx: 0,
            answers: {},
            startTime: Date.now(),
            endTime: Date.now() + (timeLimit * 60 * 1000),
            timerInterval: null,
            isFinished: false
        };

        const totalEl = document.getElementById('quiz-total');
        if (totalEl) totalEl.textContent = pool.length;
        
        this.startTimer();
        if (renderCallback) renderCallback();
        
        // Switch view
        document.getElementById('quiz-setup').style.display = 'none';
        document.getElementById('quiz-active').style.display = 'block';
    },

    /**
     * Starts the quiz timer interval.
     * @private
     */
    startTimer() {
        if (state.quizState.timerInterval) clearInterval(state.quizState.timerInterval);
        state.quizState.timerInterval = setInterval(() => this.updateQuizTimer(), 1000);
    },

    /**
     * Updates the timer display every second.
     */
    updateQuizTimer() {
        const remaining = Math.floor((state.quizState.endTime - Date.now()) / 1000);
        
        if (remaining <= 0) {
            clearInterval(state.quizState.timerInterval);
            alert(i18n.t('quiz_time_up'));
            this.submitQuiz();
            return;
        }

        const mins = Math.floor(remaining / 60).toString().padStart(2, '0');
        const secs = (remaining % 60).toString().padStart(2, '0');
        const el = document.getElementById('quiz-timer');
        if (el) {
            el.textContent = `${mins}:${secs}`;
            if (remaining < 60) el.style.color = 'var(--danger-color)';
        }
    },

    /**
     * Renders the current quiz question in the active quiz view.
     */
    renderQuizQuestion() {
        const q = state.quizState.pool[state.quizState.currentIdx];
        if (!q) return;

        const currentIdxEl = document.getElementById('quiz-current-idx');
        if (currentIdxEl) currentIdxEl.textContent = state.quizState.currentIdx + 1;
        
        const container = document.getElementById('quiz-question-container');
        
        let html = `<div class="quiz-q-card">`;
        html += `<h3>${Helpers.sanitize(q.question)}</h3>`;
        if (q.image) html += `<img src="${q.image}" class="quiz-img">`;

        if (q.type === 'mcq') {
            html += `<div class="quiz-options">`;
            q.options.forEach((opt, idx) => {
                const isSelected = state.quizState.answers[q.id] === opt;
                const sOpt = Helpers.sanitize(opt);
                html += `
                    <div class="quiz-opt ${isSelected ? 'selected' : ''}" onclick="app.saveQuizAnswer('${q.id}', '${sOpt.replace(/'/g, "\\'")}'); app.renderQuizQuestion();">
                        <span class="opt-label">${String.fromCharCode(65 + idx)}</span>
                        <span class="opt-text">${sOpt}</span>
                    </div>
                `;
            });
            html += `</div>`;
        } else if (q.type === 'boolean') {
            const ans = state.quizState.answers[q.id];
            html += `
                <div class="quiz-options">
                    <div class="quiz-opt ${ans === true ? 'selected' : ''}" onclick="app.saveQuizAnswer('${q.id}', true); app.renderQuizQuestion();">${i18n.t('quiz_true')}</div>
                    <div class="quiz-opt ${ans === false ? 'selected' : ''}" onclick="app.saveQuizAnswer('${q.id}', false); app.renderQuizQuestion();">${i18n.t('quiz_false')}</div>
                </div>
            `;
        } else {
            const currentAns = state.quizState.answers[q.id] || '';
            html += `<textarea class="form-control" placeholder="${i18n.t('quiz_ans_placeholder')}" oninput="app.saveQuizAnswer('${q.id}', this.value)">${Helpers.sanitize(currentAns)}</textarea>`;
        }

        html += `</div>`;
        container.innerHTML = html;
        
        this.updateProgress();
    },

    /**
     * Saves the user's answer for a specific question.
     * @param {string} qId 
     * @param {any} val 
     */
    saveQuizAnswer(qId, val) {
        state.quizState.answers[qId] = val;
        AudioManager.playSound('click');
    },

    /**
     * Navigates between quiz questions.
     * @param {number} dir - Direction: 1 for next, -1 for previous.
     */
    quizNav(dir) {
        const newIdx = state.quizState.currentIdx + dir;
        if (newIdx >= 0 && newIdx < state.quizState.pool.length) {
            state.quizState.currentIdx = newIdx;
            this.renderQuizQuestion();
        }
    },

    /**
     * Updates the progress bar and answered count.
     * @private
     */
    updateProgress() {
        const answered = Object.keys(state.quizState.answers).length;
        const total = state.quizState.pool.length;
        const progress = (answered / total) * 100;
        const bar = document.getElementById('quiz-progress-bar');
        if (bar) bar.style.width = `${progress}%`;
    },

    /**
     * Submits the quiz and displays results.
     */
    submitQuiz() {
        if (!confirm(i18n.t('quiz_confirm_submit'))) return;
        
        clearInterval(state.quizState.timerInterval);
        state.quizState.isFinished = true;
        
        let score = 0;
        for (const q of state.quizState.pool) {
            const userAns = state.quizState.answers[q.id];
            if (q.type === 'mcq' || q.type === 'boolean') {
                if (userAns === q.answer) score++;
            } else if (q.type === 'written') {
                const normUser = QuestionModule.normalizeMedicalAnswer(userAns);
                const normModel = QuestionModule.normalizeMedicalAnswer(q.answer || (q.keywords ? q.keywords.join(' ') : ''));
                
                const similarity = Helpers.calculateSimilarity(normUser, normModel);
                if (similarity >= 0.7) score++; // 70% match threshold for academic sentences
            }
        }

        const percent = Math.round((score / state.quizState.pool.length) * 100);
        
        document.getElementById('quiz-active').style.display = 'none';
        document.getElementById('quiz-result').style.display = 'block';
        
        const scoreEl = document.getElementById('quiz-score');
        if (scoreEl) scoreEl.textContent = `${score} / ${state.quizState.pool.length} (${percent}%)`;
        
        const feedbackEl = document.getElementById('quiz-feedback');
        if (feedbackEl) {
            if (percent >= 90) feedbackEl.textContent = i18n.t('quiz_feedback_excellent');
            else if (percent >= 75) feedbackEl.textContent = i18n.t('quiz_feedback_good');
            else if (percent >= 50) feedbackEl.textContent = i18n.t('quiz_feedback_pass');
            else feedbackEl.textContent = i18n.t('quiz_feedback_fail');
        }
        
        AudioManager.playSound('finish');
    }
};
