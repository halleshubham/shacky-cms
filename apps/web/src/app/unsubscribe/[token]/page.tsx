'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';

export default function UnsubscribePage() {
  const { token } = useParams<{ token: string }>();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    api.get(`/api/subscribers/unsubscribe/${token}`)
      .then((data: any) => {
        setStatus('success');
        setMessage(data.message || 'You have been unsubscribed.');
      })
      .catch((err: any) => {
        setStatus('error');
        setMessage(err?.message || 'Invalid or expired unsubscribe link.');
      });
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="text-center max-w-sm">
        {status === 'loading' && <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />}
        {status === 'success' && <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />}
        {status === 'error' && <XCircle className="h-12 w-12 text-destructive mx-auto mb-4" />}
        <h1 className="text-xl font-semibold">{status === 'success' ? 'Unsubscribed' : status === 'error' ? 'Error' : 'Processing…'}</h1>
        {message && <p className="text-muted-foreground mt-2 text-sm">{message}</p>}
      </div>
    </div>
  );
}
