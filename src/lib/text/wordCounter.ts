// lib/text/wordCounter.ts

export interface TextStats {
  words: number;
  characters: number;
  charactersNoSpaces: number;
  sentences: number;
  paragraphs: number;
  lines: number;
  readingTimeMin: number;
  readingTimeSec: number;
  uniqueWords: number;
  avgWordLength: number;
}

export function analyzeText(text: string): TextStats {
  if (!text.trim()) return { words: 0, characters: 0, charactersNoSpaces: 0, sentences: 0, paragraphs: 0, lines: 0, readingTimeMin: 0, readingTimeSec: 0, uniqueWords: 0, avgWordLength: 0 };

  const wordList = text.trim().split(/\s+/).filter(Boolean);
  const words = wordList.length;
  const characters = text.length;
  const charactersNoSpaces = text.replace(/\s/g, '').length;
  const sentences = (text.match(/[.!?]+/g) || []).length;
  const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim()).length;
  const lines = text.split('\n').length;

  // 200 wpm average reading speed
  const totalSec = Math.ceil((words / 200) * 60);
  const readingTimeMin = Math.floor(totalSec / 60);
  const readingTimeSec = totalSec % 60;

  const uniqueWords = new Set(
    wordList.map((w) => w.toLowerCase().replace(/[^\p{L}\p{M}\p{N}]/gu, '')).filter(Boolean)
  ).size;
  const avgWordLength = words > 0
    ? Math.round((wordList.reduce((s, w) => s + w.length, 0) / words) * 10) / 10
    : 0;

  return { words, characters, charactersNoSpaces, sentences, paragraphs, lines, readingTimeMin, readingTimeSec, uniqueWords, avgWordLength };
}

