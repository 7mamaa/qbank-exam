/**
 * @file snapshots.js
 * @description Tiered Snapshot Engine for QBank v16.6.1+
 * 
 * Implements a 3-level historical snapshot system stored in IndexedDB:
 *   LEVEL_1_GLOBAL_UI  — Visual state (theme, language, font size, institution identity/logo)
 *   LEVEL_2_STRUCTURE   — Notebook topology (parent-child, colors, question counts) without raw question text
 *   LEVEL_3_RAW_DATA    — Deep copy of all question arrays with reference fields for full rollback
 * 
 * Includes a fast UUID-based checksum algorithm for delta extraction without memory bloat.
 */

import { db } from './db.js?v=16.6.1';
import { state } from './state.js?v=16.6.1';
import { Logger } from '../utils/logger.js?v=16.6.1';

/** @constant {string} IndexedDB object store name for snapshots */
const SNAPSHOTS_STORE = 'snapshots';

/** @enum {number} Snapshot tier levels */
export const SnapshotLevel = Object.freeze({
    LEVEL_1_GLOBAL_UI: 1,
    LEVEL_2_STRUCTURE: 2,
    LEVEL_3_RAW_DATA: 3
});

/**
 * Computes a fast checksum hash from an array of UUID strings.
 * Uses a simple FNV-1a-inspired rolling hash for speed — no crypto overhead.
 * @param {string[]} uuids - Array of UUID strings.
 * @returns {string} Hex-encoded checksum.
 */
function computeChecksum(uuids) {
    let hash = 0x811c9dc5; // FNV offset basis (32-bit)
    for (let i = 0; i < uuids.length; i++) {
        const id = uuids[i];
        for (let j = 0; j < id.length; j++) {
            hash ^= id.charCodeAt(j);
            hash = (hash * 0x01000193) >>> 0; // FNV prime, keep unsigned 32-bit
        }
    }
    return hash.toString(16).padStart(8, '0');
}

/**
 * Captures Level 1 data: Global UI state snapshot.
 * @returns {Object} Level 1 payload.
 */
function captureLevel1() {
    const institution = (() => {
        try { return JSON.parse(localStorage.getItem('qbank_institution') || '{}'); } catch { return {}; }
    })();

    return {
        theme: state.theme || localStorage.getItem('qbank_theme') || 'deep-orange',
        direction: state.direction || localStorage.getItem('qbank_direction') || 'rtl',
        language: state.language || localStorage.getItem('qbank_language') || 'ar',
        fontSize: localStorage.getItem('qbank_font_size') || '16',
        institutionName: institution.name || '',
        institutionLogo: institution.logo || '' // Base64 encoded
    };
}

/**
 * Captures Level 2 data: Notebook topology and statistical counts.
 * @param {Array} notebooks - Notebook objects from state.
 * @param {Array} questions - Question objects from state.
 * @returns {Object} Level 2 payload.
 */
function captureLevel2(notebooks, questions) {
    const qCountMap = {};
    for (const q of questions) {
        if (q.notebookId) {
            qCountMap[q.notebookId] = (qCountMap[q.notebookId] || 0) + 1;
        }
    }

    const topology = notebooks.map(nb => ({
        id: nb.id,
        title: nb.title || nb.name || '',
        parentId: nb.parentId || null,
        color: nb.color || '#4361ee',
        icon: nb.icon || '📁',
        targetCount: nb.targetCount || 0,
        questionCount: qCountMap[nb.id] || 0
    }));

    return {
        notebooks: topology,
        totalNotebooks: notebooks.length,
        totalQuestions: questions.length,
        checksum: computeChecksum(notebooks.map(n => n.id))
    };
}

/**
 * Captures Level 3 data: Full deep copy of all questions.
 * @param {Array} questions - Question objects from state.
 * @returns {Object} Level 3 payload.
 */
function captureLevel3(questions) {
    // Deep copy via structured clone to avoid shared references
    const rawCopy = JSON.parse(JSON.stringify(questions));

    return {
        questions: rawCopy,
        totalCount: rawCopy.length,
        checksum: computeChecksum(rawCopy.map(q => q.id))
    };
}

/**
 * Main Snapshots Engine — public API.
 */
