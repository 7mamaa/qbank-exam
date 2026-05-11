import { state } from '../core/state.js';

export const ThemeManager = {
    initTheme(updateSoundIcon) {
        const validThemes = ['cream-earthy', 'gray-orange', 'tech-violet', 'deep-orange'];
        if (!validThemes.includes(state.theme)) {
            state.theme = 'cream-earthy';
        }
        document.documentElement.setAttribute('data-theme', state.theme);
        if (updateSoundIcon) updateSoundIcon();
    },

    setTheme(theme, playSound, updateSoundIcon) {
        document.documentElement.classList.add('no-transition');
        
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
