// --- Database Wrapper (Vanilla IndexedDB) ---
const DB_NAME = 'QBankDB';
const DB_VERSION = 1;

export const db = {
    instance: null,

    async init() {
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
            };

            request.onsuccess = (event) => {
                this.instance = event.target.result;
                resolve(this.instance);
            };

            request.onerror = (event) => {
                console.error("IndexedDB Error:", event.target.error);
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
    async getBatch(storeName, offset = 0, limit = 100, afterKey = null) {
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
        const stores = ['notebooks', 'questions'];
        for (const s of stores) {
            await new Promise((resolve) => {
                const tx = this.instance.transaction([s], 'readwrite');
                tx.objectStore(s).clear();
                tx.oncomplete = () => resolve();
            });
        }
    }
};
