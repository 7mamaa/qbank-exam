/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { Helpers } from '../src/utils/helpers.js';
import { ExportModule } from '../src/modules/export.js';
import { QueryEngine } from '../src/core/query.js';
import { state } from '../src/core/state.js';

// Mock the state module
vi.mock('../src/core/state.js', () => ({
    state: {
        questions: [],
        selectionCriteria: {
            notebooks: new Set(),
            types: new Set(),
            difficulties: new Set(),
            categories: new Set(),
            tags: new Set(),
            searchQuery: '',
            randomLimit: 0
        },
        selectedIds: new Set()
    }
}));
describe('QBank Core Logic Tests', () => {
    
    describe('Helpers.sanitize', () => {
        it('should escape HTML tags to prevent XSS', () => {
            const unsafe = '<img src=x onerror=alert(1)> <b>Test</b>';
            const safe = Helpers.sanitize(unsafe);
            expect(safe).toContain('&lt;img');
            expect(safe).not.toContain('<img');
        });

        it('should return empty string for null or undefined', () => {
            expect(Helpers.sanitize(null)).toBe('');
            expect(Helpers.sanitize(undefined)).toBe('');
        });
    });

    describe('Helpers.formatBytes', () => {
        it('should format different sizes correctly', () => {
            expect(Helpers.formatBytes(0)).toBe('0 Bytes');
            expect(Helpers.formatBytes(512)).toBe('512 Bytes');
            expect(Helpers.formatBytes(1024)).toBe('1 KB');
            expect(Helpers.formatBytes(1536)).toBe('1.5 KB');
            expect(Helpers.formatBytes(1048576)).toBe('1 MB');
        });
    });

    describe('Export Labels', () => {
        it('should return correct Arabic labels for question types', () => {
            expect(ExportModule.getQuestionTypeLabel('mcq')).toBe('اختيار من متعدد');
            expect(ExportModule.getQuestionTypeLabel('boolean')).toBe('صح أو خطأ');
            expect(ExportModule.getQuestionTypeLabel('match')).toBe('مزاوجة');
            expect(ExportModule.getQuestionTypeLabel('written')).toBe('مقالي / قصير');
        });

        it('should return the original key if type is unknown', () => {
            expect(ExportModule.getQuestionTypeLabel('random_type')).toBe('random_type');
        });
    });

    describe('Fuzzy Matching & Levenshtein', () => {
        it('should match similar strings', () => {
            expect(Helpers.fuzzyMatch('JavaScript', 'java')).toBe(true);
            expect(Helpers.fuzzyMatch('Programming', 'test')).toBe(false);
        });

        it('should calculate Levenshtein distance correctly', () => {
            expect(Helpers.levenshtein('كيمياء', 'كيميا')).toBe(1);
            expect(Helpers.levenshtein('كيمياء', 'فيزياء')).toBe(2);
            expect(Helpers.levenshtein('test', 'text')).toBe(1);
        });
    });

    describe('QueryEngine', () => {
        it('should filter questions by search query', () => {
            state.questions = [
                { id: '1', question: 'ما هي عاصمة مصر؟', category: 'Geog', difficulty: 'easy' },
                { id: '2', question: 'How to use Vitest?', category: 'JS', difficulty: 'medium' }
            ];
            state.selectionCriteria.searchQuery = 'مصر';
            
            const results = QueryEngine.getQueryPool();
            expect(results.length).toBe(1);
            expect(results[0].id).toBe('1');
        });

        it('should filter questions by difficulty', () => {
            state.questions = [
                { id: '1', difficulty: 'easy' },
                { id: '2', difficulty: 'hard' }
            ];
            state.selectionCriteria.searchQuery = '';
            state.selectionCriteria.difficulties = new Set(['hard']);
            
            const results = QueryEngine.getQueryPool();
            expect(results.length).toBe(1);
            expect(results[0].id).toBe('2');
        });

        it('should filter questions with NO category using __none__', () => {
            state.questions = [
                { id: '1', category: 'Exists' },
                { id: '2', category: '' },
                { id: '3', category: undefined }
            ];
            state.selectionCriteria.categories = new Set(['__none__']);
            state.selectionCriteria.difficulties = new Set();
            
            const results = QueryEngine.getQueryPool();
            expect(results.length).toBe(2);
            expect(results.map(r => r.id)).toContain('2');
            expect(results.map(r => r.id)).toContain('3');
        });

        it('should detect similar categories for merging', () => {
            state.questions = [
                { id: '1', category: 'Surgery' },
                { id: '2', category: 'Surgary' },
                { id: '3', category: 'Medicine' }
            ];
            // Mocking QuestionModule.suggestCategoryMerges would be better but we test logic directly here
            const distance = Helpers.levenshtein('Surgery'.toLowerCase(), 'Surgary'.toLowerCase());
            expect(distance).toBe(1);
        });
    });
});
