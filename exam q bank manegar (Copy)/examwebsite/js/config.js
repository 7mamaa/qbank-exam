// ========== GLOBAL STATE ==========
export const ExamState = {
    questions: [],
    currentQuestionIndex: 0,
    userAnswers: {},
    flaggedQuestions: new Set(),
    timePerQuestion: {},
    filteredQuestions: [],
    correctAnswers: {},

    // Settings
    isReviewMode: false,
    isExamStarted: false,
    isExamFinished: false,
    isFocusMode: false,

    // Instant Feedback Mode
    instantFeedback: false,

    // Timer
    totalTimeSeconds: 30 * 60,
    timeRemaining: 30 * 60,
    timerInterval: null,
    currentQuestionStartTime: Date.now(),

    // UI State
    currentFilter: 'all',
    isCalmMode: false,
    isMobile: false,

    // Randomization
    randomizeQuestions: true,
    randomizeOptions: true,
    keepEssayOrder: false,

    // Common words to remove for essay comparison
    commonWords: new Set(['the', 'a', 'an', 'and', 'or', 'but', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'may', 'might', 'must', 'can', 'could', 'will', 'would', 'shall', 'should', 'of', 'for', 'with', 'without', 'by', 'at', 'in', 'on', 'to', 'from', 'as', 'it', 'its', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'we', 'they', 'my', 'your', 'his', 'her', 'our', 'their']),

    // Initialize
    init() {
        this.detectMobile();
        this.loadSavedSettings();
        this.resetExamState();
    },

    detectMobile() {
        this.isMobile = window.innerWidth <= 768;
    },

    resetExamState() {
        this.currentQuestionIndex = 0;
        this.userAnswers = {};
        this.correctAnswers = {};
        this.flaggedQuestions.clear();
        this.timePerQuestion = {};
        this.isReviewMode = false;
        this.isExamFinished = false;
        this.timeRemaining = this.totalTimeSeconds;
        this.filteredQuestions = [];
        this.currentFilter = 'all';
        this.currentQuestionStartTime = Date.now();
        this.isFocusMode = false;
    },

    loadSavedSettings() {
        try {
            // Load calm mode
            const savedCalmMode = localStorage.getItem('examCalmMode');
            if (savedCalmMode === 'true') {
                this.isCalmMode = true;
                document.body.classList.add('calm-mode');
            }

            // Load focus mode
            const savedFocusMode = localStorage.getItem('examFocusMode');
            if (savedFocusMode === 'true') {
                this.isFocusMode = true;
                document.body.classList.add('focus-mode');
            }

            // Load instant feedback
            const savedInstantFeedback = localStorage.getItem('examInstantFeedback');
            if (savedInstantFeedback === 'true') {
                this.instantFeedback = true;
            }

            // Load exam settings
            const savedSettings = localStorage.getItem('examSettings');
            if (savedSettings) {
                const settings = JSON.parse(savedSettings);
                this.totalTimeSeconds = settings.totalTimeSeconds || this.totalTimeSeconds;
                this.randomizeQuestions = settings.randomizeQuestions ?? true;
                this.randomizeOptions = settings.randomizeOptions ?? true;
                this.keepEssayOrder = settings.keepEssayOrder ?? false;
            }
        } catch (error) {
            console.warn('Failed to load saved settings:', error);
        }
    },

    saveSettings() {
        try {
            localStorage.setItem('examCalmMode', this.isCalmMode);
            localStorage.setItem('examFocusMode', this.isFocusMode);
            localStorage.setItem('examInstantFeedback', this.instantFeedback);
            localStorage.setItem('examSettings', JSON.stringify({
                totalTimeSeconds: this.totalTimeSeconds,
                randomizeQuestions: this.randomizeQuestions,
                randomizeOptions: this.randomizeOptions,
                keepEssayOrder: this.keepEssayOrder
            }));
        } catch (error) {
            console.warn('Failed to save settings:', error);
        }
    },

    saveExamProgress() {
        if (!this.isExamStarted || this.isExamFinished || this.questions.length === 0) return;
        try {
            const progress = {
                questions: this.questions,
                userAnswers: this.userAnswers,
                flaggedQuestions: Array.from(this.flaggedQuestions),
                timeRemaining: this.timeRemaining,
                currentQuestionIndex: this.currentQuestionIndex,
                timePerQuestion: this.timePerQuestion,
                timestamp: Date.now()
            };
            localStorage.setItem('examProgress_v2', JSON.stringify(progress));
        } catch (e) { console.warn('Failed to auto-save:', e); }
    },

    restoreExamProgress() {
        try {
            const saved = localStorage.getItem('examProgress_v2');
            if (saved) {
                const progress = JSON.parse(saved);
                // Prevent loading if older than 24 hours
                if (Date.now() - progress.timestamp > 24 * 60 * 60 * 1000) {
                    this.clearExamProgress();
                    return false;
                }
                this.questions = progress.questions;
                this.userAnswers = progress.userAnswers || {};
                this.flaggedQuestions = new Set(progress.flaggedQuestions || []);
                this.timeRemaining = progress.timeRemaining;
                this.currentQuestionIndex = progress.currentQuestionIndex || 0;
                this.timePerQuestion = progress.timePerQuestion || {};
                return true;
            }
        } catch (e) { console.warn('Failed to restore', e); }
        return false;
    },

    clearExamProgress() {
        localStorage.removeItem('examProgress_v2');
    },

    getAnsweredCount() {
        return Object.keys(this.userAnswers).length;
    },

    getFlaggedCount() {
        return this.flaggedQuestions.size;
    },

    getRemainingCount() {
        return this.questions.length - this.getAnsweredCount();
    },

    getProgressPercent() {
        if (this.questions.length === 0) return 0;
        return Math.round((this.getAnsweredCount() / this.questions.length) * 100);
    },

    getAverageTime() {
        const times = Object.values(this.timePerQuestion).filter(t => t > 0);
        if (times.length === 0) return 0;
        return Math.round(times.reduce((a, b) => a + b, 0) / times.length);
    },

    // Smart essay evaluation with detailed feedback for review mode
    evaluateEssay(userAnswer, correctAnswer) {
        if (!userAnswer || !correctAnswer) return { isCorrect: false, matchRatio: 0, matchedKeywords: [], missingKeywords: [] };

        const clean = (text) => {
            return text.toLowerCase()
                .replace(/[^\w\s]/g, ' ')
                .replace(/\s+/g, ' ')
                .trim()
                .split(' ')
                .filter(word => word.length > 1 && !this.commonWords.has(word));
        };

        const userWords = clean(userAnswer);
        const correctWords = clean(correctAnswer);

        if (correctWords.length === 0) return { isCorrect: true, matchRatio: 1, matchedKeywords: [], missingKeywords: [] };

        const matched = [];
        const missing = [];
        correctWords.forEach(word => {
            if (userWords.includes(word)) {
                matched.push(word);
            } else {
                missing.push(word);
            }
        });

        const matchRatio = matched.length / correctWords.length;
        const isCorrect = matchRatio >= 0.5; // 50% threshold = full mark

        return {
            isCorrect,
            matchRatio,
            matchedKeywords: matched,
            missingKeywords: missing
        };
    }
};
