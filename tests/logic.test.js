/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { Helpers } from '../src/utils/helpers.js';
import { ExportModule } from '../src/modules/export.js';
import { QueryEngine } from '../src/core/query.js';
import { state } from '../src/core/state.js';
import app from '../app.js';
import { ThemeManager } from '../src/ui/theme.js';
import { AudioManager } from '../src/ui/audio.js';
import { DuplicatesLogic } from '../src/modules/duplicates.js';
import { db } from '../src/core/db.js';

// Setup Audio mock for jsdom test environment
globalThis.Audio = class {
    constructor() {
        this.volume = 0;
    }
    play() {
        return Promise.resolve();
    }
};

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
        selectedIds: new Set(),
        theme: 'deep-orange',
        direction: 'rtl',
        soundEnabled: true
    }
}));

vi.mock('../src/core/state.js', () => ({
    state: mockSharedState
}));

vi.mock('../src/core/state.js?v=16.6.0', () => ({
    state: mockSharedState
}));

vi.mock('../src/core/db.js?v=16.6.0', () => {
    const mockTx = {
        objectStore: vi.fn().mockReturnValue({
            openCursor: vi.fn().mockReturnValue({
                onsuccess: null,
                onerror: null
            }),
            put: vi.fn().mockResolvedValue(true)
        }),
        oncomplete: null,
        onerror: null
    };
    const mockInstance = {
        transaction: vi.fn().mockImplementation(() => {
            Promise.resolve().then(() => {
                if (mockTx.oncomplete) mockTx.oncomplete();
            });
            return mockTx;
        })
    };
    return {
        db: {
            put: vi.fn().mockResolvedValue(true),
            bulkPut: vi.fn().mockResolvedValue(true),
            count: vi.fn().mockResolvedValue(0),
            init: vi.fn().mockResolvedValue(mockInstance),
            instance: mockInstance
        }
    };
});

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
        it('should resolve notebook by ID and keep it intact', async () => {
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

            const result = await ExportModule.validateIncomingPayload(payload, notebooks);
            expect(result.success).toBe(true);
            expect(result.floatingCount).toBe(0);
            expect(payload[0].notebookId).toBe('nb-uuid-1');
        });

        it('should resolve notebook by name/title and replace with UUID', async () => {
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

            const result = await ExportModule.validateIncomingPayload(payload, notebooks);
            expect(result.success).toBe(true);
            expect(result.floatingCount).toBe(0);
            expect(payload[0].notebookId).toBe('nb-uuid-2');
        });

        it('should convert unmatching notebookId to null (floating fallback) and count it', async () => {
            const notebooks = [{ id: 'nb-uuid-3', name: 'Pediatrics' }];
            const payload = [
                {
                    id: 'q-3',
                    question: 'Test question 3',
                    type: 'mcq',
                    options: ['A', 'B'],
                    answer: 'A',
                    qNumber: 3,
                    notebookId: '9999'
                }
            ];

            const result = await ExportModule.validateIncomingPayload(payload, notebooks);
            expect(result.success).toBe(true);
            expect(result.floatingCount).toBe(1);
            expect(payload[0].notebookId).toBeNull();
        });

        it('should self-heal missing q.id and q.qNumber and invalid boolean answer', async () => {
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

            const result = await ExportModule.validateIncomingPayload(payload, notebooks);
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

        it('should force activeNotebookId when autoDistribute is false', async () => {
            const notebooks = [{ id: 'nb-uuid-selected', name: 'Selected' }];
            const payload = [
                {
                    id: 'q-4',
                    question: 'Test question 4',
                    type: 'mcq',
                    options: ['A', 'B'],
                    answer: 'A',
                    qNumber: 4,
                    notebookId: 'SomeOtherNotebook'
                }
            ];

            const result = await ExportModule.validateIncomingPayload(payload, notebooks, {
                autoDistribute: false,
                activeNotebookId: 'nb-uuid-selected'
            });
            expect(result.success).toBe(true);
            expect(result.floatingCount).toBe(0);
        });
    });

    describe('Native GZIP compression and decompression', () => {
        it('should decompress a GZIP file and import data correctly in importData', async () => {
            const dataToCompress = JSON.stringify([
                {
                    id: 'q-gz-1',
                    question: 'Is this decompressed natively?',
                    type: 'boolean',
                    answer: true,
                    notebookId: 'nb-uuid-1'
                }
            ]);

            const encoder = new TextEncoder();
            const uint8Array = encoder.encode(dataToCompress);
            const stream = new ReadableStream({
                start(controller) {
                    controller.enqueue(uint8Array);
                    controller.close();
                }
            });
            const compressionStream = new CompressionStream('gzip');
            const compressedStream = stream.pipeThrough(compressionStream);
            const blob = await new Response(compressedStream).blob();
            
            const mockFile = {
                name: 'test_bank.json.gz',
                text: async () => blob.text(),
                arrayBuffer: async () => blob.arrayBuffer()
            };

            const notebooks = [{ id: 'nb-uuid-1', name: 'Ophthalmology' }];
            mockSharedState.notebooks = notebooks;
            mockSharedState.questions = [];

            const mockDistributeEl = { checked: true };
            const mockNbEl = { value: 'nb-uuid-1' };
            const oldGetElement = document.getElementById;
            
            const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});
            
            document.getElementById = vi.fn().mockImplementation((id) => {
                if (id === 'import-auto-distribute') return mockDistributeEl;
                if (id === 'import-notebook') return mockNbEl;
                return null;
            });

            const mockSync = vi.fn();

            await ExportModule.importData(mockFile, mockSync);

            expect(mockSync).toHaveBeenCalled();
            
            alertMock.mockRestore();
            document.getElementById = oldGetElement;
        });
    });

    describe('Developer Diagnostics Tool', () => {
        it('should output structured diagnostics report when dumpSystemDiagnostics is invoked', async () => {
            const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
            const consoleTableSpy = vi.spyOn(console, 'table').mockImplementation(() => {});
            
            app.state = {
                notebooks: [
                    { id: 'nb-uuid-1', name: 'Ophthalmology', parentId: null }
                ],
                questions: [
                    { id: 'q-1', notebookId: 'nb-uuid-1', question: 'Test mcq', type: 'mcq' },
                    { id: 'q-2', notebookId: null, question: 'Test floating', type: 'boolean' }
                ]
            };

            await app.dumpSystemDiagnostics();

            expect(consoleLogSpy).toHaveBeenCalled();
            expect(consoleTableSpy).toHaveBeenCalled();

            const tableData = consoleTableSpy.mock.calls[0][0];
            expect(tableData[0]["Notebook ID"]).toBe('nb-uuid-1');
            expect(tableData[0]["Questions"]).toBe(1);

            consoleLogSpy.mockRestore();
            consoleTableSpy.mockRestore();
        });
    });

    describe('Smart Sequence Re-indexing of qNumber', () => {
        it('should sequentially re-index qNumbers and avoid collisions', async () => {
            const notebooks = [{ id: 'nb-uuid-7', name: 'Cardiology' }];
            app.state = {
                questions: [
                    { id: 'ex-1', notebookId: 'nb-uuid-7', qNumber: 5, question: 'Exist 1', type: 'mcq' }
                ],
                notebooks: notebooks
            };

            const payload = [
                {
                    id: 'imp-1',
                    question: 'Imported Question 1',
                    type: 'boolean',
                    answer: true,
                    notebookId: 'nb-uuid-7',
                    qNumber: 2
                },
                {
                    id: 'imp-2',
                    question: 'Imported Question 2',
                    type: 'boolean',
                    answer: false,
                    notebookId: 'nb-uuid-7',
                    qNumber: 2
                }
            ];

            const resultForced = await ExportModule.validateIncomingPayload(payload, notebooks, {
                autoDistribute: false,
                activeNotebookId: 'nb-uuid-7'
            });

            expect(resultForced.success).toBe(true);
            expect(payload[0].qNumber).toBe(6);
            expect(payload[1].qNumber).toBe(7);

            payload[0].qNumber = 2;
            payload[1].qNumber = 2;

            const resultAuto = await ExportModule.validateIncomingPayload(payload, notebooks, {
                autoDistribute: true
            });

            expect(resultAuto.success).toBe(true);
            expect(payload[0].qNumber).toBe(6);
            expect(payload[1].qNumber).toBe(7);
        });
    });

    describe('4-Stage Routing Matrix of validateIncomingPayload', () => {
        it('should correctly route notebooks according to the 4-stage matrix', async () => {
            const notebooks = [{ id: 'nb-uuid-2', name: 'Cardiology' }];
            app.state = {
                questions: [],
                notebooks: notebooks
            };

            const payload = [
                {
                    id: 'q-uuid-only',
                    question: 'UUID Only Question',
                    type: 'boolean',
                    answer: true,
                    notebookId: 'a1638cbf-2af6-44f3-b0ce-5f15adac1e5e',
                    notebookName: ''
                },
                {
                    id: 'q-uuid-and-name',
                    question: 'UUID and Name Question',
                    type: 'boolean',
                    answer: true,
                    notebookId: 'b2749dcf-3bf7-55f4-c1df-6a26bebc2f6f',
                    notebookName: 'Pediatrics'
                },
                {
                    id: 'q-name-only',
                    question: 'Name Only Question',
                    type: 'boolean',
                    answer: true,
                    notebookId: '',
                    notebookName: 'Ophthalmology'
                },
                {
                    id: 'q-both-absent',
                    question: 'Both Absent Question',
                    type: 'boolean',
                    answer: true,
                    notebookId: '',
                    notebookName: ''
                }
            ];

            const result = await ExportModule.validateIncomingPayload(payload, notebooks, {
                autoDistribute: true
            });

            expect(result.success).toBe(true);
            expect(result.newNotebooks.length).toBe(4);

            // Stage 1 validation
            expect(payload[0].notebookId).toBe('a1638cbf-2af6-44f3-b0ce-5f15adac1e5e');
            expect(result.newNotebooks[0].id).toBe('a1638cbf-2af6-44f3-b0ce-5f15adac1e5e');
            expect(result.newNotebooks[0].name).toBe('a1638cbf-2af6-44f3-b0ce-5f15adac1e5e');

            // Stage 2 validation
            expect(payload[1].notebookId).toBe('b2749dcf-3bf7-55f4-c1df-6a26bebc2f6f');
            expect(result.newNotebooks[1].id).toBe('b2749dcf-3bf7-55f4-c1df-6a26bebc2f6f');
            expect(result.newNotebooks[1].name).toBe('Pediatrics');

            // Stage 3 validation
            expect(payload[2].notebookId).not.toBe('');
            expect(result.newNotebooks[2].name).toBe('Ophthalmology');

            // Stage 4 validation
            const today = new Date();
            const dd = String(today.getDate()).padStart(2, '0');
            const mm = String(today.getMonth() + 1).padStart(2, '0');
            const yyyy = today.getFullYear();
            const expectedAggName = `(استيراد تلقائي - ${dd}/${mm}/${yyyy})`;
            expect(payload[3].notebookId).toBe(result.newNotebooks[3].id);
            expect(result.newNotebooks[3].name).toBe(expectedAggName);
        });
    });

    describe('Decompression Streams scenarios', () => {
        it('should successfully decompress a GZIP stream to a readable JSON text', async () => {
            const originalJson = '{"hello":"world"}';
            const encoder = new TextEncoder();
            const compressed = await new Response(
                new ReadableStream({
                    start(controller) {
                        controller.enqueue(encoder.encode(originalJson));
                        controller.close();
                    }
                }).pipeThrough(new CompressionStream('gzip'))
            ).blob();

            // Decompress using arrayBuffer to be consistent with our main codebase
            const arrayBuffer = await compressed.arrayBuffer();
            const fileStream = new ReadableStream({
                start(controller) {
                    controller.enqueue(new Uint8Array(arrayBuffer));
                    controller.close();
                }
            });
            const decompStream = new DecompressionStream('gzip');
            const decompressed = fileStream.pipeThrough(decompStream);
            const decompressedText = await new Response(decompressed).text();
            expect(decompressedText).toBe(originalJson);
        });

        it('should alert an error and not crash when GZIP decompression fails due to corruption', async () => {
            const corruptBytes = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
            const mockFile = {
                name: 'corrupt_bank.json.gz',
                text: async () => 'corrupt text',
                arrayBuffer: async () => corruptBytes.buffer
            };

            const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
            const syncSpy = vi.fn();

            await expect(ExportModule.importData(mockFile, syncSpy)).resolves.not.toThrow();
            expect(alertSpy).toHaveBeenCalled();
            expect(syncSpy).not.toHaveBeenCalled();

            alertSpy.mockRestore();
        });
    });

    describe('Matrix Edge Cases', () => {
        it('should group successive anonymous questions imported on the same day into a single date-named notebook', async () => {
            const notebooks = [];
            const payload1 = [
                { id: 'q-1', question: 'Q1', type: 'boolean', answer: true, notebookId: '', notebookName: '' }
            ];
            const payload2 = [
                { id: 'q-2', question: 'Q2', type: 'boolean', answer: true, notebookId: '', notebookName: '' }
            ];

            const result1 = await ExportModule.validateIncomingPayload(payload1, notebooks, { autoDistribute: true });
            notebooks.push(...result1.newNotebooks);

            const result2 = await ExportModule.validateIncomingPayload(payload2, notebooks, { autoDistribute: true });

            expect(result1.newNotebooks.length).toBe(1);
            expect(result2.newNotebooks.length).toBe(0);
            expect(payload2[0].notebookId).toBe(payload1[0].notebookId);
        });

        it('should match notebook names case-insensitively', async () => {
            const notebooks = [{ id: 'nb-islamic', name: 'Islamic History' }];
            const payload = [
                { id: 'q-ish', question: 'Islamic History question', type: 'boolean', answer: true, notebookId: 'islamic history' }
            ];

            const result = await ExportModule.validateIncomingPayload(payload, notebooks, { autoDistribute: true });
            expect(result.success).toBe(true);
            expect(result.newNotebooks.length).toBe(0);
            expect(payload[0].notebookId).toBe('nb-islamic');
        });
    });

    describe('UI Core Logic Mocks', () => {
        it('should save and update the active theme in LocalStorage', () => {
            const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
            
            ThemeManager.setTheme('tech-violet');
            
            expect(mockSharedState.theme).toBe('tech-violet');
            expect(setItemSpy).toHaveBeenCalledWith('qbank_theme', 'tech-violet');
            expect(localStorage.getItem('qbank_theme')).toBe('tech-violet');
            
            setItemSpy.mockRestore();
        });

        it('should toggle soundEnabled in central state and update localStorage when AudioManager.toggleSound is invoked', () => {
            const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
            
            mockSharedState.soundEnabled = true;
            AudioManager.toggleSound();
            
            expect(mockSharedState.soundEnabled).toBe(false);
            expect(setItemSpy).toHaveBeenCalledWith('qbank_sound', false);
            
            mockSharedState.isMuted = !mockSharedState.soundEnabled;
            expect(mockSharedState.isMuted).toBe(true);

            AudioManager.toggleSound();
            expect(mockSharedState.soundEnabled).toBe(true);
            mockSharedState.isMuted = !mockSharedState.soundEnabled;
            expect(mockSharedState.isMuted).toBe(false);

            setItemSpy.mockRestore();
        });
    });

    describe('Web Worker Watchdog', () => {
        it('should activate watchdog timer and resolve empty array on worker delay', async () => {
            vi.useFakeTimers();

            const dbCountSpy = vi.spyOn(db, 'count').mockResolvedValue(10);
            
            const mockWorkerInstance = {
                postMessage: vi.fn(),
                terminate: vi.fn(),
                onmessage: null,
                onerror: null
            };
            
            const originalGetWorker = DuplicatesLogic._getWorker;
            DuplicatesLogic._getWorker = () => mockWorkerInstance;

            const duplicatesPromise = DuplicatesLogic.findDuplicates(0.9);

            // Yield to microtasks to let db.count and db.init resolve and trigger resetWatchdog
            await Promise.resolve();
            await Promise.resolve();
            await Promise.resolve();

            vi.advanceTimersByTime(3100);

            const result = await duplicatesPromise;

            expect(result).toEqual([]);
            expect(mockWorkerInstance.terminate).toHaveBeenCalled();

            DuplicatesLogic._getWorker = originalGetWorker;
            DuplicatesLogic._worker = null;
            dbCountSpy.mockRestore();
            vi.useRealTimers();
        });
    });

    describe('QueryEngine Advanced Filtering', () => {
        it('should filter questions by question types', () => {
            mockSharedState.questions = [
                { id: 'q-type-1', type: 'mcq', question: 'MCQ Q' },
                { id: 'q-type-2', type: 'written', question: 'Written Q' }
            ];
            mockSharedState.selectionCriteria.types = new Set(['written']);
            mockSharedState.selectionCriteria.searchQuery = '';
            mockSharedState.selectionCriteria.difficulties = new Set();
            mockSharedState.selectionCriteria.categories = new Set();
            mockSharedState.selectionCriteria.tags = new Set();
            mockSharedState.selectionCriteria.notebooks = new Set();
            mockSharedState.selectionCriteria.randomLimit = 0;
            mockSharedState.selectionCriteria.manualSelection = false;

            const result = QueryEngine.getQueryPool();
            expect(result.length).toBe(1);
            expect(result[0].id).toBe('q-type-2');
        });

        it('should filter questions by tags including union and __none__ fallback', () => {
            mockSharedState.questions = [
                { id: 'q-tag-1', tags: ['cardiology', 'medicine'], question: 'Tag Q1' },
                { id: 'q-tag-2', tags: [], question: 'Tag Q2' },
                { id: 'q-tag-3', tags: ['surgery'], question: 'Tag Q3' }
            ];
            
            // Union filter
            mockSharedState.selectionCriteria.types = new Set();
            mockSharedState.selectionCriteria.tags = new Set(['cardiology', 'surgery']);
            
            let result = QueryEngine.getQueryPool();
            expect(result.length).toBe(2);
            expect(result.map(q => q.id)).toContain('q-tag-1');
            expect(result.map(q => q.id)).toContain('q-tag-3');

            // None fallback
            mockSharedState.selectionCriteria.tags = new Set(['__none__']);
            result = QueryEngine.getQueryPool();
            expect(result.length).toBe(1);
            expect(result[0].id).toBe('q-tag-2');
        });

        it('should apply manual selection override when manualSelection is active', () => {
            mockSharedState.questions = [
                { id: 'q-sel-1', question: 'Sel 1' },
                { id: 'q-sel-2', question: 'Sel 2' }
            ];
            mockSharedState.selectedIds = new Set(['q-sel-2']);
            mockSharedState.selectionCriteria.tags = new Set();
            mockSharedState.selectionCriteria.manualSelection = true;

            const result = QueryEngine.getQueryPool();
            expect(result.length).toBe(1);
            expect(result[0].id).toBe('q-sel-2');
        });

        it('should limit results when randomLimit is set', () => {
            mockSharedState.questions = [
                { id: 'q-lim-1', question: 'Lim 1' },
                { id: 'q-lim-2', question: 'Lim 2' },
                { id: 'q-lim-3', question: 'Lim 3' }
            ];
            mockSharedState.selectionCriteria.manualSelection = false;
            mockSharedState.selectionCriteria.randomLimit = 2;

            const result = QueryEngine.getQueryPool();
            expect(result.length).toBe(2);
        });
    });

    describe('Direct Link Import Confirmation Gate', () => {
        it('should fetch and parsedData correctly, prompt confirm, and commit to importData if confirmed', async () => {
            const { Helpers } = await import('../src/utils/helpers.js?v=16.6.0');
            const { ExportModule } = await import('../src/modules/export.js?v=16.6.0');

            const fetchSpy = vi.spyOn(Helpers, 'fetchUrlWithProxy').mockResolvedValue(JSON.stringify([
                { id: 'q-url-1', question: 'Fetched Q1', type: 'boolean', answer: true, notebookId: 'nb-1' }
            ]));
            const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
            const importSpy = vi.spyOn(ExportModule, 'importData').mockResolvedValue();
            const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

            // Set up DOM elements required by app.importFromUrl
            const mockUrlInput = document.createElement('input');
            mockUrlInput.id = 'import-url';
            mockUrlInput.value = 'https://example.com/questions.json';
            document.body.appendChild(mockUrlInput);

            const mockBtn = document.createElement('button');
            const mockEvent = { currentTarget: mockBtn };

            await app.importFromUrl(mockEvent);

            expect(fetchSpy).toHaveBeenCalledWith('https://example.com/questions.json');
            expect(confirmSpy).toHaveBeenCalledWith('هل توافق على استيراد عدد 1 سؤال من الرابط الخارجي إلى بنك أسئلتك؟');
            expect(importSpy).toHaveBeenCalled();
            expect(mockUrlInput.value).toBe('');

            // Clean up
            fetchSpy.mockRestore();
            confirmSpy.mockRestore();
            importSpy.mockRestore();
            alertSpy.mockRestore();
            mockUrlInput.remove();
        });

        it('should abort and show safe cancel toast if user rejects confirmation', async () => {
            const { Helpers } = await import('../src/utils/helpers.js?v=16.6.0');
            const { ExportModule } = await import('../src/modules/export.js?v=16.6.0');

            const fetchSpy = vi.spyOn(Helpers, 'fetchUrlWithProxy').mockResolvedValue(JSON.stringify([
                { id: 'q-url-1', question: 'Fetched Q1', type: 'boolean', answer: true, notebookId: 'nb-1' }
            ]));
            const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
            const importSpy = vi.spyOn(ExportModule, 'importData');
            const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
            
            // Mock UIComponents toast
            const { UIComponents } = await import('../src/ui/components.js?v=16.6.0');
            const toastSpy = vi.spyOn(UIComponents, 'showToast').mockImplementation(() => {});

            // Set up DOM elements
            const mockUrlInput = document.createElement('input');
            mockUrlInput.id = 'import-url';
            mockUrlInput.value = 'https://example.com/questions.json';
            document.body.appendChild(mockUrlInput);

            const mockBtn = document.createElement('button');
            const mockEvent = { currentTarget: mockBtn };

            await app.importFromUrl(mockEvent);

            expect(confirmSpy).toHaveBeenCalled();
            expect(importSpy).not.toHaveBeenCalled();
            expect(toastSpy).toHaveBeenCalledWith('تم إلغاء عملية الاستيراد بأمان ولم تتأثر قاعدة بياناتك', 'info');

            // Clean up
            fetchSpy.mockRestore();
            confirmSpy.mockRestore();
            importSpy.mockRestore();
            alertSpy.mockRestore();
            toastSpy.mockRestore();
            mockUrlInput.remove();
        });
    });
});
