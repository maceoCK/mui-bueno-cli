import { describe, it, expect } from 'vitest';
import { isFormatted, removeStrayProps, isNumber, isLetter, autoformat, makeLabel, renderValue } from './index';
import { SelectOption } from '../../components/Form/Inputs/Select/Select';

describe('isFormatted', () => {
    it('should return true for correctly formatted strings', () => {
        expect(isFormatted('ABC123', 'XXX999')).toBe(true);
        expect(isFormatted('A1B2C3', 'X9X9X9')).toBe(true);
    });

    it('should return false for incorrectly formatted strings', () => {
        expect(isFormatted('ABC123', 'XXX99')).toBe(false);
        expect(isFormatted('A1B2C3', 'X9X9X')).toBe(false);
        expect(isFormatted('123ABC', 'XXX999')).toBe(false);
    });

    it('should handle empty format strings', () => {
        expect(isFormatted('ABC123', '')).toBe(true);
    });
});

describe('removeStrayProps', () => {
    it('should remove specified props', () => {
        const props = { a: 1, b: 2, c: 3 };
        const result = removeStrayProps(props, ['b']);
        expect(result).toEqual({ a: 1, c: 3 });
    });

    it('should handle empty omit list', () => {
        const props = { a: 1, b: 2, c: 3 };
        const result = removeStrayProps(props, []);
        expect(result).toEqual(props);
    });

    it('should handle props not in the omit list', () => {
        const props = { a: 1, b: 2, c: 3 };
        const result = removeStrayProps(props, ['d']);
        expect(result).toEqual(props);
    });
});

describe('isNumber', () => {
    it('should return true for numeric characters', () => {
        expect(isNumber(48)).toBe(true); // '0'
        expect(isNumber(57)).toBe(true); // '9'
    });

    it('should return false for non-numeric characters', () => {
        expect(isNumber(65)).toBe(false); // 'A'
        expect(isNumber(32)).toBe(false); // ' '
    });
});

describe('isLetter', () => {
    it('should return true for alphabetic characters', () => {
        expect(isLetter(65)).toBe(true); // 'A'
        expect(isLetter(122)).toBe(true); // 'z'
    });

    it('should return false for non-alphabetic characters', () => {
        expect(isLetter(48)).toBe(false); // '0'
        expect(isLetter(32)).toBe(false); // ' '
    });
});

describe('autoformat', () => {
    it('should format input according to the format string', () => {
        const inputElement = document.createElement('input');
        inputElement.value = 'A1B2C3';
        expect(autoformat('A1B2C3', 'X9X9X9', '', inputElement)).toBe('A1B2C3');
    });

    it('should handle incorrect input gracefully', () => {
        const inputElement = document.createElement('input');
        inputElement.value = '123ABC';
        expect(autoformat('123ABC', 'XXX999', '', inputElement)).toBe('ABC');
    });
});

describe('makeLabel', () => {
    it('should convert camelCase to spaced words', () => {
        expect(makeLabel('camelCaseString')).toBe('Camel Case String');
    });

    it('should handle strings with underscores', () => {
        expect(makeLabel('snake_case_string')).toBe('Snake Case String');
    });

    it('should handle strings with hyphens', () => {
        expect(makeLabel('kebab-case-string')).toBe('Kebab Case String');
    });

    it('should handle strings with periods', () => {
        expect(makeLabel('dot.case.string')).toBe('Dot Case String');
    });

    it('should handle strings with mixed special characters & casing', () => {
        expect(makeLabel('_mixed.-caseString.')).toBe('Mixed Case String');
    });
});

describe('renderValue', () => {
    const options: SelectOption<string>[] = [
        { value: '1', label: 'One' },
        { value: '2', label: 'Two' },
        { value: '3', label: 'Three' },
    ];

    it('should return the correct label for a single value', () => {
        expect(renderValue(options, '1')).toBe('One');
    });

    it('should return a comma-separated string for multiple values', () => {
        expect(renderValue(options, '1,2', true)).toBe('One, Two');
    });

    it('should return the placeholder if value is undefined or empty', () => {
        expect(renderValue(options, undefined, false, 'Placeholder')).toBe('Placeholder');
        expect(renderValue(options, '', false, 'Placeholder')).toBe('Placeholder');
    });
});
