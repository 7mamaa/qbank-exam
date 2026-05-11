import { ExamState } from "./config.js";
import { Elements, ThemeManager, MoodleUI } from "./ui.js";
import { Utils } from "./scoring.js";
import { Timer } from "./timer.js";
import { ExamController, EventHandlers } from "./main.js";

// ========== QUESTION MANAGEMENT ==========
export const QuestionManager = {
    renderQuestion(index) {
        try {
            if (!ExamState.questions.length || index < 0 || index >= ExamState.questions.length) {
                console.warn('Invalid question index:', index);
                return;
            }

            ExamState.currentQuestionIndex = index;
            const question = ExamState.questions[index];

            Elements.questionNumber.textContent = `Question ${index + 1} of ${ExamState.questions.length}`;
            Elements.questionType.textContent = question.isEssay ? 'Essay' : 'MCQ';
            Elements.questionText.textContent = question.text;

            // Handle image rendering
            if (question.image && question.image !== 'null' && question.image !== 'N/A') {
                const img = document.createElement('img');
                img.src = question.image;
                img.style.maxWidth = '100%';
                img.style.marginTop = '1rem';
                img.style.borderRadius = '8px';
                img.style.display = 'block';
                Elements.questionText.appendChild(img);
            }

            // Hide legacy image container
            Utils.hideElement(Elements.questionImageContainer);

            this.updateFlagButton(index);
            Elements.nextBtn.innerHTML = index === ExamState.questions.length - 1 ? 'إنهاء الامتحان <span class="btn-icon">🏁</span>' : 'الصفحة التالية <span class="btn-icon">→</span>';

            Elements.optionsGrid.innerHTML = '';
            if (Elements.mcqInstantFeedback) Elements.mcqInstantFeedback.innerHTML = '';
            if (Elements.essayInstantFeedback) Elements.essayInstantFeedback.innerHTML = '';
            if (Elements.smartEssayReviewFeedback) Elements.smartEssayReviewFeedback.innerHTML = '';

            Utils.hideElement(Elements.matchContainer);

            if (question.type === 'match') {
                this.renderMatchQuestion(index, question);
            } else if (question.isEssay) {
                this.renderEssayQuestion(index, question);
            } else {
                this.renderMCQQuestion(index, question);
            }

            // Explain Injection for legacy Standard UI only (Moodle UI handles its own explain)
            const moodleUI = document.getElementById('moodleExamUI');
            const isMoodleActive = moodleUI && moodleUI.style.display !== 'none';
            if (!isMoodleActive && ExamState.isReviewMode && question.explain && question.explain !== 'null' && question.explain !== 'N/A' && question.explain.trim() !== '') {
                const explainDiv = document.createElement('div');
                explainDiv.className = 'alert alert-info mt-3 d-flex align-items-start gap-2 w-100';
                explainDiv.innerHTML = `<i class="fa-solid fa-lightbulb mt-1"></i> <div class="text-start w-100"><strong>توضيح:</strong><br>${question.explain}</div>`;
                Elements.feedbackContainer.appendChild(explainDiv);
                Utils.showElement(Elements.feedbackContainer);
            }

            this.updateTimeSpent();
            this.renderQuestionsMap();
            this.updateAllStats();

            // Update instant feedback UI for essay check button visibility
            if (question.isEssay && Elements.checkEssayBtn) {
                if (ExamState.instantFeedback && ExamState.isExamStarted && !ExamState.isExamFinished) {
                    Elements.checkEssayBtn.style.display = 'inline-flex';
                } else {
                    Elements.checkEssayBtn.style.display = 'none';
                }
            }
        } catch (e) {
            console.error('Failed to render question:', e);
        }
    },

    renderMCQQuestion(index, question) {
        try {
            Utils.hideElement(Elements.essayContainer);
            Utils.showElement(Elements.optionsGrid.parentElement);

            if (!ExamState.isReviewMode && !ExamState.isExamFinished) {
                Utils.hideElement(Elements.feedbackContainer);
            }

            const userAnswer = ExamState.userAnswers[index];
            const isCorrect = ExamState.correctAnswers[index];

            question.options.forEach((option, optionIndex) => {
                const optionId = `option-${index}-${optionIndex}`;
                const isSelected = userAnswer && userAnswer.selectedValue === option;

                let additionalClasses = '';
                if (ExamState.isReviewMode) {
                    const isOptionCorrect = Utils.isCorrect(option, question.correctAnswer);
                    if (isOptionCorrect) {
                        additionalClasses = 'review-correct';
                    } else if (isSelected) {
                        additionalClasses = 'review-wrong';
                    }
                } else if (ExamState.instantFeedback && isSelected) {
                    // In instant feedback mode, mark correct/wrong immediately
                    if (Utils.isCorrect(option, question.correctAnswer)) {
                        additionalClasses = 'instant-correct';
                    } else {
                        additionalClasses = 'instant-wrong';
                    }
                }

                const optionElement = document.createElement('div');
                optionElement.className = 'option-item';
                optionElement.innerHTML = `
                        <input type="radio" 
                               id="${optionId}" 
                               name="question-${index}" 
                               value="${option.replace(/"/g, '&quot;')}" 
                               ${isSelected ? 'checked' : ''}
                               ${(ExamState.isReviewMode || ExamState.isExamFinished) ? 'disabled' : ''}
                               class="option-input">
                        <label for="${optionId}" class="option-label ${isSelected ? 'selected' : ''} ${additionalClasses}">
                            <span class="option-marker"></span>
                            <span class="option-text">${option}</span>
                        </label>
                    `;

                if (!ExamState.isReviewMode && !ExamState.isExamFinished) {
                    const label = optionElement.querySelector('.option-label');
                    Utils.safeAddEventListener(label, 'click', (e) => {
                        e.preventDefault();
                        this.handleAnswerSelection(index, option);
                    });
                }

                Elements.optionsGrid.appendChild(optionElement);
            });

            if (ExamState.isReviewMode) {
                Elements.correctAnswer.textContent = question.correctAnswer;
                Utils.showElement(Elements.feedbackContainer);
            }

            // Show instant feedback for MCQ if enabled and already answered
            if (ExamState.instantFeedback && userAnswer) {
                this.showMCQInstantFeedback(index, question);
            }
        } catch (e) {
            console.error('Failed to render MCQ question:', e);
        }
    },

    renderEssayQuestion(index, question) {
        try {
            Utils.hideElement(Elements.optionsGrid.parentElement);
            Utils.showElement(Elements.essayContainer);

            const userAnswer = ExamState.userAnswers[index];
            Elements.essayInput.value = userAnswer ? userAnswer.selectedValue : '';
            this.updateEssayStats();

            if (!ExamState.isReviewMode && !ExamState.isExamFinished) {
                Elements.essayInput.oninput = (e) => {
                    this.handleAnswerSelection(index, e.target.value);
                    this.updateEssayStats();
                };
                Elements.essayInput.disabled = false;
            } else {
                Elements.essayInput.disabled = true;
            }

            if (ExamState.isReviewMode) {
                Elements.correctAnswer.textContent = question.correctAnswer;
                Utils.showElement(Elements.feedbackContainer);

                // Show smart essay grading feedback in review mode
                if (userAnswer) {
                    const evaluation = ExamState.evaluateEssay(userAnswer.selectedValue, question.correctAnswer);
                    let feedbackHtml = '';
                    if (evaluation.isCorrect) {
                        feedbackHtml = `<span style="color: var(--success);">✓ Correct! Match ratio: ${Math.round(evaluation.matchRatio * 100)}%</span>`;
                        if (evaluation.missingKeywords.length > 0) {
                            feedbackHtml += `<br><span style="color: var(--warning);">Missing keywords: ${evaluation.missingKeywords.join(', ')}</span>`;
                        }
                    } else {
                        feedbackHtml = `<span style="color: var(--danger);">✗ Incorrect. Match ratio: ${Math.round(evaluation.matchRatio * 100)}% (need ≥50%)</span>`;
                        feedbackHtml += `<br><span style="color: var(--warning);">Missing keywords: ${evaluation.missingKeywords.join(', ')}</span>`;
                        if (evaluation.matchedKeywords.length > 0) {
                            feedbackHtml += `<br><span style="color: var(--success);">Matched: ${evaluation.matchedKeywords.join(', ')}</span>`;
                        }
                    }
                    Elements.smartEssayReviewFeedback.innerHTML = feedbackHtml;
                }
            }

            // Clear instant feedback area
            if (Elements.essayInstantFeedback) {
                Elements.essayInstantFeedback.innerHTML = '';
            }
        } catch (e) {
            console.error('Failed to render essay question:', e);
        }
    },

    renderMatchQuestion(index, question) {
        try {
            Utils.hideElement(Elements.optionsGrid.parentElement);
            Utils.hideElement(Elements.essayContainer);
            Utils.showElement(Elements.matchContainer);

            if (!ExamState.isReviewMode && !ExamState.isExamFinished) {
                Utils.hideElement(Elements.feedbackContainer);
            }

            if (!question.pairs || question.pairs.length === 0) return;

            const userAnswer = ExamState.userAnswers[index] ? ExamState.userAnswers[index].selectedValue : [];

            let leftItems = question.pairs.map(p => p.left);
            let rightItems = question.pairs.map(p => p.right);

            if (!ExamState.isReviewMode && !ExamState.isExamFinished) {
                leftItems = Utils.shuffleArray([...leftItems]);
                rightItems = Utils.shuffleArray([...rightItems]);
            }

            Elements.matchLeftColumn.innerHTML = '<h4>Items (المصطلحات)</h4>';
            Elements.matchRightColumn.innerHTML = '<h4>Targets (الخيارات المتاحة)</h4>';

            const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
            const rightItemsMap = rightItems.map((text, i) => ({
                letter: alphabet[i] || String(i),
                text: text
            }));

            rightItemsMap.forEach(item => {
                const targetWrapper = document.createElement('div');
                targetWrapper.className = 'match-target-wrapper';
                targetWrapper.style.marginBottom = '8px';
                targetWrapper.style.padding = '8px';
                targetWrapper.style.background = 'var(--bg-secondary)';
                targetWrapper.style.border = '1px solid var(--border-light)';
                targetWrapper.style.borderRadius = 'var(--radius-md)';
                targetWrapper.innerHTML = `<strong style="color: var(--primary); margin-right: 8px;">${item.letter})</strong> ${item.text}`;
                Elements.matchRightColumn.appendChild(targetWrapper);
            });

            leftItems.forEach((leftText) => {
                const itemContainer = document.createElement('div');
                itemContainer.className = 'match-item-row';
                itemContainer.style.display = 'flex';
                itemContainer.style.alignItems = 'center';
                itemContainer.style.marginBottom = '12px';
                itemContainer.style.gap = '10px';
                itemContainer.style.padding = '12px';
                itemContainer.style.background = 'var(--bg-primary)';
                itemContainer.style.border = '1px solid var(--border-light)';
                itemContainer.style.borderRadius = 'var(--radius-md)';

                const label = document.createElement('span');
                label.style.flex = '1';
                label.style.fontWeight = '500';
                label.textContent = leftText;

                const select = document.createElement('select');
                select.className = 'match-select';
                select.dataset.left = leftText;
                select.style.padding = '8px 12px';
                select.style.borderRadius = 'var(--radius-sm)';
                select.style.border = '1px solid var(--border-color)';
                select.style.background = 'var(--bg-secondary)';
                select.style.color = 'var(--text-primary)';
                select.style.minWidth = '80px';
                select.style.cursor = 'pointer';

                const defaultOpt = document.createElement('option');
                defaultOpt.value = '';
                defaultOpt.textContent = '...';
                select.appendChild(defaultOpt);

                rightItemsMap.forEach(rItem => {
                    const opt = document.createElement('option');
                    opt.value = rItem.text;
                    opt.textContent = rItem.letter;
                    select.appendChild(opt);
                });

                if (userAnswer && Array.isArray(userAnswer)) {
                    const ans = userAnswer.find(u => u.left === leftText);
                    if (ans && ans.right) {
                        select.value = ans.right;
                    }
                }

                itemContainer.appendChild(label);
                itemContainer.appendChild(select);

                if (ExamState.isReviewMode || ExamState.isExamFinished) {
                    select.disabled = true;
                    select.style.cursor = 'default';

                    const correctMatch = question.pairs.find(p => p.left === leftText).right;
                    const isCorrect = select.value === correctMatch;

                    itemContainer.style.border = '2px solid';
                    itemContainer.style.borderColor = isCorrect ? 'var(--success)' : 'var(--danger)';

                    if (!isCorrect) {
                        const fb = document.createElement('div');
                        fb.style.fontSize = '0.85em';
                        fb.style.marginTop = '8px';
                        fb.style.paddingTop = '8px';
                        fb.style.borderTop = '1px dashed var(--border-color)';
                        fb.style.width = '100%';

                        const correctLetter = rightItemsMap.find(r => r.text === correctMatch)?.letter || '?';
                        fb.innerHTML = `<span style="color: var(--success); font-weight: 500;">Correct Match: ${correctLetter} (${correctMatch})</span>`;

                        itemContainer.style.flexWrap = 'wrap';
                        itemContainer.appendChild(fb);
                    }
                } else {
                    Utils.safeAddEventListener(select, 'change', () => {
                        this.saveMatchAnswer(index);
                    });
                }

                Elements.matchLeftColumn.appendChild(itemContainer);
            });

            if (Elements.matchInstantFeedback) Elements.matchInstantFeedback.innerHTML = '';
            if (ExamState.instantFeedback && userAnswer && userAnswer.length > 0) {
                const correctCount = userAnswer.filter(ans => {
                    const original = question.pairs.find(p => p.left === ans.left);
                    return original && original.right === ans.right;
                }).length;
                if (correctCount === question.pairs.length && userAnswer.length === question.pairs.length) {
                    if (Elements.matchInstantFeedback) Elements.matchInstantFeedback.innerHTML = '<span style="color: var(--success);">✓ Perfect Match!</span>';
                }
            }
        } catch (e) { console.error('Failed to render match question:', e); }
    },

    saveMatchAnswer(index) {
        const pairs = [];
        Elements.matchLeftColumn.querySelectorAll('.match-select').forEach(select => {
            const left = select.dataset.left;
            if (select.value) {
                pairs.push({ left: left, right: select.value });
            }
        });
        this.handleAnswerSelection(index, pairs);
    },

    // Show instant feedback for MCQ
    showMCQInstantFeedback(index, question) {
        const userAnswer = ExamState.userAnswers[index];
        if (!userAnswer) return;

        const isCorrect = Utils.isCorrect(userAnswer.selectedValue, question.correctAnswer);
        if (Elements.mcqInstantFeedback) {
            Elements.mcqInstantFeedback.innerHTML = isCorrect
                ? '<span style="color: var(--success);">✓ Correct!</span>'
                : '<span style="color: var(--danger);">✗ Incorrect. Correct answer: ' + question.correctAnswer + '</span>';
        }
    },

    // Check essay for instant feedback
    checkEssay() {
        const index = ExamState.currentQuestionIndex;
        const question = ExamState.questions[index];
        if (!question.isEssay) return;

        const userAnswer = Elements.essayInput.value;
        if (!userAnswer.trim()) {
            if (Elements.essayInstantFeedback) {
                Elements.essayInstantFeedback.innerHTML = '<span style="color: var(--warning);">⚠️ Please enter an answer.</span>';
            }
            return;
        }

        const evaluation = ExamState.evaluateEssay(userAnswer, question.correctAnswer);
        if (Elements.essayInstantFeedback) {
            Elements.essayInstantFeedback.innerHTML = evaluation.isCorrect
                ? `<span style="color: var(--success);">✓ Correct! (Keyword match: ${Math.round(evaluation.matchRatio * 100)}%)</span>`
                : `<span style="color: var(--danger);">✗ Incorrect. Match ratio: ${Math.round(evaluation.matchRatio * 100)}%. Missing: ${evaluation.missingKeywords.join(', ')}</span>`;
        }

        // Also store the answer
        this.handleAnswerSelection(index, userAnswer);
    },

    handleAnswerSelection(questionIndex, selectedValue) {
        if (ExamState.isReviewMode || ExamState.isExamFinished) return;

        try {
            ExamState.userAnswers[questionIndex] = {
                selectedValue,
                timestamp: Date.now()
            };

            const question = ExamState.questions[questionIndex];
            if (question.isEssay) {
                const evaluation = ExamState.evaluateEssay(selectedValue, question.correctAnswer);
                ExamState.correctAnswers[questionIndex] = evaluation.isCorrect;
            } else {
                ExamState.correctAnswers[questionIndex] = Utils.isCorrect(selectedValue, question.correctAnswer);
            }

            const timeSpent = Math.floor((Date.now() - ExamState.currentQuestionStartTime) / 1000);
            ExamState.timePerQuestion[questionIndex] = (ExamState.timePerQuestion[questionIndex] || 0) + timeSpent;
            ExamState.currentQuestionStartTime = Date.now();

            this.updateAllStats();
            this.renderQuestionsMap();

            // If instant feedback mode and MCQ, update feedback immediately
            if (ExamState.instantFeedback && !question.isEssay) {
                this.renderQuestion(questionIndex); // Re-render to show colors and feedback
            } else {
                this.renderQuestion(questionIndex);
            }
        } catch (e) {
            console.error('Failed to handle answer selection:', e);
        }
    },

    updateFlagButton(index) {
        const isFlagged = ExamState.flaggedQuestions.has(index);
        if (Elements.flagIcon) Elements.flagIcon.textContent = isFlagged ? '✅' : '🚩';
        if (Elements.flagText) Elements.flagText.textContent = isFlagged ? 'Unflag Question' : 'Flag Question';
        if (Elements.flagBtn) Elements.flagBtn.classList.toggle('active', isFlagged);
    },

    toggleFlag() {
        const index = ExamState.currentQuestionIndex;
        if (ExamState.flaggedQuestions.has(index)) {
            ExamState.flaggedQuestions.delete(index);
        } else {
            ExamState.flaggedQuestions.add(index);
        }
        this.updateFlagButton(index);
        this.updateAllStats();
        this.renderQuestionsMap();
    },

    updateAllStats() {
        try {
            const answered = ExamState.getAnsweredCount();
            const remaining = ExamState.getRemainingCount();
            const flagged = ExamState.getFlaggedCount();
            const progress = ExamState.getProgressPercent();

            if (Elements.answeredCount) Elements.answeredCount.textContent = answered;
            if (Elements.remainingCount) Elements.remainingCount.textContent = remaining;
            if (Elements.flaggedCount) Elements.flaggedCount.textContent = flagged;

            if (Elements.progressPercent) Elements.progressPercent.textContent = `${progress}% Complete`;
            if (Elements.progressFill) Elements.progressFill.style.width = `${progress}%`;

            const headerFill = document.getElementById('headerProgressFill');
            if (headerFill) {
                headerFill.style.width = `${progress}%`;
            }

            // Update question count in map header
            if (Elements.mapQuestionCount) {
                Elements.mapQuestionCount.textContent = ExamState.questions.length;
            }

            if (Elements.menuAnswered) {
                Elements.menuAnswered.textContent = answered;
            }
            if (Elements.menuFlagged) {
                Elements.menuFlagged.textContent = flagged;
            }
        } catch (e) {
            console.error('Failed to update stats:', e);
        }
    },

    updateTimeSpent() {
        try {
            if (ExamState.isReviewMode || ExamState.isExamFinished) {
                if (Elements.timeSpent) Elements.timeSpent.textContent = '0s';
                return;
            }

            const timeSpent = Math.floor((Date.now() - ExamState.currentQuestionStartTime) / 1000);
            if (Elements.timeSpent) Elements.timeSpent.textContent = `${timeSpent}s`;
        } catch (e) {
            console.error('Failed to update time spent:', e);
        }
    },

    updateEssayStats() {
        try {
            const text = Elements.essayInput.value;
            const charCount = text.length;
            const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;

            const charCountElement = document.getElementById('charCount');
            const wordCountElement = document.getElementById('wordCount');

            if (charCountElement) charCountElement.textContent = charCount;
            if (wordCountElement) wordCountElement.textContent = wordCount;
        } catch (e) {
            console.error('Failed to update essay stats:', e);
        }
    },

    renderQuestionsMap() {
        try {
            if (!Elements.questionsMap) return;
            Elements.questionsMap.innerHTML = '';

            const questionsToShow = ExamState.filteredQuestions.length > 0
                ? ExamState.filteredQuestions
                : ExamState.questions.map((q, idx) => ({ question: q, index: idx }));

            const groups = {
                mcq: { title: 'اختيار من متعدد', items: [] },
                boolean: { title: 'صح/خطأ', items: [] },
                match: { title: 'مطابقة', items: [] },
                essay: { title: 'مقاليات', items: [] }
            };

            questionsToShow.forEach(({ question, index }) => {
                if (question.isEssay || question.type === 'written') groups.essay.items.push({ question, index });
                else if (question.type === 'boolean') groups.boolean.items.push({ question, index });
                else if (question.type === 'match') groups.match.items.push({ question, index });
                else groups.mcq.items.push({ question, index });
            });

            Object.values(groups).forEach(group => {
                if (group.items.length > 0) {
                    const sectionTitle = document.createElement('h4');
                    sectionTitle.className = 'w-100 text-muted mt-3 mb-2';
                    sectionTitle.style.fontSize = '0.9rem';
                    sectionTitle.style.width = '100%';
                    sectionTitle.textContent = group.title;
                    Elements.questionsMap.appendChild(sectionTitle);

                    const bubbleContainer = document.createElement('div');
                    bubbleContainer.className = 'd-flex flex-wrap gap-2 w-100';

                    group.items.forEach(({ question, index }) => {
                        const bubble = document.createElement('div');
                        bubble.className = 'question-bubble';
                        bubble.textContent = index + 1;

                        if (index === ExamState.currentQuestionIndex) {
                            bubble.classList.add('active');
                        }

                        if (ExamState.userAnswers[index]) {
                            if (ExamState.isReviewMode || ExamState.isExamFinished) {
                                if (ExamState.correctAnswers[index]) {
                                    bubble.classList.add('answered');
                                } else {
                                    bubble.classList.add('answered-wrong');
                                }
                            } else {
                                bubble.classList.add('answered');
                            }
                        }

                        if (ExamState.flaggedQuestions.has(index)) {
                            bubble.classList.add('flagged');
                        }
                        if (question.isEssay) {
                            bubble.classList.add('essay');
                        }

                        Utils.safeAddEventListener(bubble, 'click', () => {
                            if (ExamState.isExamStarted && !ExamState.isExamFinished || ExamState.isReviewMode) {
                                this.navigateToQuestion(index);
                            }
                        });

                        bubbleContainer.appendChild(bubble);
                    });
                    Elements.questionsMap.appendChild(bubbleContainer);
                }
            });
        } catch (e) {
            console.error('Failed to render questions map:', e);
        }
    },

    navigateToQuestion(index) {
        try {
            if (index >= 0 && index < ExamState.questions.length) {
                const timeSpent = Math.floor((Date.now() - ExamState.currentQuestionStartTime) / 1000);
                ExamState.timePerQuestion[ExamState.currentQuestionIndex] =
                    (ExamState.timePerQuestion[ExamState.currentQuestionIndex] || 0) + timeSpent;

                ExamState.currentQuestionStartTime = Date.now();
                this.renderQuestion(index);
            }
        } catch (e) {
            console.error('Failed to navigate to question:', e);
        }
    },

    nextQuestion() {
        if (ExamState.currentQuestionIndex < ExamState.questions.length - 1) {
            this.navigateToQuestion(ExamState.currentQuestionIndex + 1);
        } else {
            ExamController.finishExam();
        }
    },

    prevQuestion() {
        if (ExamState.currentQuestionIndex > 0) {
            this.navigateToQuestion(ExamState.currentQuestionIndex - 1);
        }
    },

    firstQuestion() {
        this.navigateToQuestion(0);
    },

    lastQuestion() {
        this.navigateToQuestion(ExamState.questions.length - 1);
    },

    filterQuestions(filterType) {
        try {
            ExamState.currentFilter = filterType;

            switch (filterType) {
                case 'all':
                    ExamState.filteredQuestions = ExamState.questions.map((q, idx) => ({ question: q, index: idx }));
                    break;
                case 'unanswered':
                    ExamState.filteredQuestions = ExamState.questions
                        .map((q, idx) => ({ question: q, index: idx }))
                        .filter(({ index }) => !ExamState.userAnswers[index]);
                    break;
                case 'flagged':
                    ExamState.filteredQuestions = ExamState.questions
                        .map((q, idx) => ({ question: q, index: idx }))
                        .filter(({ index }) => ExamState.flaggedQuestions.has(index));
                    break;
                case 'essay':
                    ExamState.filteredQuestions = ExamState.questions
                        .map((q, idx) => ({ question: q, index: idx }))
                        .filter(({ question }) => question.isEssay);
                    break;
            }

            this.renderQuestionsMap();

            document.querySelectorAll('.filter-btn').forEach(btn => {
                btn.classList.remove('active');
                if (btn.dataset.filter === filterType) {
                    btn.classList.add('active');
                }
            });
        } catch (e) {
            console.error('Failed to filter questions:', e);
        }
    }
};


