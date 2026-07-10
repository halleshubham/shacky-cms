import { revalidateTag, revalidatePath } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
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
