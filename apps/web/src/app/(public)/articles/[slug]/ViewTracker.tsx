'use client';
import { useEffect } from 'react';

const API = process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL;

export function ViewTracker({ postId }: { postId: string }) {
  useEffect(() => {
    fetch(`${API}/api/posts/${postId}/view`, { method: 'POST' }).catch(() => {});
  }, [postId]);
  return null;
}
