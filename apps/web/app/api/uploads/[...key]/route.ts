import { getSession } from '@/lib/auth';
import { readUpload } from '@/lib/upload-storage';
import { NextResponse } from 'next/server';

export async function GET(_request: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const { key } = await params;
  try {
    const upload = await readUpload(key);
    if (upload.visibility === 'private') {
      const session = await getSession();
      if (!session) return new NextResponse('Unauthenticated', { status: 401 });
    }
    return new NextResponse(upload.bytes, {
      headers: {
        'content-type': contentTypeFromName(key.at(-1) ?? ''),
        'content-length': String(upload.info.size),
        'cache-control':
          upload.visibility === 'public' ? 'public, max-age=31536000, immutable' : 'no-store',
      },
    });
  } catch {
    return new NextResponse('Not found', { status: 404 });
  }
}

function contentTypeFromName(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.pdf')) return 'application/pdf';
  return 'application/octet-stream';
}
