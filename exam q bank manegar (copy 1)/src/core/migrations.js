import { db } from './db.js';

/**
 * Migration Engine for QBank.
 * Handles schema versioning and data transformations between versions.
 */
export const Migrations = {
    CURRENT_VERSION: 10,
    STORAGE_KEY: 'qbank_schema_version',

    /**
     * Initializes and runs necessary migrations.
     * @param {Array} questions - Current questions in state.
     * @returns {Promise<boolean>} - Returns true if any migration changed data.
     */
    async run(questions) {
        const storedVersion = parseInt(localStorage.getItem(this.STORAGE_KEY)) || 1;
        
        if (storedVersion >= this.CURRENT_VERSION) {
            // Maintenance is expensive (full O(n) scan). Gate it to once per session
            // so repeat loads don't pay the cost when no schema change has occurred.
            const sessionKey = 'qbank_maintenance_done';
            if (sessionStorage.getItem(sessionKey)) {
                return false; // Already ran this session
            }
            const result = await this.maintenance(questions);
            sessionStorage.setItem(sessionKey, '1');
            return result;
        }


        console.log(`[Migrations] Migrating schema from V${storedVersion} to V${this.CURRENT_VERSION}`);
        let dataChanged = false;

        // Sequential migration path
        for (let v = storedVersion + 1; v <= this.CURRENT_VERSION; v++) {
            const migrationFn = this[`migrateToV${v}`];
            if (migrationFn) {
                console.log(`[Migrations] Applying V${v} transformations...`);
                const result = await migrationFn.call(this, questions);
                if (result) dataChanged = true;
            }
        }

        localStorage.setItem(this.STORAGE_KEY, this.CURRENT_VERSION.toString());
        return dataChanged;
    },

    /**
     * Maintenance tasks that run even if schema version is up to date.
     * (e.g. Fixing missing qNumbers that might have slipped through)
     */
    async maintenance(questions) {
        let changed = false;
        const notebooks = await db.getAll('notebooks');
        
        for (const nb of notebooks) {
            const nbQs = questions.filter(q => q.notebookId === nb.id);
            // Sort by creation date to maintain sequence
            nbQs.sort((a, b) => (new Date(a.createdAt || 0)) - (new Date(b.createdAt || 0)));

            for (let i = 0; i < nbQs.length; i++) {
                const q = nbQs[i];
                const targetNumber = i + 1;
                if (q.qNumber !== targetNumber) {
                    q.qNumber = targetNumber;
                    await db.put('questions', q);
                    changed = true;
                }
            }
        }
        return changed;
    },

    // --- Specific Migration Functions ---

    /**
     * Migration to V10: Formalizing the modular structure and ensuring qNumber integrity.
     */
    async migrateToV10(questions) {
        // In this case, V10 migration is primarily ensuring qNumber for all
        return await this.maintenance(questions);
    },

    /**
     * Example future migration
     */
    async migrateToV11(questions) {
        // Logic for V11 (e.g. renaming a field)
        return false;
    }
};
