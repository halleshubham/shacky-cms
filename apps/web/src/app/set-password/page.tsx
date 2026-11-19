'use client';
import { Suspense, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { api, ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const schema = z.object({
  password: z.string().min(12, 'At least 12 characters'),
  confirm: z.string(),
}).refine((d) => d.password === d.confirm, { message: "Passwords don't match", path: ['confirm'] });

type FormData = z.infer<typeof schema>;

function SetPasswordInner() {
  const token = useSearchParams().get('token') || '';
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [done, setDone] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    if (!token) {
      toast.error('This link is missing its token — use the link from your email');
      return;
    }
    setIsLoading(true);
    try {
      await api.post('/api/auth/set-password', { token, password: data.password });
      setDone(true);
      toast.success('Password set — you can log in now');
      setTimeout(() => router.push('/login'), 1500);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'That link is invalid or has expired');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary">Shacky CMS</h1>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Set your password</CardTitle>
            <CardDescription>Choose a password to activate your account</CardDescription>
          </CardHeader>
          <CardContent>
            {done ? (
              <p className="text-sm text-muted-foreground">Redirecting to login…</p>
            ) : !token ? (
              <p className="text-sm text-destructive">This link is missing its token. Use the link from your email.</p>
            ) : (
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password">New password</Label>
                  <Input id="password" type="password" autoComplete="new-password" {...register('password')} />
                  {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm">Confirm password</Label>
                  <Input id="confirm" type="password" autoComplete="new-password" {...register('confirm')} />
                  {errors.confirm && <p className="text-xs text-destructive">{errors.confirm.message}</p>}
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? 'Setting password…' : 'Set password'}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function SetPasswordPage() {
  return (
    <Suspense>
      <SetPasswordInner />
    </Suspense>
  );
}
