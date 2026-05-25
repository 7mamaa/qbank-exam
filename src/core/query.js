import { state } from './state.js?v=16.6.1';
import { NotebookModule } from '../modules/notebooks.js?v=16.6.1';

/**
 * Universal Query Engine
 * Logic for selecting questions based on criteria.
 */
export const QueryEngine = {
    getQueryPool(overrideCriteria = null) {
        const criteria = overrideCriteria || state.selectionCriteria;
        let pool = [...state.questions];

        // 1. Manual Selection Override
        if (criteria.manualSelection && state.selectedIds.size > 0) {
            pool = pool.filter(q => state.selectedIds.has(q.id));
        }

        // 2. Notebooks Filter (Multiple) - Support Hierarchy
        if (criteria.notebooks.size > 0) {
            const allActiveNbIds = new Set();
            criteria.notebooks.forEach(nbId => {
                if (nbId === 'orphaned') {
                    allActiveNbIds.add('orphaned');
                } else {
                    allActiveNbIds.add(nbId);
                    // Add recursive descendants
                    const descendants = NotebookModule.getAllDescendantIds(nbId, state.notebooks);
                    descendants.forEach(id => allActiveNbIds.add(id));
                }
            });

            pool = pool.filter(q => {
                if (allActiveNbIds.has('orphaned')) {
                    const isOrphan = !state.notebooks.some(n => n.id === q.notebookId);
                    if (isOrphan) return true;
                }
                return allActiveNbIds.has(q.notebookId);
            });
        }

        // 3. Question Types Filter
        if (criteria.types.size > 0) {
            pool = pool.filter(q => criteria.types.has(q.type));
        }

        // 4. Difficulty Filter
        if (criteria.difficulties.size > 0) {
            pool = pool.filter(q => criteria.difficulties.has(q.difficulty));
        }

        // 5. Categories Filter
        if (criteria.categories.size > 0) {
            pool = pool.filter(q => {
                if (criteria.categories.has('__none__') && (!q.category || q.category.trim() === '')) return true;
                return criteria.categories.has(q.category);
            });
        }

        // 6. Tags Filter (Union logic)
        if (criteria.tags.size > 0) {
            pool = pool.filter(q => {
                if (criteria.tags.has('__none__') && (!q.tags || q.tags.length === 0)) return true;
                const qTags = q.tags || [];
                return Array.from(criteria.tags).some(t => qTags.includes(t));
            });
        }

        // 7. Search Query
        if (criteria.searchQuery) {
            const query = criteria.searchQuery.toLowerCase();
            pool = pool.filter(q => 
                q.question.toLowerCase().includes(query) || 
                (q.explain && q.explain.toLowerCase().includes(query))
            );
        }

        // 8. Randomization & Limit
        if (criteria.randomLimit && criteria.randomLimit > 0) {
            pool = pool.sort(() => 0.5 - Math.random()).slice(0, criteria.randomLimit);
        }

        return pool;
    }
};
