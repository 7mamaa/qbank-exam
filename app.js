/* global pako */
import { i18n } from './src/core/i18n.js?v=16.6.0';
import { db } from './src/core/db.js?v=16.6.0';
import { Migrations } from './src/core/migrations.js?v=16.6.0';
import { state } from './src/core/state.js?v=16.6.0';
import { ThemeManager } from './src/ui/theme.js?v=16.6.0';
import { AudioManager } from './src/ui/audio.js?v=16.6.0';
import { QueryEngine } from './src/core/query.js?v=16.6.0';
import { NotebookModule } from './src/modules/notebooks.js?v=16.6.0';
import { QuestionModule } from './src/modules/questions.js?v=16.6.0';
import { QuizModule } from './src/modules/quiz.js?v=16.6.0';
import { ExportModule } from './src/modules/export.js?v=16.6.0';
import { AIModule } from './src/modules/ai.js?v=16.6.0';
import DuplicatesUI from './src/modules/duplicates-ui.js?v=16.6.0';
import { UIComponents } from './src/ui/components.js?v=16.6.0';
import { Helpers } from './src/utils/helpers.js?v=16.6.0';
import { Logger } from './src/utils/logger.js?v=16.6.0';

// Central Telemetry & Global Error Radar
window.onerror = (msg, url, line, col, error) => {
    Logger.error('GlobalWindow', `Crash at ${line}:${col} in ${url}`, error || msg);
    return false; // Let browser handle default logging too
};

window.addEventListener('unhandledrejection', (event) => {
    Logger.warn('GlobalAsync', 'Broken promise chain detected', event.reason);
});

/**
 * @file app.js
 * @description Main Application Controller for QBank.
 * Orchestrates communication between modules and handles global app state/events.
 */

