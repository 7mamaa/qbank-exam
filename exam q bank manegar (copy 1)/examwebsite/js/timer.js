import { ExamState } from "./config.js";
import { Elements, ThemeManager, MoodleUI } from "./ui.js";
import { Utils } from "./scoring.js";
import { QuestionManager, QuestionLoader, SheetImporter } from "./questions.js";
import { ExamController, EventHandlers } from "./main.js";

// ========== TIMER MANAGEMENT ==========
        export const Timer = {
            start() {
                try {
                    clearInterval(ExamState.timerInterval);
                    ExamState.timeRemaining = ExamState.totalTimeSeconds;
                    this.updateDisplay();

                    ExamState.timerInterval = setInterval(() => {
                        if (ExamState.timeRemaining > 0) {
                            ExamState.timeRemaining--;
                            this.updateDisplay();
                            QuestionManager.updateTimeSpent();
                        } else {
                            this.stop();
                            ExamController.finishExam();
                        }
                    }, 1000);
                } catch (e) {
                    console.error('Failed to start timer:', e);
                }
            },

            stop() {
                try {
                    clearInterval(ExamState.timerInterval);
                    ExamState.timerInterval = null;
                } catch (e) {
                    console.error('Failed to stop timer:', e);
                }
            },

            updateDisplay() {
                try {
                    if (Elements.timerText) {
                        Elements.timerText.textContent = Utils.formatTime(ExamState.timeRemaining);
                    }
                    if (Elements.menuTime) {
                        Elements.menuTime.textContent = Utils.formatTime(ExamState.timeRemaining);
                    }

                    if (Elements.timerDisplay) {
                        if (ExamState.timeRemaining < 300) {
                            Elements.timerDisplay.classList.add('warning');
                        } else {
                            Elements.timerDisplay.classList.remove('warning');
                        }
                    }
                } catch (e) {
                    console.error('Failed to update timer display:', e);
                }
            },

            setDuration(minutes) {
                try {
                    ExamState.totalTimeSeconds = minutes * 60;
                    ExamState.timeRemaining = ExamState.totalTimeSeconds;
                    this.updateDisplay();
                } catch (e) {
                    console.error('Failed to set duration:', e);
                }
            }
        };

        