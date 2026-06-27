'use client';
import { useEffect } from 'react';

export function ViewTracker({ postId }: { postId: string }) {
  useEffect(() => {
    fetch(`/api/posts/${postId}/view`, { method: 'POST' }).catch(() => {});
  }, [postId]);
  return null;
}
