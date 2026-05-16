import { state } from '../core/state.js';

export const AudioManager = {
    toggleSound(updateSoundIcon) {
        state.soundEnabled = !state.soundEnabled;
        localStorage.setItem('qbank_sound', state.soundEnabled);
        if (updateSoundIcon) updateSoundIcon();
        if (state.soundEnabled) this.playSound('nav');
    },

    updateSoundIcon() {
        const btn = document.getElementById('btn-toggle-sound');
        if (btn) btn.textContent = state.soundEnabled ? '🔊' : '🔇';
    },

    playSound(type) {
        if (!state.soundEnabled) return;
        
        const sounds = {
            nav: 'data:audio/wav;base64,UklGRjIAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YRAAAAAAgICA7u7u7u7u7u7u7u7u',
            correct: 'data:audio/wav;base64,UklGRjIAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YRAAAAAAAACAgICAgP7+/v7+',
            finish: 'data:audio/wav;base64,UklGRjIAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YRAAAACAgICAgP7+/v7+/v7+/v7+'
        };
        
        try {
            const audio = new Audio(sounds[type] || sounds.nav);
            audio.volume = 0.15;
            audio.play().catch(() => {});
        } catch (e) {
            console.warn("Audio playback prevented:", e);
        }
    }
};
