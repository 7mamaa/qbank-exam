/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { Helpers } from '../src/utils/helpers.js';
import { ExportModule } from '../src/modules/export.js';
import { QueryEngine } from '../src/core/query.js';
import { state } from '../src/core/state.js';

// Mock the state module with query parameters support
const { mockSharedState } = vi.hoisted(() => ({
    mockSharedState: {
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

vi.mock('../src/core/state.js', () => ({
    state: mockSharedState
}));

vi.mock('../src/core/state.js?v=16.6.0', () => ({
    state: mockSharedState
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

    describe('validateIncomingPayload Dual-Resolution and Floating Fallback', () => {
        it('should resolve notebook by ID and keep it intact', () => {
            const notebooks = [{ id: 'nb-uuid-1', name: 'Ophthalmology' }];
            const payload = [
                {
                    id: 'q-1',
                    question: 'Test question 1',
                    type: 'mcq',
                    options: ['A', 'B'],
                    answer: 'A',
                    qNumber: 1,
                    notebookId: 'nb-uuid-1'
                }
            ];

            const result = ExportModule.validateIncomingPayload(payload, notebooks);
            expect(result.success).toBe(true);
            expect(result.floatingCount).toBe(0);
            expect(payload[0].notebookId).toBe('nb-uuid-1');
        });

        it('should resolve notebook by name/title and replace with UUID', () => {
            const notebooks = [{ id: 'nb-uuid-2', name: 'Cardiology' }];
            const payload = [
                {
                    id: 'q-2',
                    question: 'Test question 2',
                    type: 'mcq',
                    options: ['A', 'B'],
                    answer: 'A',
                    qNumber: 2,
                    notebookId: 'Cardiology'
                }
            ];

            const result = ExportModule.validateIncomingPayload(payload, notebooks);
            expect(result.success).toBe(true);
            expect(result.floatingCount).toBe(0);
            expect(payload[0].notebookId).toBe('nb-uuid-2');
        });

        it('should convert unmatching notebookId to null (floating fallback) and count it', () => {
            const notebooks = [{ id: 'nb-uuid-3', name: 'Pediatrics' }];
            const payload = [
                {
                    id: 'q-3',
                    question: 'Test question 3',
                    type: 'mcq',
                    options: ['A', 'B'],
                    answer: 'A',
                    qNumber: 3,
                    notebookId: 'NonExistentNotebook'
                }
            ];

            const result = ExportModule.validateIncomingPayload(payload, notebooks);
            expect(result.success).toBe(true);
            expect(result.floatingCount).toBe(1);
            expect(payload[0].notebookId).toBeNull();
        });

        it('should self-heal missing q.id and q.qNumber and invalid boolean answer', () => {
            const notebooks = [{ id: 'nb-uuid-4', name: 'Neurology' }];
            const payload = [
                {
                    question: 'Test boolean self-heal question',
                    type: 'boolean',
                    answer: 'true',
                    notebookId: 'nb-uuid-4'
                },
                {
                    id: '',
                    question: 'Test boolean self-heal question 2',
                    type: 'boolean',
                    answer: '',
                    notebookId: 'nb-uuid-4'
                }
            ];

            const result = ExportModule.validateIncomingPayload(payload, notebooks);
            expect(result.success).toBe(true);
            expect(result.floatingCount).toBe(0);
            
            // Check identity repair
            expect(payload[0].id).toBeDefined();
            expect(typeof payload[0].id).toBe('string');
            expect(payload[0].id.length).toBeGreaterThan(0);
            expect(payload[1].id).toBeDefined();
            expect(typeof payload[1].id).toBe('string');
            expect(payload[1].id.length).toBeGreaterThan(0);
            expect(payload[0].id).not.toBe(payload[1].id);

            // Check numbering repair
            expect(payload[0].qNumber).toBe(1);
            expect(payload[1].qNumber).toBe(2);

            // Check boolean correction
            expect(payload[0].answer).toBe(true);
            expect(payload[1].answer).toBe(false);
        });
    });
});
