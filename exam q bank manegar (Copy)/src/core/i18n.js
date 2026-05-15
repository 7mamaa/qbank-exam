import { state } from './state.js';
import { ar } from '../../locales/ar.js';
import { en } from '../../locales/en.js';
import { Helpers } from '../utils/helpers.js';

/**
 * @file i18n.js
 * @description Internationalization engine for QBank.
 * Handles translations, language switching, and UI updates.
 */

export const i18n = {
    /** @type {Object} Loaded locales */
    locales: { ar, en },

    /**
     * Translates a key based on the current language.
     * @param {string} key - The translation key.
     * @param {Object} [params] - Optional parameters for dynamic strings (e.g., {count: 5}).
     * @returns {string} Translated string or the key itself if not found.
     */
    t(key, params = {}) {
        if (!key) return ""; // Guard against null/undefined keys
        
        const lang = state.language || 'ar';
        let translation = this.locales[lang]?.[key] || this.locales['ar']?.[key];

        // Self-Healing Logic: If key is missing, format it for the user
        if (!translation) {
            console.error(`[i18n Error] Missing key: "${key}" in language: "${lang}".`);
            // Format: nb_parent -> NbParent (PascalCase)
            translation = String(key).split('_')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join('');
        }

        // Replace placeholders like {count}
        Object.keys(params).forEach(param => {
            const val = params[param];
            const safeVal = typeof val === 'string' ? Helpers.sanitize(val) : val;
            translation = translation.replace(`{${param}}`, safeVal);
        });

        return translation;
    },

    /**
     * Compares ar and en locales and logs any missing keys in either.
     */
    performSanityCheck() {
        const arKeys = Object.keys(this.locales.ar);
        const enKeys = Object.keys(this.locales.en);

        const missingInEn = arKeys.filter(k => !enKeys.includes(k));
        const missingInAr = enKeys.filter(k => !arKeys.includes(k));

        if (missingInEn.length > 0) {
            console.warn(`[i18n Audit] Missing in EN:`, missingInEn);
        }
        if (missingInAr.length > 0) {
            console.warn(`[i18n Audit] Missing in AR:`, missingInAr);
        }
    },

    /**
     * Initializes the i18n system.
     * Applies translations to all elements with 'data-i18n' attribute.
     */
    init() {
        this.performSanityCheck();
        this.updateUI();
    },

    /**
     * Updates the entire UI with translations.
     * Searches for elements with [data-i18n] and updates their content or placeholders.
     */
    updateUI() {
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            const translation = this.t(key);

            if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                if (el.placeholder !== undefined) el.placeholder = translation;
            } else {
                // Performance/Visual Fix: Preserve icons (svg, span, i) while updating text
                const icon = el.querySelector('svg, span, i');
                
                // If this element has nested [data-i18n], DO NOT update its text content
                // to avoid double translation and erasure of children.
                const hasNestedI18n = el.querySelector('[data-i18n]');
                if (hasNestedI18n) return;

                if (icon && el.childNodes.length > 1) {
                    const iconClone = icon.cloneNode(true);
                    el.textContent = ' ' + translation;
                    el.prepend(iconClone);
                } else {
                    el.textContent = translation;
                }
            }
        });

        // Update titles
        document.querySelectorAll('[data-i18n-title]').forEach(el => {
            const key = el.getAttribute('data-i18n-title');
            el.title = this.t(key);
        });

        // Toggle language-specific sections (e.g. for long blocks of text like reports)
        const currentLang = state.language || 'ar';
        document.querySelectorAll('.lang-section').forEach(el => {
            if (el.classList.contains(currentLang)) {
                el.style.display = 'block';
            } else {
                el.style.display = 'none';
            }
        });

        // Update document title
        document.title = `QBank - ${this.t('nav_dashboard')}`;
    },

    /**
     * Changes the application language.
     * @param {string} lang - 'ar' or 'en'.
     */
    setLanguage(lang) {
        state.language = lang;
        localStorage.setItem('qbank_language', lang);
        
        // Auto-set direction based on language
        const dir = (lang === 'ar') ? 'rtl' : 'ltr';
        state.direction = dir;
        localStorage.setItem('qbank_direction', dir);
        
        document.documentElement.lang = lang;
        document.documentElement.dir = dir;
        document.body.dir = dir;

        this.updateUI();
        
        // Notify components that language changed
        document.dispatchEvent(new CustomEvent('languageChanged', { detail: { lang, dir } }));
    }

};
