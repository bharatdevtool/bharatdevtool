import { describe, it, expect } from 'vitest';
import { convertCase } from '@/lib/text/caseConverter';
import { analyzeText } from '@/lib/text/wordCounter';

describe('Text Case Converter', () => {
  it('converts to UPPERCASE', () => {
    expect(convertCase('hello world', 'uppercase')).toBe('HELLO WORLD');
    expect(convertCase('Hello World!', 'uppercase')).toBe('HELLO WORLD!');
  });

  it('converts to lowercase', () => {
    expect(convertCase('HELLO WORLD', 'lowercase')).toBe('hello world');
    expect(convertCase('Hello World!', 'lowercase')).toBe('hello world!');
  });

  it('converts to Title Case', () => {
    expect(convertCase('hello world', 'titleCase')).toBe('Hello World');
    expect(convertCase('HELLO WORLD', 'titleCase')).toBe('Hello World');
  });

  it('converts to Sentence case across sentences', () => {
    expect(convertCase('hello world. another sentence', 'sentenceCase')).toBe('Hello world. Another sentence');
    expect(convertCase('Hello world.', 'sentenceCase')).toBe('Hello world.');
  });

  it('converts to camelCase from multiple formats', () => {
    expect(convertCase('hello world', 'camelCase')).toBe('helloWorld');
    expect(convertCase('the quick brown fox', 'camelCase')).toBe('theQuickBrownFox');
    expect(convertCase('hello_world', 'camelCase')).toBe('helloWorld');
    expect(convertCase('hello-world', 'camelCase')).toBe('helloWorld');
    expect(convertCase('hello', 'camelCase')).toBe('hello');
  });

  it('converts to PascalCase from multiple formats', () => {
    expect(convertCase('hello world', 'pascalCase')).toBe('HelloWorld');
    expect(convertCase('the quick brown fox', 'pascalCase')).toBe('TheQuickBrownFox');
    expect(convertCase('hello_world', 'pascalCase')).toBe('HelloWorld');
  });

  it('converts to snake_case from multiple formats', () => {
    expect(convertCase('hello world', 'snakeCase')).toBe('hello_world');
    expect(convertCase('The Quick Brown Fox', 'snakeCase')).toBe('the_quick_brown_fox');
    expect(convertCase('helloWorld', 'snakeCase')).toBe('hello_world');
  });

  it('converts to kebab-case from multiple formats', () => {
    expect(convertCase('hello world', 'kebabCase')).toBe('hello-world');
    expect(convertCase('The Quick Brown Fox', 'kebabCase')).toBe('the-quick-brown-fox');
    expect(convertCase('hello_world', 'kebabCase')).toBe('hello-world');
  });

  it('converts to CONSTANT_CASE', () => {
    expect(convertCase('hello world', 'constantCase')).toBe('HELLO_WORLD');
    expect(convertCase('The Quick Brown Fox', 'constantCase')).toBe('THE_QUICK_BROWN_FOX');
  });

  it('converts to dot.case', () => {
    expect(convertCase('hello world', 'dotCase')).toBe('hello.world');
  });

  it('converts to alternating and toggle case', () => {
    expect(convertCase('hello', 'alternatingCase')).toBe('hElLo');
    expect(convertCase('Hello World', 'toggleCase')).toBe('hELLO wORLD');
  });

  it('converts to URL slug', () => {
    expect(convertCase('Hello World', 'slugCase')).toBe('hello-world');
    expect(convertCase('Hello, World!', 'slugCase')).toBe('hello-world');
    expect(convertCase('hello   world', 'slugCase')).toBe('hello-world');
  });

  it('handles empty strings gracefully', () => {
    expect(convertCase('', 'uppercase')).toBe('');
    expect(convertCase('', 'camelCase')).toBe('');
    expect(convertCase('', 'slugCase')).toBe('');
  });
});

describe('Word Counter & Text Analyzer', () => {
  it('analyzes standard paragraph text accurately', () => {
    const text = 'The quick brown fox jumps over the lazy dog. It was a sunny day!';
    const stats = analyzeText(text);

    expect(stats.words).toBe(14);
    expect(stats.sentences).toBe(2);
    expect(stats.characters).toBe(text.length);
    expect(stats.charactersNoSpaces).toBe(text.replace(/\s/g, '').length);
    expect(stats.paragraphs).toBe(1);
    expect(stats.lines).toBe(1);
    expect(stats.uniqueWords).toBeGreaterThan(0);
  });

  it('handles multi-paragraph and multi-line text', () => {
    const text = 'Paragraph one line one.\nParagraph one line two.\n\nParagraph two.';
    const stats = analyzeText(text);

    expect(stats.paragraphs).toBe(2);
    expect(stats.lines).toBe(4);
  });

  it('calculates realistic reading and speaking times', () => {
    // 200 words at 200 wpm = 1 min
    const words = Array.from({ length: 200 }, () => 'word').join(' ');
    const stats = analyzeText(words);

    expect(stats.readingTimeMin).toBe(1);
    expect(stats.readingTimeSec).toBe(0);
  });

  it('handles empty text correctly with zeroed stats', () => {
    const stats = analyzeText('   \n  ');
    expect(stats.words).toBe(0);
    expect(stats.characters).toBe(0);
    expect(stats.sentences).toBe(0);
    expect(stats.paragraphs).toBe(0);
  });
});
