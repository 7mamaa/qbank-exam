import { state } from '../core/state.js?v=16.6.1';

export const THEME_REGISTRY = {
    'default': { rtl: true, dark: true, print: true },
    'apple': { rtl: true, dark: true, print: true },
    'cream-earthy': { rtl: true, dark: false, print: true },
    'gray-orange': { rtl: true, dark: false, print: true },
    'tech-violet': { rtl: true, dark: true, print: true }
};

export const ThemeManager = {
    initTheme(updateSoundIcon) {
        const validThemes = Object.keys(THEME_REGISTRY);
        if (!validThemes.includes(state.theme)) {
            state.theme = 'default';
        }

        // Apply theme class to body and attribute to documentElement
        const bodyClasses = Array.from(document.body.classList).filter(c => c.startsWith('theme-'));
        bodyClasses.forEach(c => document.body.classList.remove(c));
        document.body.classList.add(`theme-${state.theme}`);
        document.documentElement.setAttribute('data-theme', state.theme);

        // Sync dropdown selector
        const selector = document.getElementById('theme-selector');
        if (selector) selector.value = state.theme;

        if (updateSoundIcon) updateSoundIcon();
    },

    setTheme(theme, playSound, updateSoundIcon) {
        document.documentElement.classList.add('no-transition');

        state.theme = theme;
        localStorage.setItem('qbank_theme', theme);
        this.initTheme(updateSoundIcon);
        if (playSound) playSound('nav');

        // Decoupled notification: Custom event dispatch
        document.dispatchEvent(new CustomEvent('theme:changed', { detail: { themeId: theme } }));
        
        setTimeout(() => {
            document.documentElement.classList.remove('no-transition');
        }, 50);
    },

    setRandomTheme(playSound, updateSoundIcon) {
        const themes = ['default', 'apple', 'cream-earthy', 'gray-orange', 'tech-violet'];
        const currentIdx = themes.indexOf(state.theme);
        let nextIdx;
        do {
            nextIdx = Math.floor(Math.random() * themes.length);
        } while (nextIdx === currentIdx);
        
        this.setTheme(themes[nextIdx], playSound, updateSoundIcon);
    },

    initDirection(updateDirectionButtons) {
        document.documentElement.dir = state.direction;
        document.body.dir = state.direction;
        if (updateDirectionButtons) updateDirectionButtons();
    },

    setDirection(dir, renderQuestions, updateDirectionButtons) {
        state.direction = dir;
        localStorage.setItem('qbank_direction', dir);
        this.initDirection(updateDirectionButtons);
        if (renderQuestions) renderQuestions();
    },

    updateDirectionButtons() {
        const btnRtls = document.querySelectorAll('.btn-dir-rtl');
        const btnLtrs = document.querySelectorAll('.btn-dir-ltr');

        btnRtls.forEach(btn => {
            if (state.direction === 'rtl') {
                btn.style.background = 'var(--primary)';
                btn.style.color = 'var(--btn-text)';
            } else {
                btn.style.background = 'var(--bg-main)';
                btn.style.color = 'var(--text-title)';
            }
        });

        btnLtrs.forEach(btn => {
            if (state.direction === 'ltr') {
                btn.style.background = 'var(--primary)';
                btn.style.color = 'var(--btn-text)';
            } else {
                btn.style.background = 'var(--bg-main)';
                btn.style.color = 'var(--text-title)';
            }
        });
    }
};