export const app = {
    /** @type {Object} Central state reference */
    state: state,

    /** @type {Object} Undo/Redo history stacks */
    history: { undo: [], redo: [] },

    /**
     * Proxies question selection to the Universal Query Engine.
     * @param {Object} [overrideCriteria] - Custom filter criteria.
     * @returns {Array} Pool of selected questions.
     */
    getQueryPool(overrideCriteria = null) {
        if (overrideCriteria) return QueryEngine.getQueryPool(overrideCriteria);
        
        const scope = document.querySelector('input[name="export-scope"]:checked')?.value || 'all';
        
        let pool = [...state.questions];
        
        if (scope === 'selected') {
            pool = pool.filter(q => state.selectedIds.has(q.id));
        } else if (scope === 'filtered') {
            pool = state.virtual.filteredQuestions || pool;
        } else if (scope === 'custom') {
            const isRandom = document.getElementById('export-smart-random')?.checked;
            const randomCount = parseInt(document.getElementById('export-random-count')?.value) || 10;
            
            const criteria = { ...state.selectionCriteria };
            if (isRandom) criteria.randomLimit = randomCount;
            
            pool = QueryEngine.getQueryPool(criteria);
        }
        
        // Apply Sort Order from UI
        const sortOrder = document.getElementById('export-sort-order')?.value;
        if (sortOrder === 'random') {
            pool.sort(() => Math.random() - 0.5);
        } else if (sortOrder === 'longest') {
            pool.sort((a, b) => b.question.length - a.question.length);
        } else if (sortOrder === 'shortest') {
            pool.sort((a, b) => a.question.length - b.question.length);
        } else if (sortOrder === 'difficulty') {
            const diffMap = { 'easy': 1, 'medium': 2, 'hard': 3 };
            pool.sort((a, b) => (diffMap[a.difficulty] || 0) - (diffMap[b.difficulty] || 0));
        }

        return pool;
    },

    /**
     * Initializes the application.
     * Loads settings, binds events, and synchronizes initial data.
     */
    async init() {
        console.log('[App] Initializing v16.6.0 (Stable)...');
        this.initTheme();
        this.initLanguage();
        this.initDirection();
        this.initFontSize();
        this.initInstitution();
        this.bindEvents();

        this.exportSelectedFormat = 'json';

        // Request persistent storage so the browser never evicts IndexedDB data under pressure
        if (navigator.storage && navigator.storage.persist) {
            navigator.storage.persist().then(granted => {
                console.log(`[PWA] Persistent storage granted: ${granted}`);
            });
        }

        // Cross-tab communication for data integrity
        this.syncChannel = new BroadcastChannel('qbank_sync_channel');
        this.syncChannel.onmessage = (event) => {
            if (event.data === 'sync') {
                console.log("External sync detected. Refreshing state...");
                this.syncData(false);
            }
        };

        try {
            await db.init();
            // Init dropdowns BEFORE syncData so V8 wrappers exist when updateNotebookDropdowns runs
            this.initCustomDropdowns();
            await this.syncData();
            // Run Schema Migrations
            const migrationResult = await Migrations.run(this.state.questions);
            if (migrationResult) await this.loadQuestions();

            // Global Error Handlers
            window.addEventListener('error', (event) => this.handleError(event.error, 'Global Runtime Error'));
            window.addEventListener('unhandledrejection', (event) => this.handleError(event.reason, 'Unhandled Promise Rejection'));

            // Handle Deep Linking (e.g., index.html?edit=123)
            const urlParams = new URLSearchParams(window.location.search);
            const editId = urlParams.get('edit');
            if (editId) {
                this.navigate('questions');
                setTimeout(() => this.editQuestion(editId), 500);
            }

            // Initialize local/dynamic references hub
            if (ExportModule && typeof ExportModule.initReferenceHub === 'function') {
                ExportModule.initReferenceHub();
            }
            this.applyReferenceHubHints();

        } catch (e) {
            this.handleError(e, "App Initialization failed");
        }
    },

    /**
     * Centralized Error Handler.
     * Logs the error and notifies the user via Toast.
     * @param {Error|string} error - The error object or message.
     * @param {string} [context] - Where the error occurred.
     */
    handleError(error, context = '') {
        Logger.error(context || 'App', i18n.t('err_unexpected'), error);
        
        UIComponents.showToast(
            `⚠️ ${context ? context + ': ' : ''} ${i18n.t('err_unexpected')}`,
            'error'
        );
    },

    /**
     * Synchronizes local state with IndexedDB and refreshes all UI components.
     * Uses batch loading for questions to prevent UI freezing with large datasets.
     * @param {boolean} [broadcast=true] - Whether to notify other open tabs.
     */
    async syncData(broadcast = true) {
        try {
            // 1. Load Notebooks
            this.state.notebooks = await db.getAll('notebooks');

            // 2. Load Questions in Batches using keyset pagination (O(1) per batch seek)
            const totalQuestions = await db.count('questions');
            const batchSize = 250;
            let loadedQuestions = [];
            let lastKey = null; // Keyset anchor: IDB primary key of the last record in the previous batch

            while (loadedQuestions.length < totalQuestions) {
                const batch = await db.getBatch('questions', batchSize, lastKey);
                if (batch.length === 0) break;
                loadedQuestions = loadedQuestions.concat(batch);
                // Advance the keyset anchor to the last record's primary key
                const lastRecord = batch[batch.length - 1];
                lastKey = lastRecord.id ?? lastRecord.qNumber ?? null;

                if (totalQuestions > 500) {
                    await new Promise(resolve => setTimeout(resolve, 0));
                }
            }
            this.state.questions = loadedQuestions;
            
            // Pre-calculate unique categories and tags for Selection Hub performance
            this.state.availableCategories = [...new Set(loadedQuestions.map(q => q.category).filter(Boolean))].sort();
            this.state.availableTags = [...new Set(loadedQuestions.flatMap(q => q.tags || []).filter(Boolean))].sort();

            // Always reset filteredQuestions to the full loaded set so undo/redo never
            // leaves a stale filtered view. The active filter will re-apply on renderQuestions().
            this.state.virtual.filteredQuestions = [...loadedQuestions];
            this.state.virtual.currentPage = 1;

            // 3. Refresh UI (Batched in animation frame to avoid reflow thrashing)
            requestAnimationFrame(() => {
                this.updateDashboard();
                this.updateNotebookDropdowns();
                this.updateFilterDropdowns();
                this.updateTagsDatalist();
                
                const viewsRequiringRefresh = {
                    'questions': () => this.renderQuestions(),
                    'notebooks': () => this.renderNotebooks(),
                    'export-hub': () => {
                        this.renderSelectionHub();
                        this.updateExportScopeCounts();
                    }
                };

                if (viewsRequiringRefresh[this.state.currentView]) {
                    viewsRequiringRefresh[this.state.currentView]();
                }

                this.updateHistoryButtons();
            });

            if (broadcast && this.syncChannel) {
                this.syncChannel.postMessage('sync');
            }
        } catch (e) {
            this.handleError(e, "Sync failed");
        }
    },

    /**
     * Delegates migration/maintenance tasks to the Migrations engine.
     */
    async migrateQuestions() {
        const changed = await Migrations.run(this.state.questions);
        if (changed) await this.loadQuestions();
    },

    // === Theme & Localization Logic ===

    initTheme() { ThemeManager.initTheme(() => this.updateSoundIcon()); },
    setTheme(theme) { ThemeManager.setTheme(theme, (t) => this.playSound(t), () => this.updateSoundIcon()); },
    setRandomTheme() { ThemeManager.setRandomTheme((t) => this.playSound(t), () => this.updateSoundIcon()); },
    initDirection() { ThemeManager.initDirection(() => this.updateDirectionButtons()); },
    setDirection(dir) { 
        ThemeManager.setDirection(dir, () => this.renderQuestions(), () => this.updateDirectionButtons()); 
        const lang = (dir === 'rtl') ? 'ar' : 'en';
        if (state.language !== lang) this.setLanguage(lang);
    },
    updateDirectionButtons() { ThemeManager.updateDirectionButtons(); },

    initLanguage() { 
        i18n.init(); 
        this.updateDirectionButtons(); 
        document.addEventListener('languageChanged', () => {
            if (this.state.currentView === 'questions') this.renderQuestions();
            this.updateBulkSelectionUI();
            this.applyReferenceHubHints();
        });
    },
    setLanguage(lang) { 
        i18n.setLanguage(lang); 
        this.renderQuestions(); 
        this.updateDirectionButtons();
        this.updateDashboard();
        this.applyReferenceHubHints();
    },

    // ── Feature 3: Font Size Control ─────────────────────────────────────────
    initFontSize() {
        const saved = localStorage.getItem('qbank_font_size');
        if (saved) {
            document.documentElement.style.fontSize = saved + 'px';
            const slider = document.getElementById('font-size-slider');
            const label  = document.getElementById('font-size-value');
            if (slider) slider.value = saved;
            if (label)  label.textContent = saved + 'px';
        }
    },

    setFontSize(val) {
        const size = parseInt(val);
        document.documentElement.style.fontSize = size + 'px';
        const label = document.getElementById('font-size-value');
        if (label) label.textContent = size + 'px';
        localStorage.setItem('qbank_font_size', size);
    },

    // ── Feature 6: Institution Identity ──────────────────────────────────────
    initInstitution() {
        const data = JSON.parse(localStorage.getItem('qbank_institution') || '{}');
        if (data.name) {
            const nameEl = document.getElementById('institution-name');
            if (nameEl) nameEl.value = data.name;
        }
        if (data.logo) {
            const preview = document.getElementById('institution-logo-preview');
            if (preview) { preview.src = data.logo; preview.style.display = 'block'; }
        }
    },

    saveInstitution() {
        const name = document.getElementById('institution-name')?.value || '';
        const logo = document.getElementById('institution-logo-b64')?.value || '';
        localStorage.setItem('qbank_institution', JSON.stringify({ name, logo }));
        this.showToast(i18n.t('msg_institution_saved'), 'success');
    },

    clearInstitution() {
        if (!confirm(i18n.t('msg_institution_confirm'))) return;
        localStorage.removeItem('qbank_institution');
        
        const nameEl = document.getElementById('institution-name');
        if (nameEl) nameEl.value = '';
        
        const b64 = document.getElementById('institution-logo-b64');
        if (b64) b64.value = '';
        
        const preview = document.getElementById('institution-logo-preview');
        if (preview) { preview.src = ''; preview.style.display = 'none'; }
        
        this.showToast(i18n.t('msg_institution_cleared'), 'info');
    },

    handleInstitutionLogoUpload(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            document.getElementById('institution-logo-b64').value = ev.target.result;
            const preview = document.getElementById('institution-logo-preview');
            if (preview) { preview.src = ev.target.result; preview.style.display = 'block'; }
        };
        reader.readAsDataURL(file);
    },

    /** Returns institution data from localStorage */
    getInstitution() {
        return JSON.parse(localStorage.getItem('qbank_institution') || '{}');
    },

    // ── Feature 2: Custom Theme Maker ─────────────────────────────────────────
    applyCustomTheme() {
        const primary  = document.getElementById('theme-primary')?.value  || '#4361ee';
        const bgMain   = document.getElementById('theme-bg-main')?.value   || '#f5f7fb';
        const cardBg   = document.getElementById('theme-card-bg')?.value   || '#ffffff';
        const textTitle = document.getElementById('theme-text-title')?.value || '#1a202c';

        const root = document.documentElement;
        root.style.setProperty('--primary', primary);
        root.style.setProperty('--primary-hover', primary);
        root.style.setProperty('--bg-main', bgMain);
        root.style.setProperty('--card-bg', cardBg);
        root.style.setProperty('--sidebar-bg', cardBg);
        root.style.setProperty('--text-title', textTitle);

        // Persist as a "custom" theme
        const customVars = { primary, bgMain, cardBg, textTitle };
        localStorage.setItem('qbank_custom_theme', JSON.stringify(customVars));
        this.showToast(i18n.t('msg_theme_applied'), 'success');
    },

    initCustomTheme() {
        const saved = localStorage.getItem('qbank_custom_theme');
        if (!saved) return;
        try {
            const v = JSON.parse(saved);
            const root = document.documentElement;
            root.style.setProperty('--primary', v.primary);
            root.style.setProperty('--bg-main', v.bgMain);
            root.style.setProperty('--card-bg', v.cardBg);
            root.style.setProperty('--sidebar-bg', v.cardBg);
            root.style.setProperty('--text-title', v.textTitle);
            // Sync color pickers
            if (document.getElementById('theme-primary')) {
                document.getElementById('theme-primary').value = v.primary;
                document.getElementById('theme-bg-main').value = v.bgMain;
                document.getElementById('theme-card-bg').value = v.cardBg;
                document.getElementById('theme-text-title').value = v.textTitle;
            }
        } catch { /* ignore corrupt saved theme */ }
    },

    // ── Feature 5: QR Code Generator ─────────────────────────────────────────
    showQRCode(questionId) {
        this.currentQrQuestionId = questionId;
        const modeSelect = document.getElementById('qr-content-mode');
        if (modeSelect) modeSelect.value = 'q_only'; // Reset to default mode
        
        this.generateQRForMode();
        this.openModal('qr-modal');
    },

    generateQRForMode() {
        const qId = this.currentQrQuestionId;
        if (!qId) return;
        const q = this.state.questions.find(x => x.id === qId);
        if (!q) return;

        const mode = document.getElementById('qr-content-mode')?.value || 'q_only';
        let textArray = [`Q: ${q.question}`];

        // Append Options if requested
        if ((mode === 'q_options' || mode === 'all') && (q.type === 'mcq' || q.type === 'match' || q.type === 'boolean')) {
            if (q.type === 'mcq' && q.options && q.options.length > 0) {
                textArray.push(`\nOptions:\n- ${q.options.join('\n- ')}`);
            } else if (q.type === 'match' && q.pairs && q.pairs.length > 0) {
                textArray.push(`\nPairs:\n` + q.pairs.map(p => `- ${p.left} -> ${p.right}`).join('\n'));
            } else if (q.type === 'boolean') {
                textArray.push(`\nOptions: True / False`);
            }
        }

        // Append Answer and Explanation if requested
        if (mode === 'q_answer' || mode === 'all') {
            let ans = q.answer;
            if (q.type === 'boolean') {
                ans = q.answer ? i18n.t('quiz_true') || 'True' : i18n.t('quiz_false') || 'False';
            } else if (q.type === 'match') {
                ans = 'See pairs above';
            }
            if (ans) textArray.push(`\nAnswer: ${ans}`);
            if (q.explain) textArray.push(`\nExplain: ${q.explain}`);
        }

        // Protect from oversized payloads
        let rawPayload = textArray.join('\n');
        if (rawPayload.length > 800) rawPayload = rawPayload.substring(0, 800) + '... (Truncated)';

        const container = document.getElementById('qr-code-container');
        const titleEl = document.getElementById('qr-question-text');
        
        if (container) {
            container.innerHTML = ''; // clear previous
            
            // Generate QR Code locally (Offline support)
            new window.QRCode(container, {
                text: rawPayload,
                width: 220,
                height: 220,
                colorDark : "#000000",
                colorLight : "#ffffff",
                correctLevel : window.QRCode.CorrectLevel.L
            });
        }
        if (titleEl) {
            titleEl.textContent = q.question.substring(0, 100) + (q.question.length > 100 ? '...' : '');
        }
    },

    downloadQRCode() {
        const container = document.getElementById('qr-code-container');
        const img = container?.querySelector('img');
        const canvas = container?.querySelector('canvas');
        let dataUrl = '';
        
        if (img && img.src) {
            dataUrl = img.src;
        } else if (canvas) {
            dataUrl = canvas.toDataURL("image/png");
        }
        
        if (!dataUrl) return;
        
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = 'qrcode.png';
        a.click();
    },

    // ── Feature 1: JSON File Fixer ─────────────────────────────────────────
    /**
     * Opens the JSON repair modal with the raw content pre-loaded.
     * Called when a JSON import fails to parse.
     */
    openJsonFixer(rawText, errorMsg) {
        const editorEl = document.getElementById('json-fixer-editor');
        const errorEl  = document.getElementById('json-fixer-error');
        if (editorEl) editorEl.value = rawText;
        if (errorEl)  errorEl.textContent = '⚠️ ' + errorMsg;
        this.openModal('json-fixer-modal');
    },

    /** Validates and imports the fixed JSON from the repair modal */
    async validateAndImportJSON() {
        const editorEl = document.getElementById('json-fixer-editor');
        const errorEl  = document.getElementById('json-fixer-error');
        const raw = editorEl?.value || '';

        try {
            JSON.parse(raw); // Validate first — throws if still invalid
        } catch(e) {
            if (errorEl) {
                errorEl.textContent = '❌ لا يزال هناك خطأ: ' + e.message;
                // Highlight approximate error position
                const match = e.message.match(/position (\d+)/);
                if (match && editorEl) {
                    const pos = parseInt(match[1]);
                    editorEl.focus();
                    editorEl.setSelectionRange(pos, Math.min(pos + 5, raw.length));
                }
            }
            return;
        }

        // Valid — proceed with import
        this.closeModal('json-fixer-modal');
        this.showLoading(i18n.t('msg_importing') || 'جاري الاستيراد...');
        try {
            await this.processImportedJSON(raw);
            this.showToast(i18n.t('msg_import_fixed_success'), 'success');
        } finally {
            this.hideLoading();
        }
    },

    // ── Feature 4: Command Palette (Ctrl+K) ──────────────────────────────────
    openCommandPalette() {
        const overlay = document.getElementById('command-palette-overlay');
        if (!overlay) return;
        overlay.classList.add('active');
        const input = document.getElementById('cmd-search');
        if (input) { input.value = ''; input.focus(); }
        this._renderCommands('');
    },

    closeCommandPalette() {
        document.getElementById('command-palette-overlay')?.classList.remove('active');
    },

    _getCommands() {
        const views = [
            { label: '🏠 لوحة التحكم',    action: () => this.navigate('dashboard') },
            { label: '📝 بنك الأسئلة',    action: () => this.navigate('questions') },
            { label: '📁 الدفاتر',          action: () => this.navigate('notebooks') },
            { label: '🧪 وضع الاختبار',   action: () => this.navigate('quiz') },
            { label: '📤 مركز التصدير',    action: () => this.navigate('export-hub') },
            { label: '⚙️ الإعدادات',        action: () => this.navigate('settings') },
        ];
        const actions = [
            { label: '➕ إضافة سؤال جديد',       action: () => document.getElementById('btn-add-question')?.click() },
            { label: '📥 استيراد ملف JSON',       action: () => document.getElementById('import-file')?.click() },
            { label: '🎨 ثيم عشوائي',              action: () => this.setRandomTheme() },
            { label: '↩ تراجع',                    action: () => this.undo() },
            { label: '↪ إعادة',                     action: () => this.redo() },
            { label: '⌨️ اختصارات لوحة المفاتيح', action: () => this.toggleKeyboardOverlay() },
            { label: '🖨️ طباعة / تصدير PDF',      action: () => this.openPrintModal?.() },
        ];
        // Dynamic: recent questions
        const recent = (this.state.questions || []).slice(-5).reverse().map(q => ({
            label: `🔍 "${q.question.substring(0, 50)}..."`,
            action: () => { this.navigate('questions'); this.editQuestion(q.id); }
        }));
        return [...views, ...actions, ...recent];
    },

    _renderCommands(query) {
        const list = document.getElementById('cmd-results');
        if (!list) return;
        const lq = query.toLowerCase();
        const cmds = this._getCommands().filter(c => !lq || c.label.toLowerCase().includes(lq));
        list.innerHTML = cmds.slice(0, 12).map((c, i) =>
            `<div class="cmd-item" tabindex="0" data-idx="${i}">${c.label}</div>`
        ).join('') || '<div class="cmd-empty">لا توجد نتائج</div>';

        list.querySelectorAll('.cmd-item').forEach((el, i) => {
            el.addEventListener('click', () => {
                this.closeCommandPalette();
                cmds[i]?.action();
            });
            el.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') { this.closeCommandPalette(); cmds[i]?.action(); }
                if (e.key === 'ArrowDown') (el.nextElementSibling || list.firstElementChild)?.focus();
                if (e.key === 'ArrowUp')   (el.previousElementSibling || list.lastElementChild)?.focus();
            });
        });
    },

    // === Audio System ===

    toggleSound() { AudioManager.toggleSound(() => this.updateSoundIcon()); },
    updateSoundIcon() { AudioManager.updateSoundIcon(); },
    playSound(type) { AudioManager.playSound(type); },

    /**
     * Handles navigation between different views/pages.
     * @param {string} viewId - The ID of the section to show.
     */
    navigate(viewId) {
        this.state.currentView = viewId;
        this.playSound('nav');

        // Update Navigation UI
        document.querySelectorAll('.nav-item').forEach(item => {
            const isActive = item.dataset.target === viewId;
            item.classList.toggle('active', isActive);
            if (isActive) {
                const key = item.getAttribute('data-i18n');
                if (key) {
                    document.getElementById('current-page-title').textContent = i18n.t(key);
                }
            }
        });

        // Update View Display
        document.querySelectorAll('.view-section').forEach(section => {
            section.classList.toggle('active', section.id === viewId);
        });

        // Trigger view-specific rendering
        const viewInitializers = {
            'notebooks': () => this.renderNotebooks(),
            'questions': () => {
                this.renderQuestions();
                this.applyReferenceHubHints();
            },
            'dashboard': () => this.updateDashboard(),
            'quiz': () => this.updateNotebookDropdowns(),
            'export-hub': () => {
                this.updateNotebookDropdowns();
                this.renderSelectionHub();
                this.updateExportScopeCounts();
                if (typeof ExportModule !== 'undefined' && ExportModule.renderExportOptions) {
                    ExportModule.renderExportOptions(this.exportSelectedFormat || 'json');
                }
                this.applyReferenceHubHints();
            },
            'import-hub': () => {
                this.updateNotebookDropdowns();
                this.applyReferenceHubHints();
            },
            'settings': () => this.updateNotebookDropdowns()
        };

        if (viewInitializers[viewId]) viewInitializers[viewId]();

        // Finding 7: Show AI-Generate FAB only on the Questions view
        const fab = document.getElementById('fab-ai-generate');
        if (fab) fab.classList.toggle('visible', viewId === 'questions');
    },

    /**
     * Binds all global DOM event listeners.
     */
    bindEvents() {
        this.bindGlobalActions();
        this.bindNavigationEvents();
        this.bindQuizKeyboardEvents();
        this.bindGlobalKeyboardShortcuts();
        this.bindSearchEvents();
        this.bindModalEvents();
        this.bindFormEvents();
        this.bindFilterEvents();
        this.bindBulkEvents();
    },

    /** @private */
    bindGlobalActions() {
        document.getElementById('btn-toggle-sound')?.addEventListener('click', () => this.toggleSound());
        document.getElementById('btn-show-report')?.addEventListener('click', () => this.openModal('project-report-modal'));
    },

    /**
     * Global keyboard shortcut system.
     * Ctrl+K = Command Palette | Ctrl+N = new question | Ctrl+Z = undo |
     * Ctrl+Y = redo | ? = shortcuts overlay | Escape = close overlays
     * @private
     */
    bindGlobalKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            const inInput = e.target.matches('input, textarea, select') || e.target.isContentEditable;

            // Escape: close any active overlay in priority order
            if (e.key === 'Escape') {
                const cmdPalette = document.getElementById('command-palette-overlay');
                if (cmdPalette?.classList.contains('active')) { this.closeCommandPalette(); return; }
                const kbOverlay = document.getElementById('keyboard-overlay');
                if (kbOverlay?.classList.contains('active')) { kbOverlay.classList.remove('active'); return; }
            }

            // Don't fire shortcuts when typing in a form field
            if (inInput) return;

            if (e.ctrlKey || e.metaKey) {
                switch (e.key.toLowerCase()) {
                    case 'k':
                        e.preventDefault();
                        this.openCommandPalette();  // ← Command Palette
                        break;
                    case 'n':
                        e.preventDefault();
                        document.getElementById('btn-add-question')?.click();
                        break;
                    case 'z':
                        if (!e.shiftKey) { e.preventDefault(); this.undo(); }
                        break;
                    case 'y':
                        e.preventDefault();
                        this.redo();
                        break;
                }
                return;
            }

            // Non-modifier shortcuts
            if (e.key === '?') {
                e.preventDefault();
                this.toggleKeyboardOverlay();
            }
        });

        // Close overlay on backdrop click
        document.getElementById('keyboard-overlay')?.addEventListener('click', (e) => {
            if (e.target.id === 'keyboard-overlay') this.toggleKeyboardOverlay(false);
        });
    },

    /** Toggles (or forces) the keyboard shortcut help overlay. */
    toggleKeyboardOverlay(forceState) {
        const overlay = document.getElementById('keyboard-overlay');
        if (!overlay) return;
        const isActive = forceState !== undefined ? forceState : !overlay.classList.contains('active');
        overlay.classList.toggle('active', isActive);
    },

    /** Opens the mobile bottom-sheet filter drawer, syncing notebook/category options first. */
    openFilterDrawer() {
        // Sync notebook options into the drawer select
        const nbDrawer = document.getElementById('filter-notebook-drawer');
        const nbMain   = document.getElementById('filter-notebook');
        if (nbDrawer && nbMain) nbDrawer.innerHTML = nbMain.innerHTML;

        // Sync category options
        const catDrawer = document.getElementById('filter-category-drawer');
        const catMain   = document.getElementById('filter-category');
        if (catDrawer && catMain) catDrawer.innerHTML = catMain.innerHTML;

        document.getElementById('filter-drawer')?.classList.add('open');
        document.getElementById('filter-drawer-overlay')?.classList.add('active');
    },

    /** Closes the mobile filter drawer. */
    closeFilterDrawer() {
        document.getElementById('filter-drawer')?.classList.remove('open');
        document.getElementById('filter-drawer-overlay')?.classList.remove('active');
    },

    /** @private */
    bindNavigationEvents() {
        const menuToggle = document.getElementById('menu-toggle');
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebar-overlay');

        const closeSidebar = () => {
            sidebar?.classList.remove('active');
            overlay?.classList.remove('active');
        };

        menuToggle?.addEventListener('click', () => {
            sidebar?.classList.toggle('active');
            overlay?.classList.toggle('active');
        });

        overlay?.addEventListener('click', closeSidebar);
        document.getElementById('close-sidebar')?.addEventListener('click', closeSidebar);

        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                this.navigate(e.currentTarget.dataset.target);
                if (window.innerWidth <= 768) closeSidebar();
            });
        });
    },

    /** @private */
    bindQuizKeyboardEvents() {
        document.addEventListener('keydown', (e) => {
            if (this.state.currentView !== 'quiz' || document.querySelector('.modal.active')) return;

            if (e.key === 'ArrowRight') this.quizNav(1);
            else if (e.key === 'ArrowLeft') this.quizNav(-1);
            else if (['1', '2', '3', '4'].includes(e.key)) {
                const idx = parseInt(e.key) - 1;
                const q = this.state.quizState.pool[this.state.quizState.currentIdx];
                if (q && q.type === 'mcq' && q.options[idx]) {
                    this.saveQuizAnswer(q.id, q.options[idx]);
                    this.renderQuizQuestion();
                }
            }
        });
    },

    /** @private */
    bindSearchEvents() {
        const globalSearch = document.getElementById('global-search');
        if (globalSearch) {
            globalSearch.addEventListener('input', (e) => {
                const query = e.target.value.toLowerCase();
                if (this.state.currentView !== 'questions' && query.length > 0) this.navigate('questions');
                const filterSearch = document.getElementById('filter-search');
                if (filterSearch) {
                    filterSearch.value = query;
                    this.renderQuestions();
                }
            });
        }
    },

    /** @private */
    bindModalEvents() {
        document.getElementById('btn-create-notebook')?.addEventListener('click', () => {
            document.getElementById('notebook-form').reset();
            document.getElementById('notebook-id').value = '';
            this.openModal('notebook-modal');
        });

        document.getElementById('btn-add-question')?.addEventListener('click', () => {
            if (this.state.notebooks.length === 0) return alert(i18n.t('err_no_notebook'));
            document.getElementById('question-form').reset();
            document.getElementById('question-id').value = '';
            this.removeImage();
            
            const draftJson = localStorage.getItem('qbank_draft');
            if (draftJson && confirm(i18n.t('msg_draft_restore'))) {
                this.loadQuestionDraft(JSON.parse(draftJson));
            } else {
                this.renderDynamicFields('mcq');
            }
            this.openModal('question-modal');
        });

        document.querySelectorAll('.close-modal').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.target.closest('.modal-overlay')?.classList.remove('active');
            });
        });
        
        document.getElementById('btn-force-save')?.addEventListener('click', async () => {
            document.getElementById('duplicate-modal').classList.remove('active');
            try {
                if (this.pendingQuestionData) {
                    await db.put('questions', this.pendingQuestionData);
                    await this.syncData();
                    this.closeModal('question-modal');
                    this.pendingQuestionData = null;
                }
            } catch (e) {
                this.handleError(e, i18n.t('err_save_q'));
            }
        });
    },

    /** @private */
    bindFormEvents() {
        document.getElementById('notebook-form')?.addEventListener('submit', (e) => this.handleNotebookSubmit(e));
        document.getElementById('question-form')?.addEventListener('submit', (e) => this.handleQuestionSubmit(e));
        document.getElementById('question-type')?.addEventListener('change', (e) => this.renderDynamicFields(e.target.value));
        
        // Auto-save draft
        document.getElementById('question-form')?.addEventListener('input', () => {
            if (!document.getElementById('question-id').value) {
                const draft = {
                    notebookId: document.getElementById('question-notebook').value,
                    type: document.getElementById('question-type').value,
                    question: document.getElementById('question-text').value,
                    category: document.getElementById('question-category').value,
                    difficulty: document.getElementById('question-difficulty').value,
                    tags: document.getElementById('question-tags').value,
                    explain: document.getElementById('question-explain').value,
                    image: document.getElementById('question-image-base64').value
                };
                localStorage.setItem('qbank_draft', JSON.stringify(draft));
            }
        });
    },

    /** @private */
    bindFilterEvents() {
        ['filter-notebook', 'filter-category', 'filter-tag', 'filter-type', 'filter-difficulty'].forEach(id => {
            document.getElementById(id)?.addEventListener('change', () => this.renderQuestions());
        });
        
        document.getElementById('smartSearchBtn')?.addEventListener('click', () => {
            if (typeof this.renderSelectionHub === 'function') {
                this.renderSelectionHub();
                this.openModal('selection-modal');
            } else {
                Logger.warn('App', 'Selection Hub not initialized yet');
            }
        });
        
        document.getElementById('filter-search')?.addEventListener('input', (e) => {
            const globalSearch = document.getElementById('global-search');
            if (globalSearch) globalSearch.value = e.target.value;
            clearTimeout(this.searchTimeout);
            this.searchTimeout = setTimeout(() => this.renderQuestions(), 300);
        });

        const importEl = document.getElementById('import-file');
        if (importEl) {
            // Remove any previous listeners by replacing the element (Senior safe-bind pattern)
            const newImportEl = importEl.cloneNode(true);
            importEl.parentNode.replaceChild(newImportEl, importEl);

            newImportEl.addEventListener('change', async (e) => {
                e.stopImmediatePropagation();
                e.preventDefault();

                const file = e.target.files[0];
                if (!file) return;

                const reader = new FileReader();
                reader.onload = async (event) => {
                    try {
                        let jsonData;
                        const arrayBuffer = event.target.result;
                        
                        if (file.name.endsWith('.gz') && typeof pako !== 'undefined') {
                            const uint8Array = new Uint8Array(arrayBuffer);
                            const decompressed = pako.ungzip(uint8Array, { to: 'string' });
                            jsonData = JSON.parse(decompressed);
                        } else {
                            const textDecoder = new TextDecoder('utf-8');
                            jsonData = JSON.parse(textDecoder.decode(arrayBuffer));
                        }

                        await ExportModule.processStrictImport(jsonData, () => {
                            if (typeof this.syncData === 'function') this.syncData();
                            alert(i18n.t('msg_import_fixed_success') || "تم الاستيراد بنجاح وبدون أي تكرار!");
                        });

                    } catch (error) {
                        Logger.error('ImportSystem', 'Critical failure during file decompression/parsing', error);
                        alert(i18n.t('err_decompression_failed') || "فشل الاستيراد: تأكد من سلامة الملف.");
                    } finally {
                        e.target.value = ''; 
                    }
                };
                // قراءة الملف كـ ArrayBuffer لدعم الـ Binary Data (Gzip)
                reader.readAsArrayBuffer(file);
            });
        }

        document.getElementById('question-image-upload')?.addEventListener('change', (e) => this.handleImageUpload(e));
    },

    /** @private */
    bindBulkEvents() {
        document.getElementById('bulk-select-all')?.addEventListener('change', (e) => {
            this.bulkSelectAll(e.target.checked);
        });
        
        document.getElementById('bulk-notebook-move')?.addEventListener('change', async (e) => {
            const newNbId = e.target.value;
            if (!newNbId) return;
            
            const ids = Array.from(this.state.selectedIds);
            if (confirm(i18n.t('msg_move_confirm', { count: ids.length }))) {
                const questionsToUpdate = [];
                for (const id of ids) {
                    const q = this.state.questions.find(x => x.id === id);
                    if (q) {
                        q.notebookId = newNbId;
                        questionsToUpdate.push(q);
                    }
                }
                if (questionsToUpdate.length > 0) {
                    await db.bulkPut('questions', questionsToUpdate);
                }
                this.state.selectedIds.clear();
                await this.syncData();
                UIComponents.showToast(i18n.t('msg_move_success', { count: ids.length }), 'success');
            }
            e.target.value = '';
            this.syncCustomDropdown('bulk-notebook-move');
        });
    },

    /** @private */
    loadQuestionDraft(draft) {
        document.getElementById('question-notebook').value = draft.notebookId || '';
        document.getElementById('question-type').value = draft.type || 'mcq';
        document.getElementById('question-text').value = draft.question || '';
        document.getElementById('question-category').value = draft.category || '';
        document.getElementById('question-difficulty').value = draft.difficulty || 'medium';
        document.getElementById('question-tags').value = draft.tags || '';
        document.getElementById('question-explain').value = draft.explain || '';
        if (draft.image) {
            document.getElementById('question-image-base64').value = draft.image;
            const preview = document.getElementById('question-image-preview');
            if (preview) {
                preview.src = draft.image;
                preview.style.display = 'block';
            }
            const btnRemove = document.getElementById('btn-remove-image');
            if (btnRemove) btnRemove.style.display = 'inline-block';
        }
        this.renderDynamicFields(draft.type || 'mcq');
    },

    // =========================================================
    // === Core Business Logic (Delegated to Modules) ===
    // =========================================================

    async loadQuestions() { await QuestionModule.loadQuestions(() => this.renderQuestions(), () => this.updateExportScopeCounts()); },
    renderDynamicFields(type, data) { QuestionModule.renderDynamicFields(type, data); },
    async handleQuestionSubmit(e) { await QuestionModule.handleQuestionSubmit(e, (a, d) => this.performAction(a, d), (id) => this.closeModal(id), (d) => this.pendingQuestionData = d); },
    async deleteQuestion(id) { await QuestionModule.deleteQuestion(id, (a, d) => this.performAction(a, d)); },
    editQuestion(id) { QuestionModule.editQuestion(id, (m) => this.openModal(m), () => this.removeImage()); },
    handleImageUpload(e) { QuestionModule.handleImageUpload(e); },
    removeImage() { QuestionModule.removeImage(); },
    updateTagsDatalist() { QuestionModule.updateTagsDatalist(); },
    updateFilterDropdowns() { 
        QuestionModule.updateFilterDropdowns(); 
        this.syncCustomDropdown('filter-category');
        this.syncCustomDropdown('filter-tag');
    },
    renderQuestions() {
        // Finding 2: Show skeleton placeholders immediately; real cards replace them
        this.showSkeletonLoaders('questions-container', 4);
        // Use RAF to let the skeleton render before the (potentially heavy) real render
        requestAnimationFrame(() => {
            QuestionModule.renderQuestions((id) => this.editQuestion(id), (id) => this.toggleSelect(id));
            this.updateBulkSelectionUI();
        });
    },

    /**
     * Shows skeleton card placeholders inside a container.
     * @param {string} containerId
     * @param {number} count
     */
    showSkeletonLoaders(containerId, count = 4) {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML = Array.from({ length: count }).map(() => `
            <div class="skeleton-card">
                <div class="skeleton-line wide"></div>
                <div class="skeleton-line medium"></div>
                <div class="skeleton-line narrow"></div>
            </div>
        `).join('');
    },
    
    // === Pagination System ===
    changePage(dir) {
        const total = Math.ceil(this.state.virtual.filteredQuestions.length / this.state.virtual.itemsPerPage) || 1;
        this.state.virtual.currentPage += dir;
        if (this.state.virtual.currentPage < 1) this.state.virtual.currentPage = 1;
        if (this.state.virtual.currentPage > total) this.state.virtual.currentPage = total;
        this.renderQuestions();
    },

    goToPage(num) {
        this.state.virtual.currentPage = num;
        this.renderQuestions();
    },

    goToLastPage() {
        const total = Math.ceil(this.state.virtual.filteredQuestions.length / this.state.virtual.itemsPerPage) || 1;
        this.goToPage(total);
    },

    updateItemsPerPage(val) {
        this.state.virtual.itemsPerPage = parseInt(val) || 20;
        this.state.virtual.currentPage = 1;
        this.renderQuestions();
    },
    initSortable() { QuestionModule.initSortable(() => this.syncData()); },

    renderNotebooks() { NotebookModule.renderNotebooks((id) => this.editNotebook(id), (id) => this.deleteNotebook(id), (id) => this.viewNotebook(id)); },
    async handleNotebookSubmit(e) { await NotebookModule.handleNotebookSubmit(e, () => this.syncData(), (id) => this.closeModal(id)); },
    async deleteNotebook(id) { await NotebookModule.deleteNotebook(id, () => this.syncData(), (resetId) => {
        const filterEl = document.getElementById('filter-notebook');
        if (filterEl && filterEl.value === resetId) {
            filterEl.value = '';
            this.syncCustomDropdown('filter-notebook');
        }
    }); },

    async togglePin(id) {
        const q = this.state.questions.find(item => item.id === id);
        if (!q) return;
        q.isPinned = !q.isPinned;
        await db.put('questions', q);
        this.renderQuestions();
        this.updateDashboard();
    },

    showPinnedOnly() {
        this.resetFilters();
        this.navigate('questions');
        this.state.virtual.filteredQuestions = this.state.questions.filter(q => q.isPinned);
        this.state.virtual.currentPage = 1;
        this.renderQuestions();
    },

    resetFilters() {
        this.state.selectionCriteria.notebooks.clear();
        this.state.selectionCriteria.categories.clear();
        this.state.selectionCriteria.tags.clear();
        this.state.selectionCriteria.types.clear();
        this.state.selectionCriteria.difficulties.clear();
        this.state.selectionCriteria.searchQuery = '';
        
        // Update UI inputs
        const searchInput = document.getElementById('search-input');
        if (searchInput) searchInput.value = '';
        
        ['filter-notebook', 'filter-category', 'filter-tag', 'filter-type', 'filter-difficulty'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
            this.syncCustomDropdown(id);
        });
        
        this.updateFilterDropdowns();
    },
    editNotebook(id) { NotebookModule.editNotebook(id, (m) => this.openModal(m), () => NotebookModule.updateNotebookDropdowns((sid) => this.syncCustomDropdown(sid))); },
    viewNotebook(id) {
        const filterEl = document.getElementById('filter-notebook');
        if (filterEl) {
            filterEl.value = id;
            this.syncCustomDropdown('filter-notebook');
        }
        NotebookModule.viewNotebook(id, (view) => this.navigate(view));
    },
    updateNotebookDropdowns() { NotebookModule.updateNotebookDropdowns((id) => this.syncCustomDropdown(id)); },

    startQuiz() { QuizModule.startQuiz(() => this.renderQuizQuestion()); },
    updateQuizTimer() { QuizModule.updateQuizTimer(); },
    renderQuizQuestion() { QuizModule.renderQuizQuestion(); },
    saveQuizAnswer(qId, val) { QuizModule.saveQuizAnswer(qId, val); },
    quizNav(dir) { QuizModule.quizNav(dir); },
    submitQuiz() { QuizModule.submitQuiz(); },

    async exportData(fmt) { 
        const pool = this.getQueryPool(); 
        await ExportModule.exportData(fmt, pool, (msg) => this.showToast(msg)); 
    },
    
    /**
     * Changes the active export format and updates UI.
     * @param {string} format - The selected format (json, csv, pdf, word, etc.)
     */
    selectExportFormat(format) {
        this.exportSelectedFormat = format;
        this.playSound('click');
        
        // Update UI
        document.querySelectorAll('.export-format-card').forEach(card => {
            card.classList.toggle('active', card.dataset.format === format);
        });

        // Show/Hide advanced settings cards
        const pdfCard = document.getElementById('pdf-advanced-card');
        const wordCard = document.getElementById('word-advanced-card');
        
        if (pdfCard) pdfCard.style.display = (format === 'pdf' || format === 'print') ? 'block' : 'none';
        if (wordCard) wordCard.style.display = (format === 'word') ? 'block' : 'none';
        
        ExportModule.renderExportOptions(format);
        
        this.updateExportSummary();
    },

    /**
     * Executes the export process using the currently selected format.
     */
    async executeExport() {
        const format = this.exportSelectedFormat || 'json';
        this.showLoading(i18n.t('msg_exporting'));
        
        // Delay execution slightly to ensure loading UI is visible
        setTimeout(async () => {
            try {
                await this.exportData(format);
            } finally {
                this.hideLoading();
            }
        }, 100);
    },

    downloadFile(blob, filename) { ExportModule.downloadFile(blob, filename); },
    async exportToWord(pool) { await ExportModule.exportToWord(pool, (msg) => this.showToast(msg)); },
    getQuestionTypeLabel(type) { return ExportModule.getQuestionTypeLabel(type); },

    toggleZenMode() {
        document.body.classList.toggle('zen-mode');
        const btn = document.getElementById('btn-zen-mode');
        if (btn) btn.textContent = document.body.classList.contains('zen-mode') ? '⏹️' : '🔲';
    },

    openAiPromptModal() { AIModule.regeneratePrompt(); this.openModal('ai-prompt-modal'); },
    regeneratePrompt() { AIModule.regeneratePrompt(); },
    async copyAiPrompt() {
        if (await AIModule.copyAiPrompt()) this.showToast(i18n.t('msg_copy_success'));
        else alert(i18n.t('msg_copy_fail'));
    },

    /**
     * Copies a single question to clipboard as JSON or plain Arabic text.
     * @param {string} id - Question ID.
     * @param {'json'|'text'} format - Output format.
     */
    async copyQuestion(id, format = 'json') {
        const q = this.state.questions.find(x => x.id === id);
        if (!q) return;

        let content;
        if (format === 'json') {
            content = JSON.stringify(q, null, 2);
        } else {
            // Human-readable plain text
            const typeLabels = { mcq: 'اختيار من متعدد', boolean: 'صح/خطأ', written: 'مقالي', match: 'مزاوجة' };
            const diffLabels = { easy: 'سهل', medium: 'متوسط', hard: 'صعب' };
            const nb = this.state.notebooks.find(n => n.id === q.notebookId);

            const lines = [
                `السؤال: ${q.question}`,
                `النوع: ${typeLabels[q.type] || q.type}`,
                `الصعوبة: ${diffLabels[q.difficulty] || q.difficulty}`,
                q.category ? `التصنيف: ${q.category}` : null,
                nb ? `الدفتر: ${nb.name}` : null,
            ];

            if (q.type === 'mcq' && q.options?.length) {
                const labels = ['أ', 'ب', 'ج', 'د'];
                q.options.forEach((opt, i) => {
                    const mark = opt === q.answer ? ' ✅' : '';
                    lines.push(`${labels[i] || i + 1}) ${opt}${mark}`);
                });
            } else if (q.type === 'boolean') {
                lines.push(`الإجابة: ${q.answer ? 'صح' : 'خطأ'}`);
            } else if (q.type === 'written' && q.keywords?.length) {
                lines.push(`الكلمات المفتاحية: ${q.keywords.join('، ')}`);
            } else if (q.type === 'match' && q.pairs?.length) {
                q.pairs.forEach(p => lines.push(`${p.left}  ←→  ${p.right}`));
            }

            if (q.explain) lines.push(`التفسير: ${q.explain}`);
            if (q.tags?.length) lines.push(`الوسوم: ${q.tags.map(t => '#' + t).join(' ')}`);

            content = lines.filter(Boolean).join('\n');
        }

        try {
            await navigator.clipboard.writeText(content);
            this.showToast(
                format === 'json' ? '📋 تم نسخ السؤال بصيغة JSON' : '📄 تم نسخ السؤال كنص',
                'success'
            );
        } catch {
            this.showToast(i18n.t('msg_copy_failed_retry'), 'error');
        }
    },


    // =========================================================
    // === Dashboard & Reporting ===
    // =========================================================

    /**
     * Updates the dashboard stats and charts.
     */
    updateDashboard() {
        const stats = {
            totalQs: this.state.questions.length,
            totalNbs: this.state.notebooks.length,
            totalCategories: new Set(this.state.questions.map(q => q.category).filter(c => c && c.trim())).size,
            pinnedQs: this.state.questions.filter(q => q.isPinned).length
        };

        UIComponents.updateDashboard(stats);

        const typeCounts = ['mcq', 'boolean', 'written', 'match'].map(type => ({
            label: this.getQuestionTypeLabel(type),
            count: this.state.questions.filter(q => q.type === type).length
        }));

        UIComponents.renderActivityChart(typeCounts);

        const difficultyCounts = [
            { label: i18n.t('difficulty_easy'), count: this.state.questions.filter(q => q.difficulty === 'easy').length },
            { label: i18n.t('difficulty_medium'), count: this.state.questions.filter(q => q.difficulty === 'medium').length },
            { label: i18n.t('difficulty_hard'), count: this.state.questions.filter(q => q.difficulty === 'hard').length }
        ];
        UIComponents.renderDifficultyChart(difficultyCounts);

        this.updateStorageQuota();
    },

    /**
     * Updates the storage usage display.
     */
    async updateStorageQuota() {
        try {
            const quota = await Helpers.getStorageQuota();
            const usedText = document.getElementById('storage-used-text');
            const percentText = document.getElementById('storage-percent-text');
            const barFill = document.getElementById('storage-bar-fill');

            if (usedText) usedText.textContent = i18n.t('storage_used_of', { used: Helpers.formatBytes(quota.used), total: Helpers.formatBytes(quota.total) });
            if (percentText) percentText.textContent = `${quota.percent}%`;
            if (barFill) barFill.style.width = `${quota.percent}%`;
        } catch (e) {
            console.warn("Could not fetch storage quota", e);
        }
    },

    // =========================================================
    // === Action & History System ===
    // =========================================================

    /**
     * Centralized execution engine for all data mutations.
     * Implements undo/redo support and full system synchronization.
     * @param {string} actionType - The type of action (add_question, delete_notebook, etc.)
     * @param {any} data - Associated data for the action.
     * @param {boolean} [isUndoRedo=false] - Whether this action is triggered by undo/redo.
     */
    async performAction(actionType, data, isUndoRedo = false) {
        if (!isUndoRedo) {
            // Store a lightweight diff (only the mutated IDs + their before-state)
            // instead of deep-cloning the entire question array. This prevents
            // O(n) memory growth with large banks while preserving undo semantics.
            const affectedIds = Array.isArray(data) ? data : (data?.id ? [data.id] : []);
            const snapshot = {
                type: actionType,
                // Capture only the questions that are about to change
                questions: this.state.questions
                    .filter(q => affectedIds.includes(q.id))
                    .map(q => JSON.parse(JSON.stringify(q))),
                // Full notebook snapshot is small — keep it
                notebooks: JSON.parse(JSON.stringify(this.state.notebooks))
            };
            this.history.undo.push({ type: actionType, state: snapshot, fullData: data ? JSON.parse(JSON.stringify(data)) : data });
            // Cap undo stack at 25 entries to bound memory usage
            if (this.history.undo.length > 25) this.history.undo.shift();
            this.history.redo = [];
        }

        try {
            const handlers = {
                'add_question': async (d) => { await db.put('questions', d); UIComponents.showToast(i18n.t('msg_add_success'), 'success'); },
                'edit_question': async (d) => { await db.put('questions', d); UIComponents.showToast(i18n.t('msg_edit_success'), 'success'); },
                'delete_question': async (id) => { await db.delete('questions', id); UIComponents.showToast(i18n.t('msg_delete_success'), 'success'); },
                'add_notebook': async (d) => { await db.put('notebooks', d); UIComponents.showToast(i18n.t('msg_nb_add_success'), 'success'); },
                'edit_notebook': async (d) => { await db.put('notebooks', d); UIComponents.showToast(i18n.t('msg_nb_edit_success'), 'success'); },
                'delete_notebook': async (id) => {
                    await db.delete('notebooks', id);
                    const associated = this.state.questions.filter(q => q.notebookId === id);
                    for (let q of associated) await db.delete('questions', q.id);
                    UIComponents.showToast(i18n.t('msg_nb_delete_success', { count: associated.length }), 'success');
                },
                'bulk_delete': async (ids) => {
                    for (const id of ids) await db.delete('questions', id);
                    UIComponents.showToast(i18n.t('msg_bulk_delete_success', { count: ids.length }), 'success');
                }
            };

            if (handlers[actionType]) await handlers[actionType](data);
            await this.syncData();
        } catch (e) {
            this.handleError(e, "Action failed");
        }
    },

    /**
     * Reverts the last performed action.
     */
    async undo() {
        if (this.history.undo.length === 0) return;
        const lastAction = this.history.undo.pop();
        
        const currentSnapshot = {
            notebooks: JSON.parse(JSON.stringify(this.state.notebooks)),
            questions: JSON.parse(JSON.stringify(this.state.questions))
        };
        this.history.redo.push({ type: lastAction.type, state: currentSnapshot });

        await db.clearAll();
        await db.bulkPut('notebooks', lastAction.state.notebooks);
        await db.bulkPut('questions', lastAction.state.questions);
        
        await this.syncData();
        this.showToast(i18n.t('msg_undo'));
    },

    /**
     * Re-applies a previously reverted action.
     */
    async redo() {
        if (this.history.redo.length === 0) return;
        const lastRedo = this.history.redo.pop();
        
        const currentSnapshot = {
            notebooks: JSON.parse(JSON.stringify(this.state.notebooks)),
            questions: JSON.parse(JSON.stringify(this.state.questions))
        };
        this.history.undo.push({ type: lastRedo.type, state: currentSnapshot });

        await db.clearAll();
        await db.bulkPut('notebooks', lastRedo.state.notebooks);
        await db.bulkPut('questions', lastRedo.state.questions);
        
        await this.syncData();
        this.showToast(i18n.t('msg_redo'));
    },

    updateHistoryButtons() {
        const btnUndo = document.getElementById('btn-undo');
        const btnRedo = document.getElementById('btn-redo');
        // Finding 5: Use opacity/pointer-events (CSS class) instead of display:none
        // so buttons always occupy space — eliminating layout shift (CLS)
        if (btnUndo) {
            btnUndo.disabled = this.history.undo.length === 0;
            btnUndo.classList.toggle('btn-hidden', this.history.undo.length === 0);
        }
        if (btnRedo) {
            btnRedo.disabled = this.history.redo.length === 0;
            btnRedo.classList.toggle('btn-hidden', this.history.redo.length === 0);
        }
    },

    // =========================================================
    // === Selection Hub Logic ===
    // =========================================================

    /**
     * Toggles question selection for bulk actions.
     * @param {string} id - Question ID.
     */
    toggleSelect(id) {
        const isSelected = this.state.selectedIds.has(id);
        if (isSelected) this.state.selectedIds.delete(id);
        else this.state.selectedIds.add(id);
        
        // Find the checkbox and update it directly to avoid full render
        const cb = document.querySelector(`.bulk-cb[value="${id}"]`);
        if (cb) cb.checked = !isSelected;
        
        // Update associated UI components
        this.updateExportScopeCounts();
        this.updateBulkSelectionUI();
    },

    /**
     * Selects or deselects all currently filtered questions.
     * @param {boolean} selectAll - Whether to select or deselect.
     */
    bulkSelectAll(selectAll) {
        const visible = this.state.virtual.filteredQuestions || [];
        visible.forEach(q => {
            if (selectAll) this.state.selectedIds.add(q.id);
            else this.state.selectedIds.delete(q.id);
        });
        this.renderQuestions();
        this.updateExportScopeCounts();
        this.updateBulkSelectionUI();
    },

    /**
     * Updates the bulk action bar visibility and count.
     */
    updateBulkSelectionUI() {
        const bar = document.getElementById('bulk-actions-bar');
        const countEl = document.getElementById('bulk-count');
        const selectAllCb = document.getElementById('bulk-select-all');
        
        if (!bar || !countEl) return;

        const count = this.state.selectedIds.size;
        if (count > 0) {
            bar.style.display = 'flex';
            countEl.textContent = i18n.t('bulk_selected', { count });
            
            // Sync the "Select All" checkbox in the bar
            const visibleIds = (this.state.virtual.filteredQuestions || []).map(q => q.id);
            const allVisibleSelected = visibleIds.length > 0 && visibleIds.every(id => this.state.selectedIds.has(id));
            if (selectAllCb) selectAllCb.checked = allVisibleSelected;
        } else {
            bar.style.display = 'none';
            if (selectAllCb) selectAllCb.checked = false;
        }
    },

    /**
     * Toggles a specific filter criterion in the selection hub.
     * @param {string} type - Filter type (notebooks, types, difficulties, categories, tags).
     * @param {string} val - Filter value.
     */
    toggleSelectionCriteria(type, val) {
        if (this.state.selectionCriteria[type].has(val)) {
            this.state.selectionCriteria[type].delete(val);
        } else {
            this.state.selectionCriteria[type].add(val);
        }
        this.renderSelectionHub();
    },

    /**
     * Toggles all items in a selection group.
     */
    toggleGroupSelection(type, selectAll) {
        if (selectAll) {
            let items = [];
            if (type === 'notebooks') items = this.state.notebooks.map(n => n.id);
            else if (type === 'types') items = ['mcq', 'boolean', 'match', 'written'];
            else if (type === 'difficulties') items = ['easy', 'medium', 'hard'];
            else if (type === 'categories') {
                items = [...this.state.availableCategories, '__none__'];
            }
            
            items.forEach(item => this.state.selectionCriteria[type].add(item));
        } else {
            this.state.selectionCriteria[type].clear();
        }
        this.renderSelectionHub();
    },

    /**
     * Resets all selection criteria.
     */
    resetSelectionCriteria() {
        Object.keys(this.state.selectionCriteria).forEach(key => {
            if (this.state.selectionCriteria[key] instanceof Set) {
                this.state.selectionCriteria[key].clear();
            }
        });
        this.renderSelectionHub();
    },

    /**
     * Renders the interactive selection hub UI in the modal.
     */
    renderSelectionHub() {
        const hub = document.getElementById('selection-hub-content');
        if (!hub) return;

        // Render Notebooks
        const nbContainer = document.getElementById('sel-notebooks');
        if (nbContainer) {
            const search = (this.state.selectionSearch?.notebooks || '').toLowerCase();
            const filtered = this.state.notebooks.filter(n => n.name.toLowerCase().includes(search));
            nbContainer.innerHTML = filtered.map(nb => `
                <div class="selection-item ${this.state.selectionCriteria.notebooks.has(nb.id) ? 'active' : ''}" onclick="app.toggleSelectionCriteria('notebooks', '${nb.id}')">
                    <input type="checkbox" ${this.state.selectionCriteria.notebooks.has(nb.id) ? 'checked' : ''} style="pointer-events:none;">
                    <span>${Helpers.sanitize(nb.name)}</span>
                </div>
            `).join('');
        }

        // Update checkboxes for Types & Difficulties
        ['mcq', 'boolean', 'match', 'written'].forEach(t => {
            const el = document.getElementById(`chk-type-${t}`);
            if (el) el.checked = this.state.selectionCriteria.types.has(t);
        });
        ['easy', 'medium', 'hard'].forEach(d => {
            const el = document.getElementById(`chk-diff-${d}`);
            if (el) el.checked = this.state.selectionCriteria.difficulties.has(d);
        });

        // Categories
        const catContainer = document.getElementById('sel-categories');
        if (catContainer) {
            const categories = this.state.availableCategories;
            const search = (this.state.selectionSearch?.categories || '').toLowerCase();
            
            let html = `
                <div class="selection-item ${this.state.selectionCriteria.categories.has('__none__') ? 'active' : ''}" onclick="app.toggleSelectionCriteria('categories', '__none__')">
                    <input type="checkbox" ${this.state.selectionCriteria.categories.has('__none__') ? 'checked' : ''} style="pointer-events:none;">
                    <span style="color:var(--danger-color); font-weight:bold;">${i18n.t('no_category_badge')}</span>
                </div>
            `;
            html += categories.filter(c => c.toLowerCase().includes(search)).map(cat => `
                <div class="selection-item ${this.state.selectionCriteria.categories.has(cat) ? 'active' : ''}" onclick="app.toggleSelectionCriteria('categories', '${cat.replace(/'/g, "\\'").replace(/"/g, '&quot;')}')">
                    <input type="checkbox" ${this.state.selectionCriteria.categories.has(cat) ? 'checked' : ''} style="pointer-events:none;">
                    <span>${Helpers.sanitize(cat)}</span>
                </div>
            `).join('');
            catContainer.innerHTML = html;
        }

        // Tags
        const tagContainer = document.getElementById('sel-tags');
        if (tagContainer) {
            let tags = this.state.availableTags;
            const search = (this.state.selectionSearch?.tags || '').toLowerCase();
            
            // Cascading Filter: Filter tags based on selected categories/notebooks
            const selectedCats = this.state.selectionCriteria.categories;
            const selectedNbs = this.state.selectionCriteria.notebooks;
            
            let hasQuestionsWithoutTags = true; // Default to true if nothing is selected
            if (selectedCats.size > 0 || selectedNbs.size > 0) {
                const filteredPool = this.state.questions.filter(q => {
                    const catMatch = selectedCats.size === 0 || 
                                   (selectedCats.has('__none__') && (!q.category || q.category.trim() === '')) ||
                                   selectedCats.has(q.category);
                    const nbMatch = selectedNbs.size === 0 || 
                                   (selectedNbs.has('orphaned') && !this.state.notebooks.some(n => n.id === q.notebookId)) ||
                                   selectedNbs.has(q.notebookId);
                    return catMatch && nbMatch;
                });
                
                const tagsInPool = new Set();
                hasQuestionsWithoutTags = false;
                filteredPool.forEach(q => {
                    if (!q.tags || q.tags.length === 0) hasQuestionsWithoutTags = true;
                    if (q.tags) q.tags.forEach(t => tagsInPool.add(t));
                });
                tags = Array.from(tagsInPool).sort();
            }

            let html = '';
            if (hasQuestionsWithoutTags) {
                html += `
                    <div class="selection-item tag-item ${this.state.selectionCriteria.tags.has('__none__') ? 'active' : ''}" onclick="app.toggleSelectionCriteria('tags', '__none__')">
                        <span style="color:var(--danger-color); font-weight:bold;">${i18n.t('no_tags_badge')}</span>
                    </div>
                `;
            }
            html += tags.filter(t => t.toLowerCase().includes(search)).map(tag => `
                <div class="selection-item tag-item ${this.state.selectionCriteria.tags.has(tag) ? 'active' : ''}" onclick="app.toggleSelectionCriteria('tags', '${tag.replace(/'/g, "\\'").replace(/"/g, '&quot;')}')">
                    <span>#${Helpers.sanitize(tag)}</span>
                </div>
            `).join('');
            tagContainer.innerHTML = html;
        }

        this.renderPresets();
        this.updateExportSummary();
    },

    /**
     * Renders saved selection presets as clickable badges.
     */
    renderPresets() {
        const container = document.getElementById('sel-presets');
        if (!container) return;

        if (this.state.selectionPresets.length === 0) {
            container.innerHTML = `<div style="color:var(--text-secondary); font-style:italic; font-size:0.9rem;">${i18n.t('no_presets_msg')}</div>`;
            return;
        }

        container.innerHTML = this.state.selectionPresets.map(preset => `
            <div class="preset-badge" style="background:var(--surface-color); border:1px solid var(--primary); padding:5px 12px; border-radius:20px; display:flex; align-items:center; gap:10px; cursor:pointer; font-size:0.85rem; transition:var(--transition);" onclick="app.loadSelectionPreset('${preset.id}')">
                <span style="font-weight:bold; color:var(--primary);">${Helpers.sanitize(preset.name)}</span>
                <span class="delete-preset" onclick="event.stopPropagation(); app.deleteSelectionPreset('${preset.id}')" style="color:var(--danger-color); font-size:1.1rem; font-weight:bold;">&times;</span>
            </div>
        `).join('');
    },

    /**
     * Applies the current smart selection criteria to the main manual selection.
     */
    applyCriteriaToSelection() {
        const pool = this.getQueryPool(this.state.selectionCriteria);
        pool.forEach(q => this.state.selectedIds.add(q.id));
        
        QuestionModule.renderQuestions(
            (id) => QuestionModule.editQuestion(id, (m) => this.openModal(m), () => QuestionModule.removeImage()),
            (id) => this.toggleSelect(id)
        );
        
        UIComponents.showToast(i18n.t('msg_selection_applied', { count: pool.length }), 'success');
        this.updateExportSummary();
        
        const countEl = document.getElementById('selection-main-count');
        if (countEl) countEl.textContent = pool.length;
        
        this.updateBulkSelectionUI();
        this.updateExportScopeCounts();
    },

    /**
     * Saves the current selection criteria as a named preset.
     */
    saveSelectionPreset() {
        const name = prompt(i18n.t('prompt_preset_name'));
        if (!name) return;

        const preset = {
            id: 'pre-' + Date.now(),
            name: name,
            criteria: {
                notebooks: Array.from(this.state.selectionCriteria.notebooks),
                categories: Array.from(this.state.selectionCriteria.categories),
                tags: Array.from(this.state.selectionCriteria.tags),
                types: Array.from(this.state.selectionCriteria.types),
                difficulties: Array.from(this.state.selectionCriteria.difficulties),
                randomLimit: parseInt(document.getElementById('export-random-count')?.value) || 0
            }
        };

        this.state.selectionPresets.push(preset);
        localStorage.setItem('qbank_selection_presets', JSON.stringify(this.state.selectionPresets));
        this.renderPresets();
        UIComponents.showToast(i18n.t('msg_preset_saved'), "success");
    },

    /**
     * Loads a previously saved selection preset.
     */
    loadSelectionPreset(id) {
        const preset = this.state.selectionPresets.find(p => p.id === id);
        if (!preset) return;

        // Reset and Load
        this.resetSelectionCriteria();
        
        const c = preset.criteria;
        if (c.notebooks) c.notebooks.forEach(v => this.state.selectionCriteria.notebooks.add(v));
        if (c.categories) c.categories.forEach(v => this.state.selectionCriteria.categories.add(v));
        if (c.tags) c.tags.forEach(v => this.state.selectionCriteria.tags.add(v));
        if (c.types) c.types.forEach(v => this.state.selectionCriteria.types.add(v));
        if (c.difficulties) c.difficulties.forEach(v => this.state.selectionCriteria.difficulties.add(v));
        
        const randomInput = document.getElementById('export-random-count');
        if (randomInput && c.randomLimit) randomInput.value = c.randomLimit;

        this.renderSelectionHub();
        UIComponents.showToast(i18n.t('msg_preset_loaded', {name: preset.name}), "success");
    },

    /**
     * Deletes a selection preset.
     */
    deleteSelectionPreset(id) {
        if (!confirm(i18n.t('msg_delete_preset_confirm'))) return;
        this.state.selectionPresets = this.state.selectionPresets.filter(p => p.id !== id);
        localStorage.setItem('qbank_selection_presets', JSON.stringify(this.state.selectionPresets));
        this.renderPresets();
    },

    /**
     * Updates the text summary in the Export Hub.
     */
    updateExportSummary() {
        const format = this.exportSelectedFormat || 'json';
        const currentPool = this.getQueryPool();
        const currentCount = currentPool.length;
        
        // The "Live Count" inside the Selection Engine modal should always reflect the criteria
        const previewPool = QueryEngine.getQueryPool(this.state.selectionCriteria);
        const previewCount = previewPool.length;
        
        const summaryEl = document.getElementById('export-summary');
        const liveCountEl = document.getElementById('selection-live-count');
        const mainCountEl = document.getElementById('selection-main-count');

        const sortSelect = document.getElementById('export-sort-order');
        const sortLabel = sortSelect?.options[sortSelect.selectedIndex]?.text || i18n.t('default_sort');

        if (summaryEl) {
            summaryEl.innerHTML = `
                ${i18n.t('export_format_label')} <strong>${format.toUpperCase()}</strong> | 
                ${i18n.t('export_scope_label')} <strong>${currentCount} ${i18n.t('export_q_word')}</strong> | 
                ${i18n.t('export_sort_label')} <strong>${Helpers.sanitize(sortLabel)}</strong>
            `;
        }
        
        if (liveCountEl) liveCountEl.textContent = previewCount;
        if (mainCountEl) mainCountEl.textContent = currentCount;

        // Show/Hide random count container
        const randomContainer = document.getElementById('export-random-count-container');
        if (randomContainer) {
            randomContainer.style.display = document.getElementById('export-smart-random')?.checked ? 'block' : 'none';
        }

        // Show/Hide custom options
        const customOptions = document.getElementById('export-custom-options');
        const scopeSelect = document.querySelector('input[name="export-scope"]:checked');
        const scope = scopeSelect ? scopeSelect.value : 'all';

        if (customOptions) {
            customOptions.style.display = scope === 'custom' ? 'block' : 'none';
        }

        this.updateExportScopeCounts();
    },

    /**
     * Updates the visual counts of selected questions in the Export Hub.
     */
    updateExportScopeCounts() {
        const poolAll = this.state.questions.length;
        const poolSelected = this.state.selectedIds.size;
        const poolFiltered = this.getQueryPool().length;

        const elAll = document.getElementById('scope-count-all');
        const elSelected = document.getElementById('scope-count-selected');
        const elFiltered = document.getElementById('scope-count-filtered');
        const elCustom = document.getElementById('scope-count-custom');

        if (elAll) elAll.textContent = poolAll;
        if (elSelected) elSelected.textContent = poolSelected;
        if (elFiltered) elFiltered.textContent = poolFiltered;
        if (elCustom) elCustom.textContent = poolFiltered; // In case both IDs are used interchangeably
    },

    /**
     * Injects small hint texts below the main actions and references buttons.
     */
    applyReferenceHubHints() {
        const smartBtn = document.querySelector('button[onclick*="renderSelectionHub"][onclick*="selection-modal"]');
        const examBtn = document.querySelector('button[onclick*="bridgeToExam"]');
        const deleteBtn = document.querySelector('button[onclick*="bulkDelete"]');
        const previewBtn = document.getElementById('btn-preview-ref');
        const confirmBtn = document.getElementById('btn-confirm-ref-import');

        const wrapAndAddHint = (btn, hintKey) => {
            if (!btn) return;
            const existingHint = btn.parentNode.querySelector(`small[data-i18n="${hintKey}"]`);
            if (existingHint) {
                existingHint.textContent = i18n.t(hintKey);
                return;
            }
            if (btn.parentNode && !btn.parentNode.classList.contains('btn-hint-wrapper')) {
                const wrapper = document.createElement('div');
                wrapper.className = 'btn-hint-wrapper';
                wrapper.style.display = 'flex';
                wrapper.style.flexDirection = 'column';
                wrapper.style.alignItems = 'stretch';
                wrapper.style.gap = '4px';
                
                btn.parentNode.insertBefore(wrapper, btn);
                wrapper.appendChild(btn);
                
                const hint = document.createElement('small');
                hint.className = 'text-xs text-gray-500 block mt-1';
                hint.style.fontSize = '0.75rem';
                hint.style.opacity = '0.85';
                hint.style.display = 'block';
                hint.style.marginTop = '2px';
                hint.setAttribute('data-i18n', hintKey);
                hint.textContent = i18n.t(hintKey);
                wrapper.appendChild(hint);
            }
        };

        wrapAndAddHint(smartBtn, 'hint_smart_select');
        wrapAndAddHint(examBtn, 'hint_test_simulation');
        wrapAndAddHint(deleteBtn, 'hint_bulk_delete');
        wrapAndAddHint(previewBtn, 'hint_preview_ref');
        wrapAndAddHint(confirmBtn, 'hint_confirm_ref_import');
    },

    /**
     * Executes a bulk delete of selected questions.
     */
    async bulkDelete() {
        if (this.state.selectedIds.size === 0) return this.showToast(i18n.t('err_select_q_first'), "warning");
        if (confirm(i18n.t('msg_delete_q_confirm', {count: this.state.selectedIds.size}))) {
            const ids = Array.from(this.state.selectedIds);
            await this.performAction('bulk_delete', ids);
            this.state.selectedIds.clear();
        }
    },

    // =========================================================
    // === Smart Import & Print (Legacy Support) ===
    // =========================================================

    async processImportedJSON(jsonText) { await ExportModule.importData(jsonText, () => this.syncData()); },
    
    async exportToJSON() {
        this.playSound('click');
        await ExportModule.exportData('json', (msg) => this.showToast(msg, 'success'));
    },

    /**
     * Copies the entire question bank as a formatted JSON structure to the clipboard.
     */
    async copyRawStructure() {
        this.playSound('click');
        try {
            const data = JSON.stringify(this.state.questions, null, 2);
            await navigator.clipboard.writeText(data);
            this.showToast('✅ ' + i18n.t('msg_copy_success'), 'success');
        } catch (e) {
            this.handleError(e, 'Clipboard Copy Failed');
        }
    },

    async clearAllData(btn) {
        if (btn && !btn.dataset.confirmed) {
            btn.dataset.confirmed = "true";
            btn.dataset.originalText = btn.innerHTML;
            btn.innerHTML = i18n.t('confirm_delete_btn') || 'تأكيد الحذف؟ ⚠️';
            btn.style.background = 'var(--danger-color)';
            
            // Auto-reset after 3 seconds
            setTimeout(() => {
                if (btn.dataset.confirmed) {
                    delete btn.dataset.confirmed;
                    btn.innerHTML = btn.dataset.originalText;
                    btn.style.background = '#e76f51';
                }
            }, 3000);
            return;
        }

        if (confirm(i18n.t('msg_reset_confirm'))) {
            this.playSound('warning');
            await db.clear('questions');
            await db.clear('notebooks');
            this.state.questions = [];
            this.state.notebooks = [];
            this.state.selectedIds.clear();
            this.state.selectionCriteria.notebooks.clear();
            await this.syncData();
            this.showToast(i18n.t('msg_reset_success'), 'success');
            
            if (btn) {
                delete btn.dataset.confirmed;
                btn.innerHTML = btn.dataset.originalText;
                btn.style.background = '#e76f51';
            }

            this.navigate('dashboard');
        }
    },

    /**
     * Copies a clean, empty schema template for AI prompting.
     * Includes all supported question types (MCQ, Boolean, Written, Matching).
     */
    async copyRawJson() {
        this.playSound('click');
        try {
            const template = [
                {
                    "id": "",
                    "question": "",
                    "options": ["", "", "", ""],
                    "answer": "",
                    "type": "mcq",
                    "difficulty": "medium",
                    "category": "",
                    "tags": []
                },
                {
                    "id": "",
                    "question": "",
                    "options": ["", ""],
                    "answer": "",
                    "type": "boolean",
                    "difficulty": "easy",
                    "category": "",
                    "tags": []
                },
                {
                    "id": "",
                    "question": "",
                    "options": [],
                    "answer": "",
                    "type": "written",
                    "difficulty": "hard",
                    "category": "",
                    "tags": []
                },
                {
                    "id": "",
                    "question": "",
                    "options": ["", ""],
                    "answer": "",
                    "type": "match",
                    "difficulty": "medium",
                    "category": "",
                    "tags": []
                }
            ];
            
            const data = JSON.stringify(template, null, 2);
            await navigator.clipboard.writeText(data);
            UIComponents.showToast('✅ ' + (i18n.t('msg_template_copied') || "Template Copied"), 'success');
        } catch (e) {
            this.handleError(e, 'Template Copy Failed');
        }
    },


    async importFromUrl(event) {
        // Logic remains in app.js for now due to complex UI interactions
        const urlInput = document.getElementById('import-url');
        let url = urlInput.value.trim();
        if (!url) return alert(i18n.t('err_invalid_url'));
        
        const btn = event.currentTarget;
        const originalText = btn.innerHTML;
        try {
            btn.innerHTML = `${i18n.t('loading')} ⏳`;
            btn.disabled = true;
            const text = await Helpers.fetchUrlWithProxy(url);
            if (text) await this.processImportedJSON(text);
            urlInput.value = '';
        } catch (e) { alert((i18n.t('err_read_data', {msg: e.message})).replace('حدث خطأ أثناء قراءة البيانات: ', 'Error: ')); }
        finally { btn.innerHTML = originalText; btn.disabled = false; }
    },

    async importFromPaste() {
        const textarea = document.getElementById('import-paste-area');
        const text = textarea.value;
        if (!text.trim()) return alert(i18n.t('err_paste_text'));
        
        try {
            // Auto-sanitize common AI JSON errors (like unescaped newlines inside strings)
            let cleanText = Helpers.sanitizeJsonString(text);
            // Test parsing to catch SyntaxErrors directly here
            JSON.parse(cleanText);
            await this.processImportedJSON(cleanText);
        } catch (e) {
            console.error("JSON Error:", e);
            let errorMsg = e.message;
            let position = -1;

            const posMatch = errorMsg.match(/position (\d+)/);
            if (posMatch && posMatch[1]) position = parseInt(posMatch[1], 10);

            if (position >= 0) {
                const textUpToError = text.substring(0, position);
                const lines = textUpToError.split('\n');
                const lineNumber = lines.length;
                const columnNumber = lines[lines.length - 1].length + 1;
                
                textarea.focus();
                textarea.setSelectionRange(position, position + 1);
                
                // Rough scroll calculation
                const lineHeight = 20; 
                textarea.scrollTop = Math.max(0, (lineNumber - 3) * lineHeight);
                
                alert(i18n.t('err_json_syntax_long', {line: lineNumber, col: columnNumber, msg: errorMsg}));
            } else {
                alert(i18n.t('err_json_syntax', {msg: errorMsg}));
            }
        }
    },

    async smartTextImport() {
        const text = document.getElementById('import-paste-area').value;
        if (!text.trim()) return alert(i18n.t('err_paste_text'));
        const questions = Helpers.parseSmartText(text);
        if (questions.length > 0 && confirm(i18n.t('msg_found_qs_import', {count: questions.length}))) {
            await this.processImportedJSON(JSON.stringify(questions));
        }
    },

    smartFillSingleQuestion() {
        const text = document.getElementById('single-q-smart-fill').value;
        if (!text.trim()) return alert(i18n.t('err_paste_text'));
        
        try {
            const questions = Helpers.parseSmartText(text);
            if (!questions || questions.length === 0) {
                return alert(i18n.t('err_no_valid_q_format'));
            }
            
            const q = questions[0];
            
            // Map JSON properties to the form fields
            const typeSelect = document.getElementById('question-type');
            const qType = q.type || 'mcq';
            if ([...typeSelect.options].some(opt => opt.value === qType)) {
                typeSelect.value = qType;
            } else {
                typeSelect.value = 'mcq';
                q.type = 'mcq';
            }
            
            if (q.question) document.getElementById('question-text').value = q.question;
            if (q.category) document.getElementById('question-category').value = q.category;
            if (q.difficulty) document.getElementById('question-difficulty').value = q.difficulty;
            if (q.tags) document.getElementById('question-tags').value = Array.isArray(q.tags) ? q.tags.join(', ') : q.tags;
            if (q.explain) document.getElementById('question-explain').value = q.explain;
            
            // Render dynamic fields based on type and populate them
            QuestionModule.renderDynamicFields(typeSelect.value, q);
            
            document.getElementById('single-q-smart-fill').value = '';
            document.getElementById('smart-fill-body').style.display = 'none';
            
            this.showToast(i18n.t('msg_smart_fill_success'), 'success');
        } catch (e) {
            console.error("Smart Fill Error:", e);
            let errorMsg = e.message;
            let position = -1;

            const posMatch = errorMsg.match(/position (\d+)/);
            if (posMatch && posMatch[1]) position = parseInt(posMatch[1], 10);

            if (position >= 0) {
                const textarea = document.getElementById('single-q-smart-fill');
                const textUpToError = text.substring(0, position);
                const lines = textUpToError.split('\n');
                const lineNumber = lines.length;
                
                textarea.focus();
                textarea.setSelectionRange(position, position + 1);
                const lineHeight = 20;
                textarea.scrollTop = Math.max(0, (lineNumber - 2) * lineHeight);
                
                alert(i18n.t('err_json_line', {line: lineNumber, msg: errorMsg}));
            } else {
                alert(i18n.t('err_read_data', {msg: errorMsg}));
            }
        }
    },

    openPrintModal() {
        if (this.state.notebooks.length === 0) return alert(i18n.t('err_create_notebook_first'));
        this.openModal('print-modal');
    },

    executePrint() {
        const nbId = document.getElementById('print-notebook').value;
        const mode = document.getElementById('print-mode').value;
        const direction = document.getElementById('print-direction')?.value || 'rtl';
        const notebook = this.state.notebooks.find(n => n.id === nbId);
        
        if (!notebook) return alert(i18n.t('err_select_notebook'));

        const qList = this.state.questions.filter(q => q.notebookId === nbId);
        if (qList.length === 0) return alert(i18n.t('err_notebook_empty'));

        this.showLoading();

        // Use setTimeout to allow the loading overlay to render
        setTimeout(() => {
            const html = Helpers.generatePrintHTML(notebook.name, qList, mode);
            const container = document.getElementById('print-container');
            
            if (container) {
                container.innerHTML = html;
                container.dir = direction;
                this.closeModal('print-modal');
                
                // Allow browser to handle the DOM injection before printing
                requestAnimationFrame(() => {
                    setTimeout(() => {
                        this.hideLoading();
                        window.print();
                    }, 500);
                });
            } else {
                this.hideLoading();
            }
        }, 100);
    },

    // =========================================================
    // === Performance & Loading Utilities ===
    // =========================================================

    showLoading(message) {
        const overlay = document.getElementById('loading-overlay');
        const text = overlay?.querySelector('.loading-text');
        if (overlay) {
            if (message && text) text.textContent = message;
            overlay.classList.add('active');
        }
    },

    hideLoading() {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) overlay.classList.remove('active');
    },

    // =========================================================
    // === UI Utilities ===
    // =========================================================

    openModal(id) { 
        UIComponents.openModal(id, (t) => this.playSound(t)); 
        if (id === 'project-report-modal') this.loadChangelog();
    },
    closeModal(id) { UIComponents.closeModal(id, (t) => this.playSound(t)); },
    initCustomDropdowns() { UIComponents.initCustomDropdowns(); },
    syncCustomDropdown(id) { UIComponents.syncCustomDropdown(id); },
    showToast(msg, type) { UIComponents.showToast(msg, type); },
    

    addMatchPairRow() { QuestionModule.addMatchPairRow(); },

    // === Tag & Category Normalizer ===
    toggleAllNormalizer(modalId, checked) {
        const modal = document.getElementById(modalId);
        if (!modal) return;
        modal.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = checked);
    },

    openTagNormalizer() {
        this.openModal('tag-normalizer-modal');
        const container = document.getElementById('tag-suggestions-container');
        if (!container) return;

        const suggestions = QuestionModule.suggestTagMerges();
        if (suggestions.length === 0) {
            container.innerHTML = `<div style="text-align: center; padding: 20px; color: var(--success-color);">🎉 ${i18n.t('norm_no_suggestions')}</div>`;
            return;
        }

        container.innerHTML = suggestions.map(s => `
            <div class="stat-card" style="padding:10px; display:flex; align-items:center; justify-content:space-between; border: 1px solid var(--border);">
                <div style="display:flex; flex-direction:column; gap:4px;">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span style="background:var(--danger-color); color:white; padding:2px 6px; border-radius:4px; font-size:0.75rem;" data-i18n="delete_btn">${i18n.t('delete_btn')}</span>
                        <strong style="color:var(--danger-color);">#${Helpers.sanitize(s.from)}</strong> 
                        <small>${i18n.t('q_count_wrap', { count: s.fromCount })}</small>
                    </div>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span style="background:var(--success-color); color:white; padding:2px 6px; border-radius:4px; font-size:0.75rem;" data-i18n="merge_to">${i18n.t('merge_to')}</span>
                        <strong style="color:var(--success-color);">#${Helpers.sanitize(s.to)}</strong>
                        <small>${i18n.t('q_count_wrap', { count: s.toCount })}</small>
                    </div>
                </div>
                <input type="checkbox" class="tag-merge-check" data-from="${Helpers.sanitize(s.from)}" data-to="${Helpers.sanitize(s.to)}" checked style="width:20px; height:20px;">
            </div>
        `).join('');
    },

    openCategoryNormalizer() {
        this.openModal('category-normalizer-modal');
        const container = document.getElementById('category-suggestions-container');
        if (!container) return;

        const suggestions = QuestionModule.suggestCategoryMerges();
        if (suggestions.length === 0) {
            container.innerHTML = `<div style="text-align: center; padding: 20px; color: var(--success-color);">🎉 ${i18n.t('norm_no_suggestions')}</div>`;
            return;
        }

        container.innerHTML = suggestions.map(s => `
            <div class="stat-card" style="padding:10px; display:flex; align-items:center; justify-content:space-between; border: 1px solid var(--border);">
                <div style="display:flex; flex-direction:column; gap:4px;">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span style="background:var(--danger-color); color:white; padding:2px 6px; border-radius:4px; font-size:0.75rem;" data-i18n="delete_btn">${i18n.t('delete_btn')}</span>
                        <strong style="color:var(--danger-color);">${Helpers.sanitize(s.from)}</strong> 
                        <small>${i18n.t('q_count_wrap', { count: s.fromCount })}</small>
                    </div>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span style="background:var(--success-color); color:white; padding:2px 6px; border-radius:4px; font-size:0.75rem;" data-i18n="merge_to">${i18n.t('merge_to')}</span>
                        <strong style="color:var(--success-color);">${Helpers.sanitize(s.to)}</strong>
                        <small>${i18n.t('q_count_wrap', { count: s.toCount })}</small>
                    </div>
                </div>
                <input type="checkbox" class="cat-merge-check" data-from="${Helpers.sanitize(s.from)}" data-to="${Helpers.sanitize(s.to)}" checked style="width:20px; height:20px;">
            </div>
        `).join('');
    },

    async applyTagMerges() {
        const checks = document.querySelectorAll('.tag-merge-check:checked');
        const merges = Array.from(checks).map(c => ({ from: c.dataset.from, to: c.dataset.to }));
        
        if (merges.length === 0) return this.showToast(i18n.t('err_no_changes'), 'warning');

        const btn = document.getElementById('btn-apply-tags');
        const originalText = btn.innerHTML;
        btn.innerHTML = `${i18n.t('loading')} ⏳`;
        btn.disabled = true;

        try {
            this.playSound('click');
            const count = await QuestionModule.applyTagMerges(merges);
            this.closeModal('tag-normalizer-modal');
            this.showToast(i18n.t('msg_updated_count', { count }), 'success');
            await this.syncData();
        } catch (err) {
            this.handleError(err, 'Tag Normalizer');
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    },

    async applyCategoryMerges() {
        const checks = document.querySelectorAll('.cat-merge-check:checked');
        const merges = Array.from(checks).map(c => ({ from: c.dataset.from, to: c.dataset.to }));
        
        if (merges.length === 0) return this.showToast(i18n.t('err_no_changes'), 'warning');

        const btn = document.getElementById('btn-apply-categories');
        const originalText = btn.innerHTML;
        btn.innerHTML = `${i18n.t('loading')} ⏳`;
        btn.disabled = true;

        try {
            this.playSound('click');
            const count = await QuestionModule.applyCategoryMerges(merges);
            this.closeModal('category-normalizer-modal');
            this.showToast(i18n.t('msg_updated_count', { count }), 'success');
            await this.syncData();
        } catch (err) {
            this.handleError(err, 'Category Normalizer');
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    },
    /**
     * Dynamically loads CHANGELOG.md content into the report modal.
     */
    async loadChangelog() {
        const containers = [
            document.getElementById('changelog-content'),
            document.getElementById('changelog-content-en')
        ].filter(el => el !== null);

        if (containers.length === 0) return;

        try {
            const response = await fetch('CHANGELOG.md');
            if (!response.ok) throw new Error(i18n.t('err_changelog_load'));
            const text = await response.text();
            
            // Improved Markdown parser for Changelog display
            let html = Helpers.sanitize(text)
                .replace(/^# (.*$)/gim, '<h2 style="border-bottom:2px solid var(--primary); padding-bottom:10px; margin-top:30px; font-weight:800; color:var(--text-title);">$1</h2>')
                .replace(/^## (.*$)/gim, '<h3 style="margin-top:25px; color:var(--primary); font-weight:700; border-right:4px solid var(--primary); padding-right:12px;">$1</h3>')
                .replace(/^### (.*$)/gim, '<h4 style="margin-top:20px; color:var(--text-title); font-weight:600; display:flex; align-items:center; gap:8px;">🔹 $1</h4>')
                .replace(/^\* (.*$)/gim, '<li style="margin-right:25px; margin-bottom:8px; list-style-type: "⚡ ";">$1</li>')
                .replace(/^- (.*$)/gim, '<li style="margin-right:25px; margin-bottom:8px; list-style-type: "⚡ ";">$1</li>')
                .replace(/\*\*(.*)\*\*/gim, '<strong style="color:var(--primary);">$1</strong>')
                .replace(/`(.*)`/gim, '<code style="background:var(--bg-main); padding:3px 6px; border-radius:6px; border:1px solid var(--border); font-family:monospace; font-size:0.9em; color:#e76f51;">$1</code>');
            
            containers.forEach(container => {
                container.innerHTML = `<div class="changelog-rendered" dir="rtl" style="text-align:right;">${html}</div>`;
            });
        } catch (err) {
            containers.forEach(container => {
                container.innerHTML = `<div style="padding:20px; text-align:center; color:var(--danger-color);">
                    <p>⚠️ ${err.message}</p>
                    <small>${state.language === 'ar' ? 'تأكد من وجود ملف CHANGELOG.md في المجلد الرئيسي للمشروع.' : 'Ensure CHANGELOG.md exists in the project root.'}</small>
                </div>`;
            });
        }
    },

    /**
     * Copies the content of the current visible report section to clipboard.
     */
    async copyProjectReport() {
        const currentLang = state.language || 'ar';
        const section = document.getElementById(`report-${currentLang}`);
        if (!section) return;

        try {
            const text = section.innerText;
            await navigator.clipboard.writeText(text);
            this.showToast(i18n.t('msg_report_copied'), 'success');
        } catch (err) {
            this.handleError(err, 'Copy Report');
        }
    },

    fuzzyMatch(text, query) { return Helpers.fuzzyMatch(text, query); },
    levenshtein(a, b) { return Helpers.levenshtein(a, b); },

    /**
     * Smart Data Bridge: Transmits selected questions to the external exam site.
     * @param {string} [type='default'] - Type of session.
     */
    bridgeToExam(type = 'default') {
        let pool;
        
        if (type === 'smart') {
            pool = QueryEngine.getQueryPool(this.state.selectionCriteria);
        } else if (this.state.selectedIds.size > 0) {
            pool = this.state.questions.filter(q => this.state.selectedIds.has(q.id));
        } else if (type === 'quiz') {
            const nbId = document.getElementById('quiz-notebook')?.value;
            const limit = parseInt(document.getElementById('quiz-count')?.value) || 20;
            let quizPool = this.state.questions;
            if (nbId) quizPool = quizPool.filter(q => q.notebookId === nbId);
            pool = [...quizPool].sort(() => Math.random() - 0.5).slice(0, limit);
        } else {
            pool = this.getQueryPool();
        }

        ExportModule.bridgeToExam(
            pool, 
            (err, ctx) => this.handleError(err, ctx),
            (count) => UIComponents.showToast(i18n.t('msg_transfer_simulator', { count }), 'success')
        );
    }
};

document.addEventListener('DOMContentLoaded', () => {
    app.init();
    setTimeout(() => app.updateExportScopeCounts(), 800);
    
    document.addEventListener('fullscreenchange', () => {
        if (!document.fullscreenElement) {
            document.getElementById('quiz')?.classList.remove('zen-mode');
            const zenBtn = document.getElementById('btn-zen-mode');
            if (zenBtn) zenBtn.textContent = '🔲';
        }
    });
});

window.app = app;
window.DuplicatesUI = DuplicatesUI;
window.i18n = i18n;
window.Helpers = Helpers;
export default app;
