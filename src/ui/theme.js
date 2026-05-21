import { state } from '../core/state.js';

export const ThemeManager = {
    initTheme(updateSoundIcon) {
        const savedCustom = localStorage.getItem('qbank_custom_theme');
        if (savedCustom) {
            try {
                const v = JSON.parse(savedCustom);
                const root = document.documentElement;
                root.style.setProperty('--primary', v.primary);
                root.style.setProperty('--primary-hover', v.primary);
                root.style.setProperty('--bg-main', v.bgMain);
                root.style.setProperty('--card-bg', v.cardBg);
                root.style.setProperty('--sidebar-bg', v.cardBg);
                root.style.setProperty('--text-title', v.textTitle);
                
                document.documentElement.setAttribute('data-theme', 'custom');

                const selector = document.getElementById('theme-selector');
                if (selector) selector.value = 'custom';

                const themePrimary = document.getElementById('theme-primary');
                const themeBg = document.getElementById('theme-bg-main');
                const themeCard = document.getElementById('theme-card-bg');
                const themeText = document.getElementById('theme-text-title');

                if (themePrimary) themePrimary.value = v.primary;
                if (themeBg) themeBg.value = v.bgMain;
                if (themeCard) themeCard.value = v.cardBg;
                if (themeText) themeText.value = v.textTitle;

                if (updateSoundIcon) updateSoundIcon();
                return;
            } catch (e) {
                localStorage.removeItem('qbank_custom_theme');
            }
        }

        const validThemes = ['cream-earthy', 'gray-orange', 'tech-violet', 'deep-orange'];
        if (!validThemes.includes(state.theme)) {
            state.theme = 'deep-orange';
        }
        document.documentElement.setAttribute('data-theme', state.theme);
        // Sync dropdown selector
        const selector = document.getElementById('theme-selector');
        if (selector) selector.value = state.theme;

        // Sync color pickers with active predefined theme colors
        const themeColors = {
            'cream-earthy': { primary: '#8B6F3E', bgMain: '#f8fafc', cardBg: '#FDFAF5', textTitle: '#1e293b' },
            'gray-orange': { primary: '#ff8e3c', bgMain: '#eff0f3', cardBg: '#fffffe', textTitle: '#0d0d0d' },
            'tech-violet': { primary: '#7f5af0', bgMain: '#16161a', cardBg: '#242629', textTitle: '#fffffe' },
            'deep-orange': { primary: '#ff8906', bgMain: '#0f0e17', cardBg: '#1a1a24', textTitle: '#fffffe' }
        };
        const colors = themeColors[state.theme] || themeColors['deep-orange'];

        const themePrimary = document.getElementById('theme-primary');
        const themeBg = document.getElementById('theme-bg-main');
        const themeCard = document.getElementById('theme-card-bg');
        const themeText = document.getElementById('theme-text-title');

        if (themePrimary) themePrimary.value = colors.primary;
        if (themeBg) themeBg.value = colors.bgMain;
        if (themeCard) themeCard.value = colors.cardBg;
        if (themeText) themeText.value = colors.textTitle;

        if (updateSoundIcon) updateSoundIcon();
    },

    setTheme(theme, playSound, updateSoundIcon) {
        document.documentElement.classList.add('no-transition');
        
        localStorage.removeItem('qbank_custom_theme');
        const root = document.documentElement;
        root.style.removeProperty('--primary');
        root.style.removeProperty('--primary-hover');
        root.style.removeProperty('--bg-main');
        root.style.removeProperty('--card-bg');
        root.style.removeProperty('--sidebar-bg');
        root.style.removeProperty('--text-title');

        state.theme = theme;
        localStorage.setItem('qbank_theme', theme);
        this.initTheme(updateSoundIcon);
        if (playSound) playSound('nav');
        
        setTimeout(() => {
            document.documentElement.classList.remove('no-transition');
        }, 50);
    },

    setRandomTheme(playSound, updateSoundIcon) {
        const themes = ['cream-earthy', 'gray-orange', 'tech-violet', 'deep-orange'];
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
        const btnRtl = document.getElementById('btn-dir-rtl');
        const btnLtr = document.getElementById('btn-dir-ltr');
        if (!btnRtl || !btnLtr) return;

        if (state.direction === 'rtl') {
            btnRtl.style.background = 'var(--primary)';
            btnRtl.style.color = '#000';
            btnLtr.style.background = 'var(--bg-main)';
            btnLtr.style.color = 'var(--text-title)';
        } else {
            btnLtr.style.background = 'var(--primary)';
            btnLtr.style.color = '#000';
            btnRtl.style.background = 'var(--bg-main)';
            btnRtl.style.color = 'var(--text-title)';
        }
    }
};
