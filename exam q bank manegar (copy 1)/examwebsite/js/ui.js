import { ExamState } from "./config.js";
import { Utils } from "./scoring.js";
import { QuestionManager, QuestionLoader, SheetImporter } from "./questions.js";
import { Timer } from "./timer.js";
import { ExamController, EventHandlers } from "./main.js";

// ========== DOM ELEMENTS ==========
export const Elements = {
    // Main containers
    welcomeScreen: document.getElementById('welcomeScreen'),
    examInterface: document.getElementById('examInterface'),
    questionDisplay: document.getElementById('questionDisplay'),
    questionMapBottom: document.getElementById('questionMapBottom'),

    // Navigation
    mainMenuBtn: document.getElementById('mainMenuBtn'),
    mainMenu: document.getElementById('mainMenu'),
    menuOverlay: document.getElementById('menuOverlay'),
    menuClose: document.getElementById('menuClose'),
    themeToggle: document.getElementById('themeToggle'),
    focusModeBtn: document.getElementById('focusModeBtn'),
    exitFocusBtn: document.getElementById('exitFocusBtn'),
    focusModeMenuBtn: document.getElementById('focusModeMenuBtn'),
    focusModeToggle: document.getElementById('focusModeToggle'),

    // Question display
    questionNumber: document.getElementById('questionNumber'),
    questionType: document.getElementById('questionType'),
    questionText: document.getElementById('questionText'),
    optionsGrid: document.getElementById('optionsGrid'),
    essayContainer: document.getElementById('essayContainer'),
    essayInput: document.getElementById('essayInput'),
    matchContainer: document.getElementById('matchContainer'),
    matchLeftColumn: document.getElementById('matchLeftColumn'),
    matchRightColumn: document.getElementById('matchRightColumn'),
    matchInstantFeedback: document.getElementById('matchInstantFeedback'),
    feedbackContainer: document.getElementById('feedbackContainer'),
    correctAnswer: document.getElementById('correctAnswer'),
    timeSpent: document.getElementById('timeSpent'),

    // Question image (unused but kept for compatibility)
    questionImageContainer: document.getElementById('questionImageContainer'),
    questionImage: document.getElementById('questionImage'),

    // Navigation buttons
    prevBtn: document.getElementById('prevBtn'),
    nextBtn: document.getElementById('nextBtn'),
    flagBtn: document.getElementById('flagBtn'),
    flagIcon: document.getElementById('flagIcon'),
    flagText: document.getElementById('flagText'),
    finishExamBtn: document.getElementById('finishExamBtn'),

    // Stats
    answeredCount: document.getElementById('answeredCount'),
    remainingCount: document.getElementById('remainingCount'),
    flaggedCount: document.getElementById('flaggedCount'),
    progressPercent: document.getElementById('progressPercent'),
    progressFill: document.getElementById('progressFill'),

    // Map elements
    mapQuestionCount: document.getElementById('mapQuestionCount'),
    mapContainer: document.getElementById('mapContainer'),
    mapOverlay: document.getElementById('mapOverlay'),
    mobileMapToggle: document.getElementById('mobileMapToggle'),

    // Timer
    timerDisplay: document.getElementById('timerDisplay'),
    timerText: document.querySelector('.timer-text'),

    // Menu stats
    menuAnswered: document.getElementById('menuAnswered'),
    menuFlagged: document.getElementById('menuFlagged'),
    menuTime: document.getElementById('menuTime'),

    // Welcome buttons
    quickPasteBtn: document.getElementById('quickPasteBtn'),
    fileUpload: document.getElementById('fileUpload'),
    quickStartBtn: document.getElementById('quickStartBtn'),
    exportQuestionsBtn: document.getElementById('exportQuestionsBtn'),

    // Modals
    pasteModal: document.getElementById('pasteModal'),
    examSetupModal: document.getElementById('examSetupModal'),
    resultsModal: document.getElementById('resultsModal'),

    // Modal buttons
    copyTemplateBtn: document.getElementById('copyTemplateBtn'),
    copyJsonTemplateBtn: document.getElementById('copyJsonTemplateBtn'),
    loadSampleBtn: document.getElementById('loadSampleBtn'),
    loadPasteBtn: document.getElementById('loadPasteBtn'),
    startExamBtn: document.getElementById('startExamBtn'),
    resumeExamBtn: document.getElementById('resumeExamBtn'),
    reviewBtn: document.getElementById('reviewBtn'),
    exportBtn: document.getElementById('exportBtn'),
    retryBtn: document.getElementById('retryBtn'),
    tryAnotherBtn: document.getElementById('tryAnotherBtn'),

    // NEW: Export questions button in results modal
    exportQuestionsResultsBtn: document.getElementById('exportQuestionsResultsBtn'),

    // Modal inputs
    pasteTextarea: document.getElementById('pasteTextarea'),
    examDuration: document.getElementById('examDuration'),
    randomizeQuestions: document.getElementById('randomizeQuestions'),
    randomizeOptions: document.getElementById('randomizeOptions'),
    keepEssayOrder: document.getElementById('keepEssayOrder'),

    // Results display
    correctCount: document.getElementById('correctCount'),
    scorePercent: document.getElementById('scorePercent'),
    timeTaken: document.getElementById('timeTaken'),
    totalQuestions: document.getElementById('totalQuestions'),
    avgTime: document.getElementById('avgTime'),
    flaggedResults: document.getElementById('flaggedResults'),
    completionDate: document.getElementById('completionDate'),

    // Questions map
    questionsMap: document.getElementById('questionsMap'),

    // Loading & Toast
    loadingOverlay: document.getElementById('loadingOverlay'),

    // Instant feedback elements
    mcqInstantFeedback: document.getElementById('mcqInstantFeedback'),
    essayInstantFeedback: document.getElementById('essayInstantFeedback'),
    checkEssayBtn: document.getElementById('checkEssayBtn'),
    instantFeedbackMenuLabel: document.getElementById('instantFeedbackMenuLabel'),

    // Smart essay review feedback
    smartEssayReviewFeedback: document.getElementById('smartEssayReviewFeedback'),

    // Notification toast
    notificationToast: document.getElementById('notificationToast')
};


