import { db } from '../core/db.js?v=16.6.0';
import { state } from '../core/state.js?v=16.6.0';
import { i18n } from '../core/i18n.js?v=16.6.0';

/**
 * @file duplicates.js
 * @description Logic engine for detecting duplicate questions using a Web Worker (MinHash + LSH).
 */

export const DuplicatesLogic = {
    _worker: null,

    /**
     * Initializes the worker if not already existing.
     * @private
     */
    _getWorker() {
        if (!this._worker) {
            this._worker = new Worker(new URL('../workers/dedup.worker.js', import.meta.url));
        }
        return this._worker;
    },

    /**
     * Finds duplicate groups using the Web Worker and IDBCursor streaming.
     * @param {number} [threshold=0.9] - Similarity threshold.
     * @param {Function} [onProgress] - Optional progress callback.
     * @returns {Promise<Array>} Array of duplicate groups.
     */
    async findDuplicates(threshold = 0.9, onProgress = null) {
        const worker = this._getWorker();
        const total = await db.count('questions');

        // Reset worker state before starting a new scan
        worker.postMessage({ type: 'RESET' });

        return new Promise((resolve, reject) => {
            let watchdog = null;
            const resetWatchdog = () => {
                if (watchdog) clearTimeout(watchdog);
                watchdog = setTimeout(() => {
                    console.warn("[Worker Watchdog Timeout]: Worker took too long to respond. Terminating.");
                    worker.terminate();
                    if (this._worker === worker) {
                        this._worker = null;
                    }
                    resolve([]);
                }, 3000);
            };

            const cleanup = () => {
                if (watchdog) {
                    clearTimeout(watchdog);
                    watchdog = null;
                }
            };

            resetWatchdog();

            const processData = async () => {
                try {
                    worker.onmessage = (e) => {
                        resetWatchdog();
                        const { type, progress, groups, label } = e.data;
                        
                        if (type === 'PROGRESS' && onProgress) {
                            onProgress(Math.round((e.data.count / total) * 50), 'streaming'); 
                        } else if (type === 'PROGRESS_PHASE' && onProgress) {
                            onProgress(50 + Math.round(progress / 2), label); 
                        } else if (type === 'COMPLETE') {
                            cleanup();
                            resolve(groups);
                        }
                    };

                    worker.onerror = (err) => {
                        console.error('Worker Error:', err);
                        cleanup();
                        reject(err);
                    };

                    const database = await db.init();
                    const transaction = database.transaction(['questions'], 'readonly');
                    const store = transaction.objectStore('questions');
                    const request = store.openCursor();

                    let batch = [];
                    request.onsuccess = (event) => {
                        resetWatchdog();
                        const cursor = event.target.result;
                        if (cursor) {
                            batch.push(cursor.value);

                            if (batch.length >= 500) {
                                worker.postMessage({ type: 'CHUNK', payload: batch });
                                batch = [];
                            }
                            cursor.continue();
                        } else {
                            if (batch.length > 0) {
                                worker.postMessage({ type: 'CHUNK', payload: batch });
                            }
                            worker.postMessage({ type: 'FINISH', threshold });
                        }
                    };

                    request.onerror = (err) => {
                        cleanup();
                        reject(err);
                    };
                } catch (e) {
                    cleanup();
                    reject(e);
                }
            };
            processData();
        });
    },

    /**
     * Merges a duplicate question into an original one.
     */
    async merge(originalId, duplicateId) {
        const original = state.questions.find(q => q.id === originalId);
        const duplicate = state.questions.find(q => q.id === duplicateId);

        if (!original || !duplicate) return false;

        const mergedTags = new Set([...(original.tags || []), ...(duplicate.tags || [])]);
        original.tags = Array.from(mergedTags).filter(Boolean);

        const isGeneral = original.category === i18n.t('general') || !original.category;
        if (isGeneral && duplicate.category && duplicate.category !== i18n.t('general')) {
            original.category = duplicate.category;
        }

        await db.put('questions', original);
        await db.delete('questions', duplicateId);

        // Update state and refresh
        state.questions = state.questions.filter(q => q.id !== duplicateId);
        
        return true;
    },

    /**
     * Deletes a question.
     */
    async delete(id) {
        await db.delete('questions', id);
        state.questions = state.questions.filter(q => q.id !== id);
        return true;
    }
};

export default DuplicatesLogic;
