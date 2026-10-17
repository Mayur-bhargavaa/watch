import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { randomBytes } from 'crypto';
import path from 'path';
import { checkUpload, UPLOAD_MAX_BYTES } from '../../../lib/uploadValidate';

export const dynamic = 'force-dynamic';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

/** Only a signed-in, non-guest account may upload: the caller's cookie / bearer token is checked against the API server itself. */
async function isSignedIn(req: NextRequest): Promise<boolean> {
  const headers: Record<string, string> = {};
  const auth = req.headers.get('authorization');
  const cookie = req.headers.get('cookie');
  if (auth) headers.authorization = auth;
  if (cookie) headers.cookie = cookie;
  if (!auth && !cookie) return false;
  try {
    const res = await fetch(`${API_BASE}/api/user/me`, { headers, cache: 'no-store', signal: AbortSignal.timeout(5000) });
    return res.ok;
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!(await isSignedIn(req))) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    const declared = Number(req.headers.get('content-length') || 0);
    if (declared > UPLOAD_MAX_BYTES + 64 * 1024) return NextResponse.json({ error: 'File too large' }, { status: 413 });

    const formData = await req.formData();
    const file = formData.get('file');
    if (!file || typeof file === 'string') return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });

    const buffer = Buffer.from(await (file as File).arrayBuffer());
    // type comes from the real bytes; the client's file name and extension are never used
    const check = checkUpload(buffer);
    if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });

    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'chat');
    await mkdir(uploadDir, { recursive: true });
    const filename = `chat_${Date.now()}_${randomBytes(8).toString('hex')}.${check.ext}`;
    await writeFile(path.join(uploadDir, filename), buffer);
    return NextResponse.json({ url: `/uploads/chat/${filename}`, filename });
  } catch (error) {
    console.error('File upload error:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
