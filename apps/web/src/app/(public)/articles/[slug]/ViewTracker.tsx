'use client';
import { useEffect } from 'react';

const API = '';

export function ViewTracker({ postId }: { postId: string }) {
  useEffect(() => {
    fetch(`${API}/api/posts/${postId}/view`, { method: 'POST' }).catch(() => {});
  }, [postId]);
  return null;
}