// ========== THEME MANAGER ==========
export const ThemeManager = {
    toggleTheme() {
        try {
            const isDark = document.body.classList.contains('dark-mode');
            document.body.classList.toggle('dark-mode');
            document.body.classList.toggle('light-mode');

            const icon = Elements.themeToggle.querySelector('.btn-icon');
            const text = Elements.themeToggle.querySelector('.btn-text');

            if (isDark) {
                if (icon) icon.textContent = '☀️';
                if (text) text.textContent = 'Light Mode';
            } else {
                if (icon) icon.textContent = '🌙';
                if (text) text.textContent = 'Dark Mode';
            }
        } catch (e) {
            console.error('Failed to toggle theme:', e);
        }
    },

};


// ========== MOODLE UI-APP WIRING ==========
// This block "connects the wires" between the existing Logic-App and
// the new Moodle-style UI-App. No new logic is invented here.
export const MoodleUI = {

    // Cached element refs
    el: {},

    init() {
        this.el = {
            ui: document.getElementById('moodleExamUI'),
            examTitle: document.getElementById('moodle-exam-title'),
            timerText: document.getElementById('moodle-timer-text'),
            questionNumber: document.getElementById('moodle-question-number'),
            typeBadge: document.getElementById('moodle-question-type-badge'),
            timeSpent: document.getElementById('moodle-time-spent'),
            imageContainer: document.getElementById('moodle-image-container'),
            questionText: document.getElementById('moodle-question-text'),
            optionsForm: document.getElementById('moodle-options-form'),
            essayContainer: document.getElementById('moodle-essay-container'),
            essayInput: document.getElementById('moodle-essay-input'),
            feedback: document.getElementById('moodle-instant-feedback'),
            navList: document.getElementById('moodle-nav-list'),
            answeredCount: document.getElementById('moodle-answered-count'),
            remainingCount: document.getElementById('moodle-remaining-count'),
            finishBtn: document.getElementById('moodle-finish-btn'),
            clearBtn: document.getElementById('moodle-clear-btn'),
            prevBtn: document.getElementById('moodle-prev-btn'),
            nextBtn: document.getElementById('moodle-next-btn'),
            flagBtn: document.getElementById('moodle-flag-btn'),
            flagIcon: document.getElementById('moodle-flag-icon'),
        };
        this.bindButtons();
        this.patchCore();
    },

    // ---- Bind all Moodle button events ----
    bindButtons() {
        const el = this.el;
        if (el.finishBtn) {
            el.finishBtn.addEventListener('click', () => {
                if (ExamState.isExamStarted && !ExamState.isExamFinished) {
                    ExamController.finishExam();
                }
            });
        }
        if (el.nextBtn) {
            el.nextBtn.addEventListener('click', () => {
                if (ExamState.isExamStarted && !ExamState.isExamFinished) {
                    QuestionManager.nextQuestion();
                } else if (ExamState.isReviewMode) {
                    if (ExamState.currentQuestionIndex < ExamState.questions.length - 1) {
                        QuestionManager.navigateToQuestion(ExamState.currentQuestionIndex + 1);
                    }
                }
            });
        }
        if (el.prevBtn) {
            el.prevBtn.addEventListener('click', () => {
                if (ExamState.isExamStarted || ExamState.isReviewMode) {
                    QuestionManager.prevQuestion();
                }
            });
        }
        if (el.clearBtn) {
            el.clearBtn.addEventListener('click', () => {
                if (ExamState.isReviewMode || ExamState.isExamFinished) return;
                const idx = ExamState.currentQuestionIndex;
                // Remove answer from state
                delete ExamState.userAnswers[idx];
                delete ExamState.correctAnswers[idx];
                // Clear radio buttons visually
                if (el.optionsForm) {
                    el.optionsForm.querySelectorAll('input[type="radio"]').forEach(r => { r.checked = false; });
                    el.optionsForm.querySelectorAll('label').forEach(l => l.classList.remove('moodle-selected'));
                }
                // Clear essay
                if (el.essayInput) el.essayInput.value = '';
                if (el.feedback) el.feedback.innerHTML = '';
                // Re-render map & stats
                QuestionManager.renderQuestionsMap();
                QuestionManager.updateAllStats();
                MoodleUI.updateSidebarStats();
            });
        }
        // Essay input save
        if (el.essayInput) {
            el.essayInput.addEventListener('input', () => {
                const idx = ExamState.currentQuestionIndex;
                QuestionManager.handleAnswerSelection(idx, el.essayInput.value);
            });
        }
        // Flag button
        if (el.flagBtn) {
            el.flagBtn.addEventListener('click', () => {
                if (ExamState.isExamStarted && !ExamState.isExamFinished) {
                    QuestionManager.toggleFlag();
                    const idx = ExamState.currentQuestionIndex;
                    const isFlagged = ExamState.flaggedQuestions.has(idx);
                    if (el.flagIcon) {
                        el.flagIcon.className = isFlagged ? 'fa-solid fa-flag text-red-600' : 'fa-regular fa-flag';
                    }
                    MoodleUI.renderSidebarNav();
                }
            });
        }

        // Moodle mobile map toggle
        const moodleMobileToggle = document.getElementById('moodle-mobile-map-toggle');
        const moodleSidebar = document.getElementById('moodle-sidebar');
        const moodleOverlay = document.getElementById('moodle-mobile-overlay');
        const moodleSidebarClose = document.getElementById('moodle-sidebar-close');

        const closeMoodleSidebar = () => {
            if (moodleSidebar) moodleSidebar.classList.remove('open');
            if (moodleOverlay) {
                moodleOverlay.classList.add('hidden');
            }
        };

        if (moodleMobileToggle && moodleSidebar) {
            moodleMobileToggle.addEventListener('click', () => {
                moodleSidebar.classList.add('open');
                if (moodleOverlay) {
                    moodleOverlay.classList.remove('hidden');
                }
            });
        }

        if (moodleSidebarClose) {
            moodleSidebarClose.addEventListener('click', closeMoodleSidebar);
        }

        if (moodleOverlay) {
            moodleOverlay.addEventListener('click', closeMoodleSidebar);
        }

        if (mapOverlay) {
            // Also close moodle sidebar when overlay clicked
            mapOverlay.addEventListener('click', () => {
                if (moodleSidebar) moodleSidebar.classList.remove('open');
                mapOverlay.style.display = 'none';
            });
        }

        // Add touch swipe support for moodleExamUI
        const moodleExamUI = document.getElementById('moodleExamUI');
        if (moodleExamUI) {
            let touchstartX = 0;
            let touchendX = 0;

            moodleExamUI.addEventListener('touchstart', e => {
                touchstartX = e.changedTouches[0].screenX;
            }, { passive: true });

            moodleExamUI.addEventListener('touchend', e => {
                touchendX = e.changedTouches[0].screenX;
                handleSwipe();
            }, { passive: true });

            function handleSwipe() {
                const threshold = 50;
                // Since layout is RTL, swiping right (touchendX > touchstartX) moves to the next page.
                // Swiping left (touchendX < touchstartX) moves to the previous page.
                if (touchendX > touchstartX + threshold) {
                    // Swipe right -> Next
                    if (ExamState.isExamStarted && !ExamState.isExamFinished) {
                        QuestionManager.nextQuestion();
                    } else if (ExamState.isReviewMode) {
                        if (ExamState.currentQuestionIndex < ExamState.questions.length - 1) {
                            QuestionManager.navigateToQuestion(ExamState.currentQuestionIndex + 1);
                        }
                    }
                } else if (touchendX < touchstartX - threshold) {
                    // Swipe left -> Prev
                    if (ExamState.isExamStarted || ExamState.isReviewMode) {
                        QuestionManager.prevQuestion();
                    }
                }
            }
        }
    },

    // ---- Monkey-patch core functions to push updates to Moodle UI ----
    patchCore() {
        // 1. ExamController.startExam — show Moodle UI, hide old examInterface
        const origStart = ExamController.startExam.bind(ExamController);
        ExamController.startExam = function () {
            origStart();
            // Switch visibility: hide original interface, show Moodle UI
            const origUI = document.getElementById('examInterface');
            if (origUI) origUI.style.display = 'none';
            if (MoodleUI.el.ui) MoodleUI.el.ui.style.display = 'block';
            // Hide welcome screen (already done by origStart, but ensure)
            const ws = document.getElementById('welcomeScreen');
            if (ws) ws.style.display = 'none';
        };

        // Also patch ExamController.tryAnotherSet to hide Moodle UI and show welcome
        const origTryAnother = ExamController.tryAnotherSet.bind(ExamController);
        ExamController.tryAnotherSet = function () {
            origTryAnother();
            if (MoodleUI.el.ui) MoodleUI.el.ui.style.display = 'none';
        };

        // Also patch ExamController.enterReviewMode
        const origReview = ExamController.enterReviewMode.bind(ExamController);
        ExamController.enterReviewMode = function () {
            origReview();
            // Keep Moodle UI visible during review
            if (MoodleUI.el.ui) MoodleUI.el.ui.style.display = 'block';
        };

        // 2. Timer.updateDisplay — also update Moodle timer
        const origTimerDisplay = Timer.updateDisplay.bind(Timer);
        Timer.updateDisplay = function () {
            origTimerDisplay();
            const formatted = Utils.formatTime(ExamState.timeRemaining);
            if (MoodleUI.el.timerText) {
                MoodleUI.el.timerText.textContent = formatted;
                // Warning color when < 5 min
                if (ExamState.timeRemaining < 300) {
                    MoodleUI.el.timerText.classList.add('text-red-600');
                    MoodleUI.el.timerText.classList.remove('text-blue-700');
                } else {
                    MoodleUI.el.timerText.classList.remove('text-red-600');
                    MoodleUI.el.timerText.classList.add('text-blue-700');
                }
            }
        };

        // 3. QuestionManager.renderQuestion — update moodle header fields
        const origRender = QuestionManager.renderQuestion.bind(QuestionManager);
        QuestionManager.renderQuestion = function (index) {
            origRender(index);
            MoodleUI.updateQuestionHeader(index);
            MoodleUI.updateSidebarStats();
        };

        // 4. QuestionManager.renderMCQQuestion — also inject into Moodle form
        const origMCQ = QuestionManager.renderMCQQuestion.bind(QuestionManager);
        QuestionManager.renderMCQQuestion = function (index, question) {
            origMCQ(index, question);
            MoodleUI.renderMoodleOptions(index, question);
            // hide essay/match, show options form
            if (MoodleUI.el.essayContainer) MoodleUI.el.essayContainer.style.display = 'none';
            if (MoodleUI.el.optionsForm) MoodleUI.el.optionsForm.style.display = 'flex';
            const stdMatch = document.getElementById('matchContainer');
            if (stdMatch) stdMatch.style.display = 'none';
        };

        // 5. QuestionManager.renderEssayQuestion — also handle Moodle essay
        const origEssay = QuestionManager.renderEssayQuestion.bind(QuestionManager);
        QuestionManager.renderEssayQuestion = function (index, question) {
            origEssay(index, question);
            MoodleUI.renderMoodleEssay(index);
            // hide options form, show essay container
            if (MoodleUI.el.optionsForm) MoodleUI.el.optionsForm.style.display = "none";
            if (MoodleUI.el.essayContainer) MoodleUI.el.essayContainer.style.display = "block";
            const stdMatch = document.getElementById("matchContainer");
            if (stdMatch) stdMatch.style.display = "none";
        };

        // 5b. Handle Match Question in Moodle
        const origMatch = QuestionManager.renderMatchQuestion.bind(QuestionManager);
        QuestionManager.renderMatchQuestion = function (index, question) {
            origMatch(index, question);
            // Hide Moodle forms
            if (MoodleUI.el.optionsForm) MoodleUI.el.optionsForm.style.display = "none";
            if (MoodleUI.el.essayContainer) MoodleUI.el.essayContainer.style.display = "none";
            const stdMatch = document.getElementById("matchContainer");
            if (stdMatch) stdMatch.style.display = "block";
            // Show explain in review mode for Match questions
            if (ExamState.isReviewMode && MoodleUI.el.feedback) {
                MoodleUI.el.feedback.innerHTML = '';
                MoodleUI.renderExplain(question);
            }
        };



        // 6. QuestionManager.renderQuestionsMap — also build Moodle sidebar nav
        const origMap = QuestionManager.renderQuestionsMap.bind(QuestionManager);
        QuestionManager.renderQuestionsMap = function () {
            origMap();
            MoodleUI.renderSidebarNav();
        };

        // 7. QuestionManager.updateTimeSpent — also update moodle time spent
        const origTimeSpent = QuestionManager.updateTimeSpent.bind(QuestionManager);
        QuestionManager.updateTimeSpent = function () {
            origTimeSpent();
            if (!ExamState.isReviewMode && !ExamState.isExamFinished) {
                const t = Math.floor((Date.now() - ExamState.currentQuestionStartTime) / 1000);
                if (MoodleUI.el.timeSpent) MoodleUI.el.timeSpent.textContent = `${t}s`;
            }
        };

        // 8. SheetImporter.loadExam — set exam title
        const origLoadExam = SheetImporter.loadExam.bind(SheetImporter);
        SheetImporter.loadExam = function (exam) {
            // Store title on ExamState so we can access it after load
            ExamState._examTitle = exam.title || '';
            origLoadExam(exam);
        };

        // 9. ExamController.startExam — also set title (called after loadExam)
        const wrappedStart = ExamController.startExam.bind(ExamController);
        ExamController.startExam = function () {
            wrappedStart();
            if (ExamState._examTitle && MoodleUI.el.examTitle) {
                MoodleUI.el.examTitle.textContent = ExamState._examTitle;
            }
        };
    },

    // ---- Update question header in Moodle UI ----
    // ---- Update question header in Moodle UI (With Memory-Safe Image Support) ----
    updateQuestionHeader(index) {
        const el = this.el;
        const total = ExamState.questions.length;
        const question = ExamState.questions[index];
        if (!question) return;

        if (el.questionNumber) el.questionNumber.textContent = `السؤال ${index + 1} من ${total}`;
        if (el.typeBadge) el.typeBadge.textContent = question.isEssay ? 'مقالي' : question.type === 'match' ? 'مطابقة' : question.type === 'boolean' ? 'صح/خطأ' : 'MCQ';

        // --- معالجة الصور والنصوص بأمان تام على الذاكرة ---
        let qText = question.text || '';
        let imgUrl = question.image || null; // من الـ JSON

        // دعم استخراج الرابط من النص لدعم الصيغ القديمة أو الـ CSV
        const imgRegex = /\[img:(.*?)\]/i;
        const match = qText.match(imgRegex);
        if (match && match[1]) {
            imgUrl = match[1].trim();
            qText = qText.replace(imgRegex, '').trim();
        }

        const imgContainer = document.getElementById('moodle-image-container');
        const imgTag = document.getElementById('moodle-question-image');

        if (imgUrl) {
            if (imgContainer && imgTag) {
                imgTag.src = imgUrl;
                imgContainer.style.display = 'flex';
            }
        } else {
            // Memory Cleanup — تفريغ الذاكرة إذا لم تكن هناك صورة
            if (imgContainer && imgTag) {
                imgTag.src = '';
                imgContainer.style.display = 'none';
            }
        }

        if (el.questionText) el.questionText.textContent = qText;
        if (el.feedback && !ExamState.isReviewMode) el.feedback.innerHTML = '';
        if (el.nextBtn) el.nextBtn.textContent = index === total - 1 ? '🏁 إنهاء الامتحان' : 'الصفحة التالية →';

        // Show category in review mode if it exists
        if (ExamState.isReviewMode && question.category && question.category !== 'null' && question.category !== 'N/A') {
            const catBadge = document.createElement('div');
            catBadge.className = 'mt-2 mb-2 inline-block bg-purple-100 text-purple-800 text-xs px-2 py-1 rounded border border-purple-200';
            catBadge.innerHTML = `<i class="fa-solid fa-tag"></i> تصنيف: ${question.category}`;
            if (el.questionText && el.questionText.parentNode) {
                el.questionText.parentNode.insertBefore(catBadge, el.questionText.nextSibling);
            }
        }
    },

    // ---- Render MCQ radio buttons in the Moodle form ----
    // ---- Render MCQ radio buttons ----
    renderMoodleOptions(index, question) {
        const el = this.el;
        if (!el.optionsForm) return;
        el.optionsForm.innerHTML = '';

        const userAnswer = ExamState.userAnswers[index];
        const selectedValue = userAnswer ? userAnswer.selectedValue : null;

        question.options.forEach((option, i) => {
            const optId = `moodle-opt-${index}-${i}`;
            const isSelected = selectedValue === option;

            let fbClass = '';
            if (ExamState.isReviewMode) {
                if (Utils.isCorrect(option, question.correctAnswer)) fbClass = 'bg-green-100 border-green-500';
                else if (isSelected) fbClass = 'bg-red-100 border-red-500';
            } else if (isSelected) fbClass = 'bg-white/50 border-blue-500';

            const label = document.createElement('label');
            label.className = `flex w-full items-center gap-3 p-2 hover:bg-gray-100 rounded cursor-pointer transition border border-transparent ${fbClass}`;

            const radio = document.createElement('input');
            radio.type = 'radio';
            radio.id = optId;
            radio.name = `moodle-q-${index}`;
            radio.value = option;
            radio.checked = isSelected;
            radio.disabled = ExamState.isReviewMode || ExamState.isExamFinished;

            const span = document.createElement('span');
            span.textContent = option;

            if (!ExamState.isReviewMode && !ExamState.isExamFinished) {
                label.addEventListener('click', (e) => {
                    e.preventDefault();
                    radio.checked = true;
                    el.optionsForm.querySelectorAll('label').forEach(l => l.classList.remove('bg-white/50', 'border-blue-500'));
                    label.classList.add('bg-white/50', 'border-blue-500');
                    QuestionManager.handleAnswerSelection(index, option);
                });
            }

            label.appendChild(radio);
            label.appendChild(span);
            el.optionsForm.appendChild(label);
        });

        if (ExamState.isReviewMode && el.feedback) {
            el.feedback.innerHTML = `<span style="color:var(--success)">الصواب: ${question.correctAnswer}</span>`;
            MoodleUI.renderExplain(question);
        }
    },

    // ---- Render essay textarea in Moodle UI ----
    renderMoodleEssay(index) {
        const el = this.el;
        if (!el.essayInput) return;
        const userAnswer = ExamState.userAnswers[index];
        el.essayInput.value = userAnswer ? userAnswer.selectedValue : '';
        el.essayInput.disabled = ExamState.isReviewMode || ExamState.isExamFinished;

        // Show explain + correct answer in review mode
        if (ExamState.isReviewMode && el.feedback) {
            const question = ExamState.questions[index];
            el.feedback.innerHTML = question.correctAnswer
                ? `<span style="color:var(--success)">الإجابة النموذجية: ${question.correctAnswer}</span>`
                : '';
            MoodleUI.renderExplain(question);
        }
    },

    // ---- Shared explain renderer — appends to el.feedback ----
    renderExplain(question) {
        const el = this.el;
        if (!el.feedback) return;
        if (question && question.explain && question.explain !== 'null' && question.explain !== 'N/A' && question.explain.trim() !== '') {
            el.feedback.innerHTML += `<div class="explain-box mt-3 p-3 bg-blue-50 border border-blue-200 rounded text-blue-800 text-sm flex gap-2 items-start"><i class="fa-solid fa-lightbulb mt-1 flex-shrink-0"></i><div><strong>توضيح:</strong><br>${question.explain}</div></div>`;
        }
    },

    // ---- Build sidebar question number buttons ----
    // ---- Build sidebar nav with Separation between All Types ----
    renderSidebarNav() {
        const el = this.el;
        if (!el.navList) return;
        el.navList.innerHTML = ''; // تفريغ الخريطة تماماً

        const questions = ExamState.questions;
        const groups = {
            mcq: { title: 'اختيار من متعدد', indices: [] },
            boolean: { title: 'صح/خطأ', indices: [] },
            match: { title: 'مطابقة', indices: [] },
            essay: { title: 'مقاليات', indices: [] }
        };

        // 1. تصنيف الأسئلة حسب النوع مع الحفاظ على ترتيبها الأصلي
        questions.forEach((q, idx) => {
            if (q.isEssay || q.type === 'written') groups.essay.indices.push(idx);
            else if (q.type === 'boolean') groups.boolean.indices.push(idx);
            else if (q.type === 'match') groups.match.indices.push(idx);
            else groups.mcq.indices.push(idx);
        });

        // دالة داخلية لبناء أزرار الأسئلة (لعدم تكرار الكود)
        const createBtn = (idx) => {
            const btn = document.createElement('div');

            let inner = `<span>${idx + 1}</span>`;
            if (ExamState.flaggedQuestions.has(idx)) {
                inner += `<i class="fa-solid fa-flag absolute top-[2px] right-[2px] text-red-600" style="font-size: 8px;"></i>`;
            }
            btn.innerHTML = inner;

            let cls = 'quiz-nav-btn cursor-pointer transition ';
            if (idx === ExamState.currentQuestionIndex) {
                cls += 'active-q';
            } else if (ExamState.userAnswers[idx]) {
                if (ExamState.isReviewMode || ExamState.isExamFinished) {
                    cls += ExamState.correctAnswers[idx] ? 'bg-green-200 border-green-700 ' : 'bg-red-200 border-red-700 ';
                } else {
                    cls += 'answered-q';
                }
            } else if (ExamState.flaggedQuestions.has(idx)) {
                cls += 'bg-yellow-200 border-yellow-700 ';
            }

            btn.className = cls;
            btn.addEventListener('click', () => {
                if (ExamState.isExamStarted && !ExamState.isExamFinished || ExamState.isReviewMode) {
                    QuestionManager.navigateToQuestion(idx);
                }
            });
            return btn;
        };

        // 2. بناء الأقسام في الخريطة بناءً على المجموعات
        Object.values(groups).forEach(group => {
            if (group.indices.length > 0) {
                const divider = document.createElement('div');
                divider.className = 'w-full flex flex-col gap-2 mt-4 mb-2';
                divider.innerHTML = `
                            <hr class="border-gray-300">
                            <span class="text-[10px] font-bold text-gray-400 uppercase tracking-wider">${group.title}</span>
                        `;
                el.navList.appendChild(divider);

                const container = document.createElement('div');
                container.className = 'flex flex-wrap gap-1';
                group.indices.forEach(idx => {
                    container.appendChild(createBtn(idx));
                });
                el.navList.appendChild(container);
            }
        });
    },

    // ---- Update sidebar answered/remaining counts ----
    updateSidebarStats() {
        const el = this.el;
        if (el.answeredCount) el.answeredCount.textContent = ExamState.getAnsweredCount();
        if (el.remainingCount) el.remainingCount.textContent = ExamState.getRemainingCount();
    }
};

// Initialize MoodleUI after DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    MoodleUI.init();
});
