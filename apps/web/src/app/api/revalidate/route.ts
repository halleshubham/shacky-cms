import { revalidateTag, revalidatePath } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const accessToken = req.cookies.get('access_token')?.value;
  if (!accessToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const apiBase = process.env.API_INTERNAL_URL ?? 'http://localhost:4000';
  const authRes = await fetch(`${apiBase}/api/auth/me`, {
    headers: { Cookie: `access_token=${accessToken}` },
  });
  if (!authRes.ok) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const tag = req.nextUrl.searchParams.get('tag');
  const path = req.nextUrl.searchParams.get('path');
  if (tag) revalidateTag(tag);
  if (path) revalidatePath(path);
  if (!tag && !path) {
    revalidateTag('site-settings');
    revalidatePath('/');
  }
  return NextResponse.json({ revalidated: true });
}
