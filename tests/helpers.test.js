/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { Helpers } from '../src/utils/helpers.js';

describe('Helpers Utility Tests', () => {
    it('should sanitize HTML tags correctly', () => {
        const input = '<script>alert("xss")</script><b>Hello</b>';
        const output = Helpers.sanitize(input);
        expect(output).not.toContain('<script>');
        expect(output).toContain('&lt;script&gt;');
    });

    it('should calculate string similarity correctly', () => {
        const s1 = 'What is the capital of France?';
        const s2 = 'What is the capital of France?';
        const s3 = 'What is the capital of Germany?';
        
        expect(Helpers.calculateSimilarity(s1, s2)).toBe(1.0);
        expect(Helpers.calculateSimilarity(s1, s3)).toBeLessThan(1.0);
        expect(Helpers.calculateSimilarity(s1, s3)).toBeGreaterThan(0.7);
    });

    it('should repair common AI JSON errors', () => {
        const brokenJson = `{
            "question": "Line 1
Line 2",
            "answer": "A"
        }`;
        const repaired = Helpers.sanitizeJsonString(brokenJson);
        expect(() => JSON.parse(repaired)).not.toThrow();
        expect(JSON.parse(repaired).question).toBe("Line 1\nLine 2");
    });

    it('should perform fuzzy matching', () => {
        const text = "The quick brown fox jumps over the lazy dog";
        expect(Helpers.fuzzyMatch(text, "quick fox")).toBe(true);
        expect(Helpers.fuzzyMatch(text, "lazy dog")).toBe(true);
        expect(Helpers.fuzzyMatch(text, "blue cat")).toBe(false);
    });

    it('should handle invalid escape sequences in JSON', () => {
        const input = '{"text": "Don\\\'t do it"}';
        const repaired = Helpers.sanitizeJsonString(input);
        expect(JSON.parse(repaired).text).toBe("Don't do it");
    });
});