// ========== QUESTION LOADING ==========
export const QuestionLoader = {
    loadFromText(text, fileName = '') {
        Utils.showLoading();

        setTimeout(() => {
            try {
                let questions;
                if (fileName.toLowerCase().endsWith('.json') || text.trim().startsWith('[')) {
                    questions = Utils.processQuestions(text, true);
                } else {
                    const data = Utils.parseCSV(text);
                    questions = Utils.processQuestions(data, false);
                }

                if (!questions || questions.length === 0) {
                    throw new Error('No valid questions found in the file.');
                }

                ExamState.questions = questions;
                Utils.hideModal('pasteModal');

                // Show export button
                if (Elements.exportQuestionsBtn) {
                    Elements.exportQuestionsBtn.style.display = 'inline-flex';
                }

                this.showExamSetup();
            } catch (error) {
                console.error('Error loading questions:', error);
                alert(error.message || 'Error loading questions. Please check the format.');
            } finally {
                Utils.hideLoading();
            }
        }, 500);
    },

    copyTemplate() {
        try {
            const template = `قم بإنشاء مجموعة من الأسئلة في شكل جدول CSV جاهز للنسخ بدقة. القواعد كالتالي:
- الجدول يجب أن يحتوي على هذه الأعمدة الثمانية بالضبط، ومفصولاً باستخدام الفاصلة المنقوطة (;)
- الأعمدة هي: ID ; Question ; Options ; Correct Answer ; Image Link ; Explain ; Category ; Points
- لا تضع أي مسافات إضافية حول الفواصل المنقوطة ولا تستخدم علامات اقتباس إضافية.
- عمود (Options): افصل بين الخيارات بعلامة (|). يجب توفير الخيارات لأسئلة الاختيار من متعدد فقط. للأنواع الأخرى اكتب N/A.
- عمود (Correct Answer): ضع الإجابة الصحيحة أو true/false لصح وخطأ.
- عمود (Image Link): رابط صورة للسؤال، أو اكتب N/A إذا لم يوجد.
- عمود (Explain): توضيح لسبب الإجابة الصحيحة، أو اكتب N/A.
- عمود (Category): تصنيف السؤال (مثل: قواعد، نصوص، الفصل الأول)، أو اكتب N/A.
- عمود (Points): عدد صحيح لدرجة السؤال.
- عمود (ID): استخدم mcq، true_false، match، أو written للإشارة إلى نوع السؤال.

مثال للجدول:
ID;Question;Options;Correct Answer;Image Link;Explain;Category;Points
mcq;ما هو لون السماء؟;أزرق|أحمر|أخضر;أزرق;N/A;لأن الضوء يتشتت في الغلاف الجوي;علوم;1
true_false;الشمس كوكب;N/A;false;https://example.com/sun.png;الشمس في الحقيقة هي نجم;فلك;1
match;طابق العواصم;مصر:القاهرة|فرنسا:باريس;N/A;N/A;N/A;جغرافيا;2
written;اشرح دورة المياه;ماء|تبخر|سحاب|مطر;N/A;N/A;التبخر ثم التكثف ثم الهطول;علوم;5

الآن، قم بإنشاء 10 أسئلة متنوعة عن [اكتب الموضوع هنا] بنفس الصيغة تمامًا.`;

            navigator.clipboard.writeText(template).then(() => {
                Utils.showNotification('Template copied to clipboard!', true);
            }).catch(err => {
                console.error('Failed to copy:', err);
                Utils.showNotification('Failed to copy template.', false);
            });
        } catch (e) {
            console.error('Failed to copy template:', e);
            Utils.showNotification('Error copying template.', false);
        }
    },

    copyJsonTemplate() {
        try {
            const template = `قم بتوفير الأسئلة بصيغة مصفوفة JSON صالحة فقط، بدون أي نص خارج المصفوفة.
قواعد الحقول:
- "type": أحد القيم mcq | boolean | match | written
- "question": نص السؤال (إلزامي)
- "explain": توضيح يظهر للطالب بعد التسليم (اختياري)
- "category": تصنيف السؤال (اختياري)
- "image": رابط صورة (اختياري)
- لـ mcq: "options" (مصفوفة خيارات) + "answer" (نص الإجابة الصحيحة)
- لـ boolean: "answer": true أو false
- لـ match: "pairs": [{"left":"...","right":"..."}] (2 على الأقل)
- لـ written: "keywords": ["كلمة1","كلمة2"] للتقييم الآلي

مثال شامل لأربعة أنواع:
[
  {
    "type": "mcq",
    "question": "ما عاصمة فرنسا؟",
    "options": ["لندن", "باريس", "برلين", "روما"],
    "answer": "باريس",
    "explain": "باريس هي العاصمة الرسمية لفرنسا منذ القرن العاشر.",
    "category": "جغرافيا"
  },
  {
    "type": "boolean",
    "question": "الأرض هي أكبر كواكب المجموعة الشمسية.",
    "answer": false,
    "explain": "المشتري هو أكبر كوكب في المجموعة الشمسية."
  },
  {
    "type": "match",
    "question": "طابق بين الدولة وعاصمتها:",
    "pairs": [
      {"left": "مصر", "right": "القاهرة"},
      {"left": "ألمانيا", "right": "برلين"},
      {"left": "اليابان", "right": "طوكيو"}
    ],
    "explain": "هذه عواصم رسمية معترف بها دولياً."
  },
  {
    "type": "written",
    "question": "اشرح مفهوم الخلية النباتية.",
    "keywords": ["جدار خلوي", "بلاستيدات", "فجوة عصارية"],
    "explain": "الخلية النباتية تتميز بوجود جدار خلوي متين وبلاستيدات خضراء."
  }
]

أنشئ الآن [العدد] سؤالاً متنوعاً حول [الموضوع] بنفس الصيغة بالضبط.`;

            navigator.clipboard.writeText(template).then(() => {
                Utils.showNotification('تم نسخ قالب JSON إلى الحافظة!', true);
            }).catch(err => {
                console.error('Failed to copy JSON template:', err);
                Utils.showNotification('فشل النسخ.', false);
            });
        } catch (e) {
            console.error('Failed to copy JSON template:', e);
        }
    },

    handleFileUpload(file) {
        if (!file) return;

        Utils.showLoading();
        const reader = new FileReader();

        reader.onload = (e) => {
            setTimeout(() => {
                try {
                    let text = '';

                    if (file.name.toLowerCase().endsWith('.csv')) {
                        text = e.target.result;
                    } else if (file.name.toLowerCase().match(/\.xlsx?$/)) {
                        const data = new Uint8Array(e.target.result);
                        const workbook = XLSX.read(data, { type: 'array' });
                        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
                        const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                        text = rows.map(row => row.join(';')).join('\n');
                    } else {
                        text = e.target.result;
                    }

                    this.loadFromText(text, file.name);
                } catch (error) {
                    console.error('Error processing file:', error);
                    alert('Error processing file. Please check the format.');
                } finally {
                    Utils.hideLoading();
                }
            }, 500);
        };

        reader.onerror = () => {
            Utils.hideLoading();
            alert('Error reading file');
        };

        if (file.name.toLowerCase().endsWith('.csv') || file.name.toLowerCase().endsWith('.txt') || file.name.toLowerCase().endsWith('.json')) {
            reader.readAsText(file, 'UTF-8');
        } else {
            reader.readAsArrayBuffer(file);
        }
    },

    showExamSetup() {
        try {
            const minutes = Math.floor(ExamState.totalTimeSeconds / 60);
            if (Elements.examDuration) Elements.examDuration.value = minutes;

            if (Elements.randomizeQuestions) Elements.randomizeQuestions.checked = ExamState.randomizeQuestions;
            if (Elements.randomizeOptions) Elements.randomizeOptions.checked = ExamState.randomizeOptions;
            if (Elements.keepEssayOrder) Elements.keepEssayOrder.checked = ExamState.keepEssayOrder;

            Utils.showModal('examSetupModal');
        } catch (e) {
            console.error('Failed to show exam setup:', e);
        }
    },

    startExamWithSettings() {
        try {
            const durationValue = Elements.examDuration.value;

            if (durationValue === 'auto') {
                let durationSeconds = ExamState.questions.length * 45;
                if (durationSeconds < 60) durationSeconds = 60;
                ExamState.totalTimeSeconds = durationSeconds;
            } else {
                ExamState.totalTimeSeconds = parseInt(durationValue) * 60;
            }

            if (Elements.randomizeQuestions) {
                ExamState.randomizeQuestions = Elements.randomizeQuestions.checked;
            }
            if (Elements.randomizeOptions) {
                ExamState.randomizeOptions = Elements.randomizeOptions.checked;
            }
            if (Elements.keepEssayOrder) {
                ExamState.keepEssayOrder = Elements.keepEssayOrder.checked;
            }

            ExamState.saveSettings();

            Utils.hideModal('examSetupModal');
            ExamController.startExam();
        } catch (e) {
            console.error('Failed to start exam with settings:', e);
        }
    },

    // Export questions button handler
    exportQuestions() {
        if (ExamState.questions.length === 0) {
            alert('No questions to export.');
            return;
        }
        const csv = Utils.exportQuestionsToCSV(ExamState.questions);
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `exam-questions-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        Utils.showNotification('Questions exported successfully!', true);
    }
};


// ========== SHEET IMPORTER ==========
export const SheetImporter = {
    /** @type {Array<{title: string, questions: Array}>} */
    foundExams: [],

    init() {
        const fetchBtn = document.getElementById('fetchSheetBtn');
        const startBtn = document.getElementById('startFetchBtn');
        const urlInput = document.getElementById('sheetUrlInput');

        fetchBtn?.addEventListener('click', () => {
            if (urlInput) urlInput.value = '';
            Utils.showModal('fetchUrlModal');
        });

        startBtn?.addEventListener('click', () => {
            const url = urlInput?.value.trim() ?? '';
            if (!url) return alert('Please enter a URL.');
            this.fetchGoogleSheet(url);
        });
    },

    async fetchGoogleSheet(url) {
        try {
            const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
            if (!match) {
                alert('Invalid Google Sheets URL. Ensure it contains /d/SHEET_ID');
                return;
            }
            const sheetId = match[1];
            const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;

            Utils.showLoading();
            Utils.hideModal('fetchUrlModal');

            const response = await fetch(csvUrl);

            if (response.status === 403 || response.status === 404) {
                Utils.hideLoading();
                alert("Access Denied. Please set Sheet sharing to 'Anyone with the link can view'.");
                return;
            }
            if (!response.ok) {
                Utils.hideLoading();
                alert(`HTTP Error: ${response.status}`);
                return;
            }

            const csvText = await response.text();
            this.scanCSVForExams(csvText);
        } catch (e) {
            console.error('Fetch error:', e);
            alert('Error fetching sheet. Check your network or URL.');
            Utils.hideLoading();
        }
    },

    /**
     * Scans every cell in the parsed CSV for a JSON capsule.
     * Accepted capsule shapes:
     *   1. { "title": "...", "questions": [...] }   ← preferred
     *   2. [...]                                    ← bare array, auto-labelled
     */
    scanCSVForExams(csvText) {
        try {
            if (typeof Papa === 'undefined') {
                Utils.hideLoading();
                return alert('PapaParse library is missing!');
            }

            const parsed = Papa.parse(csvText, { quotes: true });
            const exams = [];

            for (const [rowIndex, row] of parsed.data.entries()) {
                for (const [colIndex, cell] of row.entries()) {
                    if (!cell || typeof cell !== 'string') continue;
                    const text = cell.trim();

                    // Fast pre-check: must start/end with JSON delimiters and be non-trivial
                    const looksLikeJSON =
                        (text.startsWith('{') && text.endsWith('}')) ||
                        (text.startsWith('[') && text.endsWith(']'));
                    if (!looksLikeJSON || text.length < 50) continue;

                    try {
                        const parsed = JSON.parse(text);

                        if (Array.isArray(parsed)) {
                            // Bare array — auto-label it
                            exams.push({
                                title: `نموذج مستخرج (${parsed.length} سؤال)`,
                                questions: parsed
                            });
                        } else if (parsed && typeof parsed === 'object' && Array.isArray(parsed.questions)) {
                            // Capsule object — use `title` field (with fallback)
                            exams.push({
                                title: parsed.title || parsed.exam_title || `نموذج ${exams.length + 1}`,
                                questions: parsed.questions
                            });
                        }
                    } catch {
                        console.warn(`Skipping non-JSON cell at Row ${rowIndex + 1}, Col ${colIndex + 1}`);
                    }
                }
            }

            this.foundExams = exams;
            Utils.hideLoading();

            if (exams.length === 0) {
                alert('No valid exam capsules found in this sheet.\nMake sure a cell contains a JSON object with a "title" and "questions" array.');
                return;
            }

            this.showExamSelector();
        } catch (e) {
            console.error('Parse error:', e);
            alert('Error parsing the CSV data.');
            Utils.hideLoading();
        }
    },

    showExamSelector() {
        const list = document.getElementById('examSelectorList');
        if (!list) return;
        list.innerHTML = '';

        this.foundExams.forEach((exam, index) => {
            const btn = document.createElement('button');
            btn.className = 'btn btn-secondary';
            Object.assign(btn.style, {
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: 'var(--space-md)',
                width: '100%'
            });

            const titleEl = document.createElement('span');
            titleEl.textContent = exam.title || `نموذج ${index + 1}`;
            titleEl.style.fontWeight = 'bold';

            const meta = document.createElement('span');
            meta.textContent = `${exam.questions.length} سؤال`;
            Object.assign(meta.style, {
                fontSize: '0.85em',
                color: 'var(--primary)',
                background: 'var(--border-light)',
                padding: '4px 8px',
                borderRadius: '12px'
            });

            btn.append(titleEl, meta);
            btn.addEventListener('click', () => this.loadExam(exam));
            list.appendChild(btn);
        });

        Utils.showModal('examSelectorModal');
    },

    loadExam(exam) {
        Utils.hideModal('examSelectorModal');
        Utils.showLoading();
        setTimeout(() => {
            try {
                const questions = Utils.processQuestions(exam.questions, true);
                if (!questions?.length) throw new Error('No valid questions.');

                ExamState.questions = questions;
                if (Elements.exportQuestionsBtn) Elements.exportQuestionsBtn.style.display = 'inline-flex';
                QuestionLoader.showExamSetup();
            } catch (e) {
                console.error(e);
                alert('Error loading the selected exam data.');
            } finally {
                Utils.hideLoading();
            }
        }, 500);
    }
};