export const SnapshotsEngine = {

    /**
     * Captures and persists a snapshot at the specified level.
     * @param {number} level - SnapshotLevel enum value (1, 2, or 3).
     * @param {string} [label=''] - User-facing label for the snapshot.
     * @returns {Promise<string>} The generated snapshot ID.
     */
    async capture(level, label = '') {
        try {
            const notebooks = state.notebooks || [];
            const questions = state.questions || [];

            let payload;
            switch (level) {
                case SnapshotLevel.LEVEL_1_GLOBAL_UI:
                    payload = captureLevel1();
                    break;
                case SnapshotLevel.LEVEL_2_STRUCTURE:
                    payload = captureLevel2(notebooks, questions);
                    break;
                case SnapshotLevel.LEVEL_3_RAW_DATA:
                    payload = captureLevel3(questions);
                    break;
                default:
                    throw new Error(`Invalid snapshot level: ${level}`);
            }

            const snapshot = {
                id: crypto.randomUUID(),
                level,
                label: label || `Snapshot L${level} — ${new Date().toLocaleString('ar-EG')}`,
                createdAt: Date.now(),
                payload
            };

            await db.put(SNAPSHOTS_STORE, snapshot);
            Logger.info('Snapshots', `Level ${level} snapshot captured: ${snapshot.id}`);
            return snapshot.id;
        } catch (err) {
            Logger.error('Snapshots', 'Failed to capture snapshot', err);
            throw err;
        }
    },

    /**
     * Lists all snapshots, optionally filtered by level.
     * @param {number|null} [filterLevel=null] - Optional level filter.
     * @returns {Promise<Array>} Array of snapshot metadata (no payload for L3).
     */
    async list(filterLevel = null) {
        try {
            const all = await db.getAll(SNAPSHOTS_STORE);
            const filtered = filterLevel !== null
                ? all.filter(s => s.level === filterLevel)
                : all;

            // Sort by newest first
            filtered.sort((a, b) => b.createdAt - a.createdAt);

            // Strip raw question data from listing to prevent memory bloat
            return filtered.map(s => ({
                id: s.id,
                level: s.level,
                label: s.label,
                createdAt: s.createdAt,
                checksum: s.payload?.checksum || null,
                totalQuestions: s.payload?.totalQuestions || s.payload?.totalCount || null,
                totalNotebooks: s.payload?.totalNotebooks || null
            }));
        } catch (err) {
            Logger.error('Snapshots', 'Failed to list snapshots', err);
            return [];
        }
    },

    /**
     * Retrieves a full snapshot by ID.
     * @param {string} snapshotId
     * @returns {Promise<Object|null>}
     */
    async get(snapshotId) {
        try {
            const all = await db.getAll(SNAPSHOTS_STORE);
            return all.find(s => s.id === snapshotId) || null;
        } catch (err) {
            Logger.error('Snapshots', 'Failed to retrieve snapshot', err);
            return null;
        }
    },

    /**
     * Deletes a snapshot by ID.
     * @param {string} snapshotId
     * @returns {Promise<boolean>}
     */
    async remove(snapshotId) {
        try {
            await db.delete(SNAPSHOTS_STORE, snapshotId);
            Logger.info('Snapshots', `Snapshot ${snapshotId} deleted.`);
            return true;
        } catch (err) {
            Logger.error('Snapshots', 'Failed to delete snapshot', err);
            return false;
        }
    },

    /**
     * Compares a stored snapshot against the current live state.
     * Returns a Delta Report describing additions, deletions, and changes.
     * Uses UUID checksums for fast comparison without full data diffing.
     * 
     * @param {string} snapshotId - ID of the snapshot to compare.
     * @returns {Promise<Object>} Delta report: { level, added, removed, changed, isIdentical }
     */
    async compare(snapshotId) {
        const snapshot = await this.get(snapshotId);
        if (!snapshot) throw new Error('Snapshot not found: ' + snapshotId);

        // Activate comparison mode to brake BroadcastChannel updates
        state.isComparing = true;

        try {
            const level = snapshot.level;
            const delta = { level, added: [], removed: [], changed: [], isIdentical: false };

            if (level === SnapshotLevel.LEVEL_1_GLOBAL_UI) {
                const current = captureLevel1();
                const stored = snapshot.payload;
                const keys = Object.keys(current);
                for (const key of keys) {
                    if (current[key] !== stored[key]) {
                        delta.changed.push({ field: key, was: stored[key], now: current[key] });
                    }
                }
                delta.isIdentical = delta.changed.length === 0;

            } else if (level === SnapshotLevel.LEVEL_2_STRUCTURE) {
                const current = captureLevel2(state.notebooks, state.questions);
                const storedIds = new Set(snapshot.payload.notebooks.map(n => n.id));
                const currentIds = new Set(current.notebooks.map(n => n.id));

                for (const nb of current.notebooks) {
                    if (!storedIds.has(nb.id)) delta.added.push({ type: 'notebook', id: nb.id, title: nb.title });
                }
                for (const nb of snapshot.payload.notebooks) {
                    if (!currentIds.has(nb.id)) delta.removed.push({ type: 'notebook', id: nb.id, title: nb.title });
                }

                // Check question count changes per notebook
                const storedCountMap = {};
                snapshot.payload.notebooks.forEach(n => { storedCountMap[n.id] = n.questionCount; });
                for (const nb of current.notebooks) {
                    if (storedIds.has(nb.id) && storedCountMap[nb.id] !== nb.questionCount) {
                        delta.changed.push({
                            type: 'questionCount',
                            notebookId: nb.id,
                            title: nb.title,
                            was: storedCountMap[nb.id],
                            now: nb.questionCount
                        });
                    }
                }

                delta.isIdentical = delta.added.length === 0 && delta.removed.length === 0 && delta.changed.length === 0;

            } else if (level === SnapshotLevel.LEVEL_3_RAW_DATA) {
                const currentChecksum = computeChecksum(state.questions.map(q => q.id));
                const storedChecksum = snapshot.payload.checksum;

                if (currentChecksum === storedChecksum) {
                    delta.isIdentical = true;
                } else {
                    const storedIds = new Set(snapshot.payload.questions.map(q => q.id));
                    const currentIds = new Set(state.questions.map(q => q.id));

                    for (const q of state.questions) {
                        if (!storedIds.has(q.id)) delta.added.push({ id: q.id, question: (q.question || '').substring(0, 80) });
                    }
                    for (const q of snapshot.payload.questions) {
                        if (!currentIds.has(q.id)) delta.removed.push({ id: q.id, question: (q.question || '').substring(0, 80) });
                    }
                    delta.isIdentical = false;
                }
            }

            return delta;
        } finally {
            state.isComparing = false;
        }
    },

    /**
     * Restores state from a snapshot. Level determines what gets restored.
     * @param {string} snapshotId
     * @returns {Promise<boolean>} true if restoration succeeded.
     */
    async restore(snapshotId) {
        const snapshot = await this.get(snapshotId);
        if (!snapshot) throw new Error('Snapshot not found: ' + snapshotId);

        try {
            const level = snapshot.level;

            if (level === SnapshotLevel.LEVEL_1_GLOBAL_UI) {
                const p = snapshot.payload;
                localStorage.setItem('qbank_theme', p.theme);
                localStorage.setItem('qbank_direction', p.direction);
                localStorage.setItem('qbank_language', p.language);
                localStorage.setItem('qbank_font_size', p.fontSize);

                const institution = { name: p.institutionName, logo: p.institutionLogo };
                localStorage.setItem('qbank_institution', JSON.stringify(institution));

                // Update live state
                state.theme = p.theme;
                state.direction = p.direction;
                state.language = p.language;

                Logger.info('Snapshots', 'Level 1 (Global UI) restored successfully.');
                return true;

            } else if (level === SnapshotLevel.LEVEL_2_STRUCTURE) {
                // Restore notebook topology to IndexedDB
                const storedNotebooks = snapshot.payload.notebooks.map(nb => ({
                    id: nb.id,
                    title: nb.title,
                    name: nb.title,
                    parentId: nb.parentId,
                    color: nb.color,
                    icon: nb.icon,
                    targetCount: nb.targetCount,
                    createdAt: Date.now()
                }));

                await db.clear('notebooks');
                await db.bulkPut('notebooks', storedNotebooks);

                Logger.info('Snapshots', 'Level 2 (Structure) restored successfully.');
                return true;

            } else if (level === SnapshotLevel.LEVEL_3_RAW_DATA) {
                // Full rollback: replace all questions
                await db.clear('questions');
                await db.bulkPut('questions', snapshot.payload.questions);

                Logger.info('Snapshots', `Level 3 (Raw Data) restored — ${snapshot.payload.questions.length} questions.`);
                return true;
            }

            return false;
        } catch (err) {
            Logger.error('Snapshots', 'Restore failed', err);
            throw err;
        }
    },

    /** Utility: Compute checksum for external callers */
    computeChecksum
};
