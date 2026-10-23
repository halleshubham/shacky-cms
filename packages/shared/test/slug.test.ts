import { describe, it, expect } from 'vitest';
import { slugify, transliterateDevanagari } from '../src/utils/slug';

describe('slugify', () => {
  it('slugs plain English titles', () => {
    expect(slugify('Hello World!')).toBe('hello-world');
    expect(slugify('  Many   spaces  here ')).toBe('many-spaces-here');
  });

  it('collapses repeated hyphens and trims them', () => {
    expect(slugify('--a -- b--')).toBe('a-b');
  });

  it('keeps digits, underscores and hyphens', () => {
    expect(slugify('Issue 12_final-v2')).toBe('issue-12_final-v2');
  });

  it('returns an empty string when nothing sluggable remains', () => {
    expect(slugify('!!! ???')).toBe('');
  });

  it('never returns an empty slug for a Devanagari title (regression)', () => {
    expect(slugify('शिवयोगी सिध्दरामेश्वर विरचित बसव स्तोत्र')).toBe(
      'shivayogi-sidhdarameshvar-virachit-basav-stotr',
    );
  });

  it('transliterates Marathi to short ASCII', () => {
    expect(slugify('लिंगायत जागर')).toBe('lingayat-jagar');
    expect(slugify('महाराष्ट्र संस्कृती')).toBe('maharashtr-sanskriti');
  });

  it('handles Devanagari digits and mixed scripts', () => {
    expect(slugify('श्रीमंत ज्ञान १२३')).toBe('shrimant-jnyan-123');
    expect(slugify('Basava बसव 2026')).toBe('basava-basav-2026');
  });

  it('produces URL-safe ASCII for Devanagari input', () => {
    expect(slugify('कर्नाटक राज्योत्सव')).toMatch(/^[a-z0-9-]+$/);
  });
});

describe('transliterateDevanagari', () => {
  it('drops the inherent vowel at word end but keeps it inside words', () => {
    expect(transliterateDevanagari('कमल')).toBe('kamal');
  });

  it('applies the virama to join consonants', () => {
    expect(transliterateDevanagari('सत्य')).toBe('saty');
  });

  it('passes non-Devanagari text through untouched', () => {
    expect(transliterateDevanagari('abc 123')).toBe('abc 123');
  });
});
