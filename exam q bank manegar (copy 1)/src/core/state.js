/**
 * @file state.js
 * @description Centralized application state management for QBank.
 * Implements the "Single Source of Truth" pattern.
 */

export const state = {
    /** @type {Array} Current list of notebook objects */
    notebooks: [],
    
    /** @type {Array} Current list of question objects */
    questions: [],
    
    /** @type {string} Currently active view/page ID */
    currentView: 'dashboard',
    
    /** @type {Set<string>} Set of selected question IDs for bulk actions */
    selectedIds: new Set(),

    /** @type {string} Visual theme of the application */
    theme: localStorage.getItem('qbank_theme') || 'cream-earthy',

    /** @type {string} UI direction (rtl/ltr) */
    direction: localStorage.getItem('qbank_direction') || 'rtl',

    /** @type {string} Current UI language (ar/en) */
    language: localStorage.getItem('qbank_language') || 'ar',

    /**
     * @namespace selectionCriteria
     * @description Criteria for selecting questions (used by QueryEngine).
     */
    selectionCriteria: {
        notebooks: new Set(),
        categories: new Set(),
        tags: new Set(),
        types: new Set(),
        difficulties: new Set(),
        searchQuery: '',
        randomLimit: 0,
        manualSelection: false
    },
    
    /** @type {Array} Cached unique categories across all questions */
    availableCategories: [],
    
    /** @type {Array} Cached unique tags across all questions */
    availableTags: [],

    /** @type {Array} Saved selection presets */
    selectionPresets: JSON.parse(localStorage.getItem('qbank_selection_presets') || '[]'),

    /**
     * @namespace selectionSearch
     * @description Search texts for the selection modal
     */
    selectionSearch: {
        notebooks: '',
        categories: '',
        tags: ''
    },

    /** 
     * @namespace virtual
     * @description State for pagination and virtualized list rendering.
     */
    virtual: {
        currentPage: 1,
        itemsPerPage: 20,
        itemHeight: 92,
        startIndex: 0,
        endIndex: 20,
        filteredQuestions: []
    },

    /**
     * @namespace quizState
     * @description State for the active quiz session.
     */
    quizState: {
        pool: [],
        currentIdx: 0,
        answers: {},
        startTime: null,
        timerInterval: null,
        isFinished: false
    }
};
