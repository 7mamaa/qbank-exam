import { ExamState } from "./config.js";
import { Elements } from "./ui.js";

// ========== UTILITY FUNCTIONS ==========
export const Utils = {
    // DOM manipulation
    showElement(element) {
        if (element) {
            element.style.display = 'flex';
        }
    },

    hideElement(element) {
        if (element) {
            element.style.display = 'none';
        }
    },

    // Modal functions
    showModal(modalId) {
        try {
            const modal = document.getElementById(modalId);
            if (modal) {
                modal.classList.add('active');
                document.body.style.overflow = 'hidden';
            }
        } catch (e) {
            console.warn('Failed to show modal:', e);
        }
    },

    hideModal(modalId) {
        try {
            const modal = document.getElementById(modalId);
            if (modal) {
                modal.classList.remove('active');
                document.body.style.overflow = '';
            }
        } catch (e) {
            console.warn('Failed to hide modal:', e);
        }
    },

    // Loading overlay
    showLoading() {
        try {
            Elements.loadingOverlay.classList.add('active');
        } catch (e) {
            console.warn('Failed to show loading:', e);
        }
    },

    hideLoading() {
        try {
            Elements.loadingOverlay.classList.remove('active');
        } catch (e) {
            console.warn('Failed to hide loading:', e);
        }
    },

    // Show notification toast
    showNotification(message, isSuccess = true) {
        try {
            if (Elements.notificationToast) {
                Elements.notificationToast.textContent = message;
                Elements.notificationToast.style.background = isSuccess ? 'var(--success)' : 'var(--danger)';
                Elements.notificationToast.style.color = 'white';
                Elements.notificationToast.style.display = 'block';
                setTimeout(() => {
                    Elements.notificationToast.style.display = 'none';
                }, 3000);
            }
        } catch (e) {
            console.warn('Failed to show notification:', e);
        }
    },

    // Time formatting
    formatTime(seconds) {
        try {
            const m = Math.floor(seconds / 60);
            const s = seconds % 60;
            return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        } catch {
            return '00:00';
        }
    },

    // Shuffle array
    shuffleArray(array) {
        try {
            const newArray = [...array];
            for (let i = newArray.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
            }
            return newArray;
        } catch (e) {
            console.warn('Failed to shuffle array:', e);
            return array;
        }
    },

    // Parse CSV text
    parseCSV(text) {
        try {
            const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
            const result = [];
            for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
                const line = lines[lineIndex];
                if (lineIndex === 0 && line.trim().toLowerCase().startsWith('type,')) continue; // skip header

                // Parse CSV line properly handling quotes
                const cells = [];
                let curVal = '';
                let inQuotes = false;
                for (let i = 0; i < line.length; i++) {
                    const char = line[i];
                    if (inQuotes) {
                        if (char === '"') {
                            if (i + 1 < line.length && line[i + 1] === '"') {
                                curVal += '"';
                                i++;
                            } else {
                                inQuotes = false;
                            }
                        } else {
                            curVal += char;
                        }
                    } else {
                        if (char === '"') {
                            inQuotes = true;
                        } else if (char === ',') {
                            cells.push(curVal.trim());
                            curVal = '';
                        } else {
                            curVal += char;
                        }
                    }
                }
                cells.push(curVal.trim());

                // Fallback to legacy semicolon splitting if no commas found and it looks like old format
                if (cells.length === 1 && line.includes(';')) {
                    result.push(line.split(';').map(c => c.trim()));
                } else {
                    result.push(cells);
                }
            }
            return result;
        } catch (e) {
            console.warn('Failed to parse CSV:', e);
            throw new Error('Invalid CSV format at splitting layer.', { cause: e });
        }
    },

    // Process questions from parsed data
    processQuestions(data, isJson = false) {
        try {
            const questions = [];

            if (isJson) {
                const items = typeof data === 'string' ? JSON.parse(data) : data;
                if (!Array.isArray(items)) throw new Error('JSON root must be an array');

                for (let i = 0; i < items.length; i++) {
                    const item = items[i];
                    const type = item.type === 'true_false' ? 'boolean' : item.type;
                    const q = {
                        id: item.id || (i + 1),
                        type: type,
                        text: item.question || item.question_text || '',
                        image: item.image || null,
                        explain: item.explain || item.key_explain || null,   // ✅ دعم التوضيح
                        category: item.category || null,                      // ✅ دعم التصنيف
                        points: item.points || 1,
                        isEssay: type === 'written',
                        originalIndex: i
                    };
                    if (q.type === 'mcq') {
                        q.options = item.options || [];
                        q.correctAnswer = String(item.answer || item.correct_answer || '');
                    } else if (q.type === 'match') {
                        q.pairs = item.pairs || [];
                        if (q.pairs.length < 2) throw new Error(`Match question at ID ${q.id} lacks minimum 2 pairs`);
                    } else if (q.type === 'written') {
                        q.ideal_keywords = item.ideal_keywords || item.keywords || [];
                        q.correctAnswer = item.answer || item.correct_answer || (q.ideal_keywords.join(', ')) || '';
                    } else if (q.type === 'boolean') {
                        q.correctAnswer = String(item.answer !== undefined ? item.answer : (item.correct_answer || false));
                        // Only set default options if not provided by bridge (e.g. Arabic 'صح/خطأ')
                        if (!q.options || q.options.length === 0) {
                            q.options = ['true', 'false'];
                        }
                    }
                    questions.push(q);
                }
                return questions;
            }

            // CSV Processing
            for (let i = 0; i < data.length; i++) {
                const row = data[i];
                if (row.length < 2) continue; // Skip empty rows

                const typeHeader = row[0].toLowerCase();
                if (['mcq', 'match', 'written', 'true_false', 'boolean'].includes(typeHeader)) {
                    const type = typeHeader === 'true_false' ? 'boolean' : typeHeader;
                    let points = 1;
                    let category = null;
                    if (row.length >= 8) {
                        category = row[6] && row[6] !== 'N/A' && row[6] !== 'null' ? row[6].trim() : null;
                        points = parseInt(row[7]) || 1;
                    } else if (row.length >= 7) {
                        points = parseInt(row[6]) || 1;
                    }

                    const q = {
                        id: i + 1,
                        type: type,
                        text: row[1] || '',
                        points: points,
                        isEssay: type === 'written',
                        originalIndex: i,
                        image: row[4] && row[4] !== 'N/A' && row[4] !== 'null' ? row[4].trim() : null,
                        explain: row[5] && row[5] !== 'N/A' && row[5] !== 'null' ? row[5].trim() : null,
                        category: category
                    };

                    const correctAns = row[2] || '';
                    const payload = row[3] || '';

                    if (q.type === 'mcq') {
                        q.options = payload.split('|').map(x => x.trim()).filter(x => x);
                        q.correctAnswer = correctAns;
                    } else if (q.type === 'match') {
                        const pairStrings = payload.split('|').map(x => x.trim()).filter(x => x);
                        const pairs = [];
                        for (let p of pairStrings) {
                            if (!p.includes(':')) {
                                throw new Error(`ImportException at line ${i + 2}: Missing ':' in match payload '${p}'`);
                            }
                            const parts = p.split(':');
                            pairs.push({ left: parts[0].trim(), right: parts.slice(1).join(':').trim() });
                        }
                        if (pairs.length < 2) throw new Error(`ImportException at line ${i + 2}: Match question needs at least 2 pairs`);
                        q.pairs = pairs;
                    } else if (q.type === 'written') {
                        q.ideal_keywords = payload !== 'N/A' && payload ? payload.split('|').map(x => x.trim()) : [];
                    } else if (q.type === 'boolean') {
                        q.correctAnswer = correctAns;
                        q.options = payload !== 'N/A' && payload ? payload.split('|').map(x => x.trim()) : ['true', 'false'];
                    }
                    questions.push(q);
                } else {
                    // Legacy parsing (fallback) -> id, text, options(pipe), correct
                    let startIndex = row[0].toLowerCase().includes('id') ? 1 : 0;
                    if (i < startIndex) continue;
                    const id = row[0] || `Q${i + 1}`;
                    const text = row[1] || '';
                    let options = [];
                    let correctAnswer = '';
                    let image = null;
                    let explain = null;
                    if (row.length >= 6) {
                        explain = row[5] && row[5] !== 'N/A' && row[5] !== 'null' ? row[5].trim() : null;
                        image = row[4] && row[4] !== 'N/A' && row[4] !== 'null' ? row[4].trim() : null;
                        correctAnswer = row[3] || '';
                        options = (row[2] || '').split(/[|;]/).map(opt => opt.trim()).filter(x => x);
                    } else if (row.length >= 4) {
                        correctAnswer = row[3] || '';
                        options = (row[2] || '').split(/[|;]/).map(opt => opt.trim()).filter(x => x);
                    } else if (row.length === 3) {
                        const parts = (row[2] || '').split(/[|;]/).map(x => x.trim()).filter(x => x);
                        if (parts.length > 1) {
                            options = parts.slice(0, -1);
                            correctAnswer = parts[parts.length - 1];
                        }
                    }
                    const isEssay = options.length === 0 || (options.length === 1 && options[0].toUpperCase() === 'ESSAY');
                    questions.push({
                        id, type: isEssay ? 'written' : 'mcq', text, options, correctAnswer, isEssay, originalIndex: i, points: 1, image, explain
                    });
                }
            }

            return questions;
        } catch (e) {
            console.error('Failed to process questions:', e);
            throw e;
        }
    },

    // Export questions to CSV
    exportQuestionsToCSV(questions) {
        try {
            let csv = "ID;Question;Options;Correct Answer;Image;Explain;Category;Points\n";
            questions.forEach((q, idx) => {
                const id = q.id || idx + 1;
                const questionText = q.text ? q.text.replace(/;/g, ',') : '';
                let optionsStr;
                if (q.isEssay) {
                    optionsStr = 'ESSAY';
                } else {
                    optionsStr = q.options ? q.options.join('|') : 'N/A';
                }
                const correct = q.correctAnswer ? q.correctAnswer.replace(/;/g, ',') : 'N/A';
                const image = q.image || 'N/A';
                const explain = q.explain ? q.explain.replace(/;/g, ',') : 'N/A';
                const category = q.category ? q.category.replace(/;/g, ',') : 'N/A';
                const points = q.points || 1;
                csv += `${id};${questionText};${optionsStr};${correct};${image};${explain};${category};${points}\n`;
            });
            return csv;
        } catch (e) {
            console.error('Failed to export CSV:', e);
            return '';
        }
    },

    isCorrect(userAnswer, correctAnswer) {
        try {
            if (!userAnswer || !correctAnswer) return false;

            // For essay, use smart evaluation
            const question = ExamState.questions[ExamState.currentQuestionIndex];
            if (question && question.isEssay) {
                return ExamState.evaluateEssay(userAnswer, correctAnswer).isCorrect;
            }

            if (question && question.type === 'match') {
                if (!Array.isArray(userAnswer)) return false;
                let correct = 0;
                userAnswer.forEach((ans) => {
                    const originalPair = question.pairs.find(p => p.left === ans.left);
                    if (originalPair && originalPair.right === ans.right) correct++;
                });
                return correct === question.pairs.length;
            }

            const user = userAnswer.toString().trim().toLowerCase().replace(/\s+/g, ' ');
            const correct = correctAnswer.toString().trim().toLowerCase().replace(/\s+/g, ' ');

            if (user === correct) return true;

            const getPrefix = (str) => {
                const match = str.match(/^([a-z0-9]+)(?=[.):\s]|$)/i);
                return match ? match[1] : null;
            };

            const correctPrefix = getPrefix(correct);
            const userPrefix = getPrefix(user);

            if (correctPrefix && userPrefix && correctPrefix === userPrefix) return true;
            if (correctPrefix && user === correctPrefix) return true;

            return false;
        } catch (e) {
            console.warn('Failed to check answer correctness:', e);
            return false;
        }
    },

    // Safe event listener
    safeAddEventListener(element, event, handler) {
        try {
            if (element) {
                element.addEventListener(event, handler);
            }
        } catch (e) {
            console.warn('Failed to add event listener:', e);
        }
    }
};

