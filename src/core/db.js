import { Logger } from '../utils/logger.js?v=16.6.1';

// --- Database Wrapper (Vanilla IndexedDB) ---
const DB_NAME = 'QBankDB';
const DB_VERSION = 4;

export const db = {
    // استخدام النطاق العالمي لضمان نسخة واحدة دائماً (Global Singleton)
    get instance() { return window.__QBANK_DB_INSTANCE__ || null; },
    set instance(val) { window.__QBANK_DB_INSTANCE__ = val; },

    async init() {
        if (this.instance) return this.instance; // منع إعادة التهيئة في حال استدعاء الموديول من مسارات مختلفة

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = (event) => {
                const database = event.target.result;

                if (!database.objectStoreNames.contains('notebooks')) {
                    const store = database.createObjectStore('notebooks', { keyPath: 'id' });
                    store.createIndex('name', 'name', { unique: false });
                }

                if (!database.objectStoreNames.contains('questions')) {
                    const store = database.createObjectStore('questions', { keyPath: 'id' });
                    store.createIndex('notebookId', 'notebookId', { unique: false });
                    store.createIndex('type', 'type', { unique: false });
                }

                if (!database.objectStoreNames.contains('quiz_history')) {
                    const store = database.createObjectStore('quiz_history', { keyPath: 'id', autoIncrement: true });
                    store.createIndex('date', 'date', { unique: false });
                }

                // V4: Tiered Snapshots store
                if (!database.objectStoreNames.contains('snapshots')) {
                    const store = database.createObjectStore('snapshots', { keyPath: 'id' });
                    store.createIndex('level', 'level', { unique: false });
                    store.createIndex('createdAt', 'createdAt', { unique: false });
                }
            };

            request.onsuccess = (event) => {
                this.instance = event.target.result;
                resolve(this.instance);
            };

            request.onerror = (event) => {
                Logger.error('Database', 'Critical failure opening IndexedDB instance', event.target.error);
                reject(event.target.error);
            };
        });
    },

    async add(storeName, data) {
        return new Promise((resolve, reject) => {
            const transaction = this.instance.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.add(data);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    async put(storeName, data) {
        return new Promise((resolve, reject) => {
            const transaction = this.instance.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.put(data);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    /**
     * Optimized batch operations to fix N+1 transaction overhead.
     * Inserts/updates an array of objects inside a SINGLE readwrite transaction.
     */
    async bulkPut(storeName, dataArray) {
        if (!dataArray || dataArray.length === 0) return true;
        return new Promise((resolve, reject) => {
            const transaction = this.instance.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            dataArray.forEach(data => store.put(data));
            transaction.oncomplete = () => resolve(true);
            transaction.onerror = () => reject(transaction.error);
        });
    },

    async bulkAdd(storeName, dataArray) {
        if (!dataArray || dataArray.length === 0) return true;
        return new Promise((resolve, reject) => {
            const transaction = this.instance.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            dataArray.forEach(data => store.add(data));
            transaction.oncomplete = () => resolve(true);
            transaction.onerror = () => reject(transaction.error);
        });
    },

    async delete(storeName, id) {
        return new Promise((resolve, reject) => {
            const transaction = this.instance.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.delete(id);
            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    },

    async getAll(storeName) {
        return new Promise((resolve, reject) => {
            const transaction = this.instance.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    /**
     * Fetches a slice of data from the store using keyset pagination.
     * Uses IDBKeyRange to seek directly to the first key after the previous
     * batch's last key — eliminating the O(n) cursor.advance() scan.
     *
     * @param {string} storeName
     * @param {number} offset  - Logical offset (used to track last key via state)
     * @param {number} limit
     * @param {IDBValidKey|null} [afterKey=null] - Start AFTER this key (keyset pagination)
     */
    async getBatch(storeName, limit = 100, afterKey = null) {
        return new Promise((resolve, reject) => {
            const transaction = this.instance.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const results = [];

            // If we have a keyset anchor, open a range starting just after it.
            // Otherwise fall back to a full cursor scan (first batch only).
            const range = afterKey !== null
                ? IDBKeyRange.lowerBound(afterKey, true /* exclusive */)
                : null;

            const request = store.openCursor(range);
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (!cursor) return resolve(results);

                results.push(cursor.value);
                if (results.length < limit) {
                    cursor.continue();
                } else {
                    resolve(results);
                }
            };
            request.onerror = () => reject(request.error);
        });
    },

    /**
     * Counts total records in a store.
     */
    async count(storeName) {
        return new Promise((resolve, reject) => {
            const transaction = this.instance.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.count();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    /**
     * Clears all records from a specific store.
     * @param {string} storeName 
     */
    async clear(storeName) {
        return new Promise((resolve, reject) => {
            const transaction = this.instance.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.clear();
            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    },

    /**
     * Clears all data from all stores.
     */
    async clearAll() {
        const stores = ['notebooks', 'questions', 'quiz_history', 'snapshots'];
        for (const s of stores) {
            await new Promise((resolve) => {
                const tx = this.instance.transaction([s], 'readwrite');
                tx.objectStore(s).clear();
                tx.oncomplete = () => resolve();
            });
        }
    },

    /**
     * Optimized batch retrieval using a single transaction.
     * @param {string} storeName - Object store name.
     * @param {Array} ids - Array of IDs to retrieve.
     * @returns {Promise<Array>} - Array of found items.
     */
    async getMany(storeName, ids) {
        if (!ids || ids.length === 0) return [];
        return new Promise((resolve, reject) => {
            const results = [];
            const transaction = this.instance.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            
            let count = 0;
            ids.forEach(id => {
                const request = store.get(id);
                request.onsuccess = (e) => {
                    if (e.target.result) results.push(e.target.result);
                    count++;
                    if (count === ids.length) resolve(results);
                };
                request.onerror = () => {
                    count++;
                    if (count === ids.length) resolve(results);
                };
            });

            transaction.onerror = (e) => reject(e.target.error);
        });
    }
};
