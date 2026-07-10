'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, Square, Volume2 } from 'lucide-react';

function stripHtml(html: string): string {
  const div = document.createElement('div');
  div.innerHTML = html;
  return (div.textContent || div.innerText || '').replace(/\s+/g, ' ').trim();
}

// Split into sentence-sized chunks so Chrome's ~15s speech limit doesn't cut off mid-article.
// Uses match() instead of lookbehind split() — broader browser support.
function chunkText(text: string): string[] {
  const sentences = text.match(/[^.!?।]+[.!?।\s]*/g) || [text];
  const chunks: string[] = [];
  let current = '';
  for (const s of sentences) {
    if (!s.trim()) continue;
    if (current.length + s.length > 200) {
      if (current.trim()) chunks.push(current.trim());
      current = s;
    } else {
      current += s;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

export function TextToSpeech({ content, language }: { content: string; language: string }) {
  const [status, setStatus] = useState<'idle' | 'playing' | 'paused'>('idle');
  const [supported, setSupported] = useState(false);
  const chunksRef = useRef<string[]>([]);
  const chunkIdxRef = useRef(0);
  const activeRef = useRef(false);
  const keepAliveRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Chrome garbage-collects SpeechSynthesisUtterance objects mid-speech if nothing
  // outside the browser's internal queue holds a reference — keep one alive here.
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    setSupported('speechSynthesis' in window);
    return () => {
      window.speechSynthesis?.cancel();
      if (keepAliveRef.current) clearInterval(keepAliveRef.current);
    };
  }, []);

  // Chrome pauses speechSynthesis when tab goes to background; keep-alive every 10s
  const startKeepAlive = () => {
    keepAliveRef.current = setInterval(() => {
      if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
        window.speechSynthesis.pause();
        window.speechSynthesis.resume();
      }
    }, 10000);
  };

  const stopKeepAlive = () => {
    if (keepAliveRef.current) { clearInterval(keepAliveRef.current); keepAliveRef.current = null; }
  };

  const speakChunk = useCallback((index: number) => {
    if (!activeRef.current || index >= chunksRef.current.length) {
      setStatus('idle');
      activeRef.current = false;
      stopKeepAlive();
      return;
    }
    const utt = new SpeechSynthesisUtterance(chunksRef.current[index]);
    utt.lang = language;
    utt.rate = 0.85;
    utt.onend = () => {
      chunkIdxRef.current = index + 1;
      // Chrome silently drops speak() called synchronously inside onend — defer by one tick
      setTimeout(() => speakChunk(index + 1), 0);
    };
    utt.onerror = (e) => {
      if (e.error !== 'interrupted') { setStatus('idle'); activeRef.current = false; stopKeepAlive(); }
    };
    utteranceRef.current = utt;
    window.speechSynthesis.speak(utt);
  }, [language]);

  const play = () => {
    if (status === 'paused') {
      activeRef.current = true;
      window.speechSynthesis.resume();
      setStatus('playing');
      startKeepAlive();
      return;
    }
    window.speechSynthesis.cancel();
    const text = stripHtml(content);
    chunksRef.current = chunkText(text);
    chunkIdxRef.current = 0;
    activeRef.current = true;
    setStatus('playing');
    startKeepAlive();
    // Small delay so cancel() clears the queue first
    setTimeout(() => speakChunk(0), 50);
  };

  const pause = () => {
    window.speechSynthesis.pause();
    stopKeepAlive();
    setStatus('paused');
  };

  const stop = () => {
    activeRef.current = false;
    window.speechSynthesis.cancel();
    stopKeepAlive();
    utteranceRef.current = null;
    setStatus('idle');
  };

  if (!supported) return null;

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <Volume2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <span className="text-xs text-muted-foreground">Listen:</span>

      {status !== 'playing' && (
        <button
          onClick={play}
          className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border border-border text-muted-foreground hover:text-foreground hover:border-foreground transition-colors"
        >
          <Play className="h-3 w-3" />
          {status === 'paused' ? 'Resume' : 'Play'}
        </button>
      )}

      {status === 'playing' && (
        <button
          onClick={pause}
          className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border bg-primary text-primary-foreground border-primary transition-colors"
        >
          <Pause className="h-3 w-3" />
          Pause
        </button>
      )}

      {status !== 'idle' && (
        <button
          onClick={stop}
          className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border border-border text-muted-foreground hover:text-foreground hover:border-foreground transition-colors"
        >
          <Square className="h-3 w-3" />
          Stop
        </button>
      )}
    </div>
  );
}
