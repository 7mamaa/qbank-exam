import { ExamState } from "./config.js";
import { Elements, ThemeManager, MoodleUI } from "./ui.js";
import { Utils } from "./scoring.js";
import { QuestionManager, QuestionLoader, SheetImporter } from "./questions.js";
import { Timer } from "./timer.js";

// ========== EXAM CONTROLLER ==========
export const ExamController = {
    startExam() {
        try {
            if (ExamState.questions.length === 0) {
                return;
            }

            // --- Smart Data Bridge: Cleanup Logic ---
            const urlParams = new URLSearchParams(window.location.search);
            const sessionId = urlParams.get('session_id');
            if (sessionId) {
                localStorage.removeItem(`exam_session_${sessionId}`);
                console.log(`Bridge Cleanup: Transient data for session ${sessionId} removed.`);
            }
            // ----------------------------------------

            this.applyRandomization();

            Utils.hideElement(Elements.welcomeScreen);
            Utils.showElement(Elements.examInterface);

            Timer.start();

            ExamState.isExamStarted = true;
            ExamState.clearExamProgress();
            ExamState.isExamFinished = false;
            ExamState.isReviewMode = false;

            ExamState.currentQuestionStartTime = Date.now();

            QuestionManager.renderQuestion(0);
            QuestionManager.updateAllStats();

            // Update instant feedback UI
            this.updateInstantFeedbackUI();
        } catch (e) {
            console.error('Failed to start exam:', e);
        }
    },

    applyRandomization() {
        try {
            let questions = [...ExamState.questions];

            if (ExamState.keepEssayOrder) {
                const essayQuestions = [];
                const mcqQuestions = [];

                questions.forEach((q, idx) => {
                    if (q.isEssay) {
                        essayQuestions.push({ ...q, originalIndex: idx });
                    } else {
                        mcqQuestions.push({ ...q, originalIndex: idx });
                    }
                });

                if (ExamState.randomizeQuestions) {
                    questions = Utils.shuffleArray(mcqQuestions);
                } else {
                    questions = mcqQuestions;
                }

                questions = [...essayQuestions, ...questions].sort((a, b) => a.originalIndex - b.originalIndex);
            } else {
                if (ExamState.randomizeQuestions) {
                    questions = Utils.shuffleArray(questions);
                }
            }

            if (ExamState.randomizeOptions) {
                questions = questions.map(q => {
                    if (!q.isEssay && q.options && q.options.length > 1) {
                        const shuffledOptions = Utils.shuffleArray(q.options);

                        let correctAnswer = q.correctAnswer;
                        const originalMatch = q.correctAnswer.match(/^([A-D])[).]\s*(.+)$/i);

                        if (originalMatch) {
                            const originalText = originalMatch[2];
                            shuffledOptions.forEach(opt => {
                                const match = opt.match(/^([A-D])[).]\s*(.+)$/i);
                                if (match && match[2] === originalText) {
                                    correctAnswer = opt;
                                }
                            });
                        }

                        return {
                            ...q,
                            options: shuffledOptions,
                            correctAnswer
                        };
                    }
                    return q;
                });
            }

            ExamState.questions = questions;
        } catch (e) {
            console.error('Failed to apply randomization:', e);
        }
    },

    finishExam() {
        try {
            if (!ExamState.isExamStarted || ExamState.isExamFinished) return;

            const unanswered = ExamState.getRemainingCount();
            if (unanswered > 0) {
                if (!confirm(`You have ${unanswered} unanswered questions. Finish exam anyway?`)) {
                    return;
                }
            }

            Timer.stop();
            ExamState.isExamFinished = true;

            const results = this.calculateResults();
            this.showResults(results);
        } catch (e) {
            console.error('Failed to finish exam:', e);
        }
    },

    calculateResults() {
        try {
            let correctCount = 0;

            Object.keys(ExamState.userAnswers).forEach(index => {
                const userAnswer = ExamState.userAnswers[index].selectedValue;
                const question = ExamState.questions[index];

                if (Utils.isCorrect(userAnswer, question.correctAnswer)) {
                    correctCount++;
                }
            });

            const totalQuestions = ExamState.questions.length;
            const scorePercent = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
            const timeTaken = ExamState.totalTimeSeconds - ExamState.timeRemaining;
            const avgTime = ExamState.getAverageTime();
            const flaggedCount = ExamState.getFlaggedCount();

            return {
                correctCount,
                totalQuestions,
                scorePercent,
                timeTaken,
                avgTime,
                flaggedCount,
                completionDate: new Date().toLocaleString()
            };
        } catch (e) {
            console.error('Failed to calculate results:', e);
            return {
                correctCount: 0,
                totalQuestions: ExamState.questions.length,
                scorePercent: 0,
                timeTaken: 0,
                avgTime: 0,
                flaggedCount: 0,
                completionDate: new Date().toLocaleString()
            };
        }
    },

    showResults(results) {
        try {
            if (Elements.correctCount) Elements.correctCount.textContent = results.correctCount;
            if (Elements.scorePercent) Elements.scorePercent.textContent = `${results.scorePercent}%`;
            if (Elements.timeTaken) Elements.timeTaken.textContent = Utils.formatTime(results.timeTaken);
            if (Elements.totalQuestions) Elements.totalQuestions.textContent = results.totalQuestions;
            if (Elements.avgTime) Elements.avgTime.textContent = `${results.avgTime}s`;
            if (Elements.flaggedResults) Elements.flaggedResults.textContent = results.flaggedCount;
            if (Elements.completionDate) Elements.completionDate.textContent = results.completionDate;

            Utils.showModal('resultsModal');
        } catch (e) {
            console.error('Failed to show results:', e);
        }
    },

    retryExam() {
        try {
            ExamState.resetExamState();
            const duration = parseInt(Elements.examDuration?.value) || Math.floor(ExamState.totalTimeSeconds / 60);
            Timer.setDuration(duration);

            Utils.hideModal('resultsModal');
            this.startExam();
        } catch (e) {
            console.error('Failed to retry exam:', e);
        }
    },

    tryAnotherSet() {
        try {
            ExamState.resetExamState();
            Timer.stop();
            ExamState.isExamStarted = false;
            ExamState.isExamFinished = false;
            ExamState.isReviewMode = false;

            Utils.hideModal('resultsModal');
            Utils.hideElement(Elements.examInterface);
            Utils.showElement(Elements.welcomeScreen);

            // Show export button if questions exist
            if (ExamState.questions.length > 0 && Elements.exportQuestionsBtn) {
                Elements.exportQuestionsBtn.style.display = 'inline-flex';
            }
        } catch (e) {
            console.error('Failed to reset for new set:', e);
        }
    },

    enterReviewMode() {
        try {
            ExamState.isReviewMode = true;
            ExamState.isExamFinished = false;
            Utils.hideModal('resultsModal');

            QuestionManager.renderQuestion(0);
        } catch (e) {
            console.error('Failed to enter review mode:', e);
        }
    },

    exportResults() {
        try {
            const results = this.calculateResults();
            const data = {
                examResults: results,
                questions: ExamState.questions.map((q, idx) => {
                    let isCorrect = false;
                    let evaluation = null;
                    if (ExamState.userAnswers[idx]) {
                        if (q.isEssay) {
                            evaluation = ExamState.evaluateEssay(ExamState.userAnswers[idx].selectedValue, q.correctAnswer);
                            isCorrect = evaluation.isCorrect;
                        } else {
                            isCorrect = Utils.isCorrect(ExamState.userAnswers[idx].selectedValue, q.correctAnswer);
                        }
                    }
                    return {
                        id: q.id,
                        question: q.text,
                        type: q.isEssay ? 'Essay' : 'MCQ',
                        userAnswer: ExamState.userAnswers[idx]?.selectedValue || 'Not answered',
                        correctAnswer: q.correctAnswer,
                        isCorrect: isCorrect,
                        essayEvaluation: evaluation,
                        timeSpent: ExamState.timePerQuestion[idx] || 0,
                        flagged: ExamState.flaggedQuestions.has(idx)
                    };
                })
            };

            const json = JSON.stringify(data, null, 2);
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `exam-results-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (e) {
            console.error('Failed to export results:', e);
        }
    },

    toggleFocusMode() {
        try {
            ExamState.isFocusMode = !ExamState.isFocusMode;
            document.body.classList.toggle('focus-mode', ExamState.isFocusMode);

            const focusButtons = [Elements.focusModeBtn, Elements.focusModeMenuBtn, Elements.focusModeToggle];
            focusButtons.forEach(btn => {
                if (btn) {
                    if (ExamState.isFocusMode) {
                        btn.classList.add('active');
                        btn.innerHTML = `
                                <span class="btn-icon">👁️</span>
                                <span class="btn-text">Exit Focus</span>
                            `;
                    } else {
                        btn.classList.remove('active');
                        btn.innerHTML = `
                                <span class="btn-icon">🎯</span>
                                <span class="btn-text">Focus</span>
                            `;
                    }
                }
            });

            ExamState.saveSettings();
        } catch (e) {
            console.error('Failed to toggle focus mode:', e);
        }
    },

    // Toggle instant feedback mode
    toggleInstantFeedback() {
        try {
            ExamState.instantFeedback = !ExamState.instantFeedback;
            ExamState.saveSettings();
            this.updateInstantFeedbackUI();

            // If in exam, re-render current question to update UI
            if (ExamState.isExamStarted && !ExamState.isExamFinished) {
                QuestionManager.renderQuestion(ExamState.currentQuestionIndex);
            }
        } catch (e) {
            console.error('Failed to toggle instant feedback:', e);
        }
    },

    // Update instant feedback UI elements
    updateInstantFeedbackUI() {
        if (Elements.instantFeedbackMenuLabel) {
            Elements.instantFeedbackMenuLabel.textContent = `Instant Feedback: ${ExamState.instantFeedback ? 'ON' : 'OFF'}`;
        }

        // In essay container, show/hide check button
        if (ExamState.isExamStarted && !ExamState.isExamFinished) {
            const question = ExamState.questions[ExamState.currentQuestionIndex];
            if (question && question.isEssay && Elements.checkEssayBtn) {
                Elements.checkEssayBtn.style.display = ExamState.instantFeedback ? 'inline-flex' : 'none';
            }
        }
    }
};


// ========== EVENT LISTENERS SETUP ==========
export const EventHandlers = {
    initSaveLogic() {
        setInterval(() => {
            if (ExamState.isExamStarted && !ExamState.isExamFinished) ExamState.saveExamProgress();
        }, 5000);
        if (localStorage.getItem('examProgress_v2')) {
            try {
                const saved = JSON.parse(localStorage.getItem('examProgress_v2'));
                if (Date.now() - saved.timestamp <= 24 * 3600000 && saved.questions && saved.questions.length > 0) {
                    if (Elements.resumeExamBtn) {
                        Elements.resumeExamBtn.style.display = 'block';
                        Elements.resumeExamBtn.addEventListener('click', () => {
                            if (ExamState.restoreExamProgress()) {
                                ExamState.isExamStarted = true;
                                ExamState.clearExamProgress();
                                import('./scoring.js').then(({ Utils }) => {
                                    Utils.hideElement(Elements.welcomeScreen);
                                });
                                const origUI = document.getElementById('examInterface');
                                origUI.style.display = 'none';
                                import('./ui.js').then(({ MoodleUI }) => {
                                    if (MoodleUI.el.ui) MoodleUI.el.ui.style.display = 'block';
                                    MoodleUI.updateTimerDisplay(ExamState.timeRemaining);
                                });
                                import('./timer.js').then(({ Timer }) => {
                                    Timer.start();
                                });
                                import('./questions.js').then(({ QuestionManager }) => {
                                    QuestionManager.renderQuestion(ExamState.currentQuestionIndex);
                                    QuestionManager.renderQuestionsMap();
                                    QuestionManager.updateAllStats();
                                });
                            }
                        });
                    }
                } else { ExamState.clearExamProgress(); }
            } catch (e) { }
        }
    },
    init() {
        try {
            this.setupNavigation();
            this.setupMenu();
            this.setupModals();
            this.setupWelcomeButtons();
            this.setupExamControls();
            this.setupKeyboardShortcuts();
            this.setupTheme();
            this.setupFocusMode();
            this.setupResponsive();
            this.setupTextareaAutoResize();
        } catch (e) {
            console.error('Failed to initialize event handlers:', e);
        }
    },

    setupNavigation() {
        if (Elements.prevBtn) {
            Elements.prevBtn.addEventListener('click', () => {
                if (ExamState.isExamStarted || ExamState.isReviewMode) {
                    QuestionManager.prevQuestion();
                }
            });
        }

        if (Elements.nextBtn) {
            Elements.nextBtn.addEventListener('click', () => {
                if (ExamState.isExamStarted && !ExamState.isExamFinished) {
                    QuestionManager.nextQuestion();
                } else if (ExamState.isReviewMode) {
                    if (ExamState.currentQuestionIndex < ExamState.questions.length - 1) {
                        QuestionManager.navigateToQuestion(ExamState.currentQuestionIndex + 1);
                    }
                }
            });
        }

        if (Elements.flagBtn) {
            Elements.flagBtn.addEventListener('click', () => {
                if (ExamState.isExamStarted && !ExamState.isExamFinished) {
                    QuestionManager.toggleFlag();
                }
            });
        }

        if (Elements.finishExamBtn) {
            Elements.finishExamBtn.addEventListener('click', () => {
                if (ExamState.isExamStarted && !ExamState.isExamFinished) {
                    ExamController.finishExam();
                }
            });
        }

        // Check Essay Button
        if (Elements.checkEssayBtn) {
            Elements.checkEssayBtn.addEventListener('click', () => {
                if (ExamState.instantFeedback && ExamState.isExamStarted && !ExamState.isExamFinished) {
                    QuestionManager.checkEssay();
                }
            });
        }
    },
    setupMenu() {
        // Removed main menu references
    },

    handleMenuAction(action) {
        switch (action) {
            case 'toggle-theme':
                ThemeManager.toggleTheme();
                break;

            case 'first-question':
                if (ExamState.isExamStarted || ExamState.isReviewMode) QuestionManager.firstQuestion();
                break;
            case 'prev-question':
                if (ExamState.isExamStarted || ExamState.isReviewMode) QuestionManager.prevQuestion();
                break;
            case 'next-question':
                if (ExamState.isExamStarted || ExamState.isReviewMode) QuestionManager.nextQuestion();
                break;
            case 'last-question':
                if (ExamState.isExamStarted || ExamState.isReviewMode) QuestionManager.lastQuestion();
                break;
            case 'exam-settings':
                if (ExamState.isExamStarted) {
                    return;
                } else if (ExamState.questions.length > 0) {
                    QuestionLoader.showExamSetup();
                }
                break;
            case 'finish-exam':
                if (ExamState.isExamStarted && !ExamState.isExamFinished) {
                    ExamController.finishExam();
                }
                break;
            case 'toggle-instant-feedback':
                ExamController.toggleInstantFeedback();
                break;
            case 'export-questions-menu':
                QuestionLoader.exportQuestions();
                break;
        }
    },

    setupFocusMode() {
        const focusButtons = [Elements.focusModeBtn, Elements.focusModeMenuBtn, Elements.focusModeToggle, Elements.exitFocusBtn];
        focusButtons.forEach(btn => {
            if (btn) {
                btn.addEventListener('click', () => {
                    ExamController.toggleFocusMode();
                });
            }
        });

        if (ExamState.isFocusMode) {
            focusButtons.forEach(btn => {
                if (btn) {
                    btn.classList.add('active');
                    btn.innerHTML = `
                            <span class="btn-icon">👁️</span>
                            <span class="btn-text">Exit Focus</span>
                        `;
                }
            });
        }
    },

    setupModals() {
        document.querySelectorAll('.modal-overlay').forEach(overlay => {
            overlay.addEventListener('click', (e) => {
                const modalId = e.target.dataset.modalClose;
                if (modalId) {
                    Utils.hideModal(modalId);
                }
            });
        });

        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const modal = e.target.closest('.modal');
                if (modal) {
                    Utils.hideModal(modal.id);
                }
            });
        });

        if (Elements.copyTemplateBtn) {
            Elements.copyTemplateBtn.addEventListener('click', () => {
                QuestionLoader.copyTemplate();
            });
        }

        if (Elements.copyJsonTemplateBtn) {
            Elements.copyJsonTemplateBtn.addEventListener('click', () => {
                QuestionLoader.copyJsonTemplate();
            });
        }

        if (Elements.loadPasteBtn) {
            Elements.loadPasteBtn.addEventListener('click', () => {
                const text = Elements.pasteTextarea.value.trim();
                if (text) {
                    QuestionLoader.loadFromText(text);
                }
            });
        }

        if (Elements.startExamBtn) {
            Elements.startExamBtn.addEventListener('click', () => {
                QuestionLoader.startExamWithSettings();
            });
        }

        if (Elements.reviewBtn) {
            Elements.reviewBtn.addEventListener('click', () => {
                ExamController.enterReviewMode();
            });
        }

        if (Elements.exportBtn) {
            Elements.exportBtn.addEventListener('click', () => {
                ExamController.exportResults();
            });
        }

        if (Elements.retryBtn) {
            Elements.retryBtn.addEventListener('click', () => {
                ExamController.retryExam();
            });
        }

        // Setup finish exam button
        if (Elements.finishExamBtn) {
            Elements.finishExamBtn.addEventListener('click', () => {
                ExamController.confirmFinish();
            });
        }

        // Mobile map slider toggle
        if (Elements.mobileMapToggle) {
            Elements.mobileMapToggle.addEventListener("click", () => {
                if (Elements.mapContainer) Elements.mapContainer.classList.toggle("open");
                const moodleSidebar = document.getElementById("moodle-sidebar");
                if (moodleSidebar) moodleSidebar.classList.toggle("open");
                if (Elements.mapOverlay) Elements.mapOverlay.classList.toggle("active");
            });
        }
        if (Elements.mapOverlay) {
            Elements.mapOverlay.addEventListener("click", () => {
                if (Elements.mapContainer) Elements.mapContainer.classList.remove("open");
                const moodleSidebar = document.getElementById("moodle-sidebar");
                if (moodleSidebar) moodleSidebar.classList.remove("open");
                Elements.mapOverlay.classList.remove("active");
            });
        }

        if (Elements.tryAnotherBtn) {
            Elements.tryAnotherBtn.addEventListener('click', () => {
                ExamController.tryAnotherSet();
            });
        }

        // NEW: Export Questions Results Button
        if (Elements.exportQuestionsResultsBtn) {
            Elements.exportQuestionsResultsBtn.addEventListener('click', () => {
                QuestionLoader.exportQuestions();
            });
        }
    },

    setupWelcomeButtons() {
        if (Elements.quickPasteBtn) {
            Elements.quickPasteBtn.addEventListener('click', () => {
                Utils.showModal('pasteModal');
                Elements.pasteTextarea.value = '';
                setTimeout(() => {
                    if (Elements.pasteTextarea) {
                        Elements.pasteTextarea.focus();
                    }
                }, 100);
            });
        }

        // Quick start button - now just opens paste modal
        if (Elements.quickStartBtn) {
            Elements.quickStartBtn.addEventListener('click', () => {
                Utils.showModal('pasteModal');
            });
        }

        if (Elements.fileUpload) {
            Elements.fileUpload.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    QuestionLoader.handleFileUpload(file);
                    e.target.value = '';
                }
            });
        }

        // Export Questions Button on Welcome Screen
        if (Elements.exportQuestionsBtn) {
            Elements.exportQuestionsBtn.addEventListener('click', () => {
                QuestionLoader.exportQuestions();
            });
        }
    },

    setupExamControls() {
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const filterType = e.currentTarget.dataset.filter;
                QuestionManager.filterQuestions(filterType);
            });
        });
    },

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if (e.target.matches('input, textarea, select') || e.target.isContentEditable) {
                return;
            }

            switch (e.key) {
                case 'Escape':
                    this.handleEscapeKey();
                    break;
            }

            if (ExamState.isExamStarted && !ExamState.isExamFinished || ExamState.isReviewMode) {
                switch (e.key) {
                    case 'ArrowLeft':
                    case 'a':
                    case 'A':
                        e.preventDefault();
                        QuestionManager.prevQuestion();
                        break;
                    case 'ArrowRight':
                    case 'd':
                    case 'D':
                        e.preventDefault();
                        if (ExamState.isExamStarted && !ExamState.isExamFinished) {
                            QuestionManager.nextQuestion();
                        } else if (ExamState.isReviewMode) {
                            if (ExamState.currentQuestionIndex < ExamState.questions.length - 1) {
                                QuestionManager.navigateToQuestion(ExamState.currentQuestionIndex + 1);
                            }
                        }
                        break;
                    case ' ':
                        if (!e.target.matches('button, input, textarea, select')) {
                            e.preventDefault();
                            this.handleSpaceKey();
                        }
                        break;
                    case 'f':
                    case 'F':
                        if (!e.ctrlKey) {
                            e.preventDefault();
                            QuestionManager.toggleFlag();
                        }
                        break;
                    case '1':
                    case '2':
                    case '3':
                    case '4':
                    case '5':
                    case '6':
                    case '7':
                    case '8':
                    case '9':
                        this.handleNumberKey(parseInt(e.key));
                        break;
                }
            }
        });
    },

    handleEscapeKey() {
        const openModal = document.querySelector('.modal.active');
        if (openModal) {
            Utils.hideModal(openModal.id);
        } else if (ExamState.isFocusMode) {
            ExamController.toggleFocusMode();
        }
    },

    handleSpaceKey() {
        const currentQuestion = ExamState.questions[ExamState.currentQuestionIndex];
        if (!currentQuestion.isEssay && currentQuestion.options.length > 0 && !ExamState.isReviewMode) {
            const firstOption = currentQuestion.options[0];
            QuestionManager.handleAnswerSelection(ExamState.currentQuestionIndex, firstOption);
        }
    },

    handleNumberKey(number) {
        const questionIndex = number - 1;
        if (questionIndex >= 0 && questionIndex < ExamState.questions.length) {
            QuestionManager.navigateToQuestion(questionIndex);
        }
    },

    setupTheme() {
        if (Elements.themeToggle) {
            Elements.themeToggle.addEventListener('click', () => {
                ThemeManager.toggleTheme();
            });
        }
    },

    setupResponsive() {
        ExamState.detectMobile();
    },

    setupTextareaAutoResize() {
        const autoResizeTextarea = (textarea) => {
            if (!textarea) return;

            textarea.style.height = 'auto';
            textarea.style.height = (textarea.scrollHeight) + 'px';
        };

        if (Elements.pasteTextarea) {
            Elements.pasteTextarea.addEventListener('input', function () {
                autoResizeTextarea(this);
            });
        }

        if (Elements.essayInput) {
            Elements.essayInput.addEventListener('input', function () {
                autoResizeTextarea(this);
            });
        }
    }
};


// ========== INITIALIZATION ==========

// ========== DROPDOWN MANAGER (v8 Style) ==========
export const DropdownManager = {
    init() {
        const selects = ['examDuration'];
        selects.forEach(id => {
            const selectEl = document.getElementById(id);
            if (!selectEl) return;

            if (document.getElementById(`v8-dd-${id}`)) return;

            const wrapper = document.createElement('div');
            wrapper.className = 'v8-dropdown';
            wrapper.id = `v8-dd-${id}`;
            wrapper.tabIndex = 1;
            
            const span = document.createElement('span');
            span.textContent = selectEl.options[selectEl.selectedIndex]?.text || 'Select...';
            
            const ul = document.createElement('ul');
            ul.className = 'dropdown-menu';

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

            this.sync(id);
        });

        document.addEventListener('click', () => {
            document.querySelectorAll('.v8-dropdown').forEach(d => d.classList.remove('active'));
        });
    },

    sync(id) {
        const selectEl = document.getElementById(id);
        const wrapper = document.getElementById(`v8-dd-${id}`);
        if (!selectEl || !wrapper) return;

        const ul = wrapper.querySelector('.dropdown-menu');
        const span = wrapper.querySelector('span');
        
        ul.innerHTML = '';
        Array.from(selectEl.options).forEach(opt => {
            const li = document.createElement('li');
            li.textContent = opt.text;
            li.addEventListener('click', (e) => {
                selectEl.value = opt.value;
                span.textContent = opt.text;
                selectEl.dispatchEvent(new Event('change'));
                wrapper.classList.remove('active');
                e.stopPropagation();
            });
            ul.appendChild(li);
        });
        span.textContent = selectEl.options[selectEl.selectedIndex]?.text || 'Select...';
    }
};

// ========== INITIALIZATION ==========
document.addEventListener('DOMContentLoaded', () => {
    try {
        SheetImporter.init();
        // Initialize state
        ExamState.init();

        // Initialize event handlers
        EventHandlers.init();

        // Init Modern Dropdowns
        DropdownManager.init();

        // --- Smart Data Bridge: Reception Logic ---
        const urlParams = new URLSearchParams(window.location.search);
        const sessionId = urlParams.get('session_id');

        if (sessionId) {
            const storageKey = `exam_session_${sessionId}`;
            const cachedData = localStorage.getItem(storageKey);

            if (cachedData) {
                try {
                    const importedQuestions = JSON.parse(cachedData);
                    
                    if (Array.isArray(importedQuestions) && importedQuestions.length > 0) {
                        console.log(`Bridge Data Received: ${importedQuestions.length} questions loaded.`);
                        
                        // Inject into ExamState
                        import('./scoring.js').then(({ Utils }) => {
                            ExamState.questions = Utils.processQuestions(importedQuestions, true);
                            
                            // Show export button if questions exist
                            if (Elements.exportQuestionsBtn) Elements.exportQuestionsBtn.style.display = 'inline-flex';
                            
                            // Show Setup Modal immediately
                            import('./questions.js').then(({ QuestionLoader }) => {
                                QuestionLoader.showExamSetup();
                                
                                // Optional: Clear transient data to keep storage clean
                                // localStorage.removeItem(storageKey);
                            });
                        });
                    }
                } catch (e) {
                    console.error("Bridge Parsing Error:", e);
                }
            }
        }
        // ------------------------------------------

        // Update timer display
        Timer.updateDisplay();

        // Setup textarea stats
        if (Elements.pasteTextarea) {
            Elements.pasteTextarea.addEventListener('input', () => {
                const text = Elements.pasteTextarea.value;
                const lines = text.split('\n').filter(line => line.trim()).length;
                const chars = text.length;

                const lineCountElement = document.getElementById('lineCount');
                const charCountElement = document.getElementById('textareaCharCount');

                if (lineCountElement) lineCountElement.textContent = lines;
                if (charCountElement) charCountElement.textContent = chars;
            });
        }

        // Setup essay input stats
        if (Elements.essayInput) {
            Elements.essayInput.addEventListener('input', () => {
                QuestionManager.updateEssayStats();
            });
        }

        // Close modals with Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const activeModal = document.querySelector('.modal.active');
                if (activeModal) {
                    Utils.hideModal(activeModal.id);
                }
            }
        });

        // Handle resize
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                ExamState.detectMobile();
                QuestionManager.renderQuestionsMap();
            }, 250);
        });

        // Handle orientation change
        window.addEventListener('orientationchange', () => {
            setTimeout(() => {
                window.dispatchEvent(new Event('resize'));
            }, 300);
        });

        // Update instant feedback UI
        ExamController.updateInstantFeedbackUI();

    } catch (e) {
        console.error('Failed to initialize exam system:', e);
    }
});

// Handle beforeunload
window.addEventListener('beforeunload', (e) => {
    if (ExamState.isExamStarted && !ExamState.isExamFinished) {
        e.preventDefault();
        e.returnValue = 'You have an ongoing exam. Are you sure you want to leave?';
        return e.returnValue;
    }
});

// Handle visibility change
document.addEventListener('visibilitychange', () => {
    if (document.hidden && ExamState.isExamStarted && !ExamState.isExamFinished) {
        // Silent warning - no toast
    }
});

// Handle offline/online
window.addEventListener('offline', () => {
    // Silent - no toast
});

window.addEventListener('online', () => {
    // Silent - no toast
});

// Make key functions globally available for debugging
window.debug = {
    ExamState,
    Utils,
    QuestionManager,
    ExamController,
    QuestionLoader,
    reload: () => location.reload()
};

