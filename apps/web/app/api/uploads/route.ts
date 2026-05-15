import { getSession } from '@/lib/auth';
import { assertUploadFile, storeUpload, validateUploadArea } from '@/lib/upload-storage';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
  }

  const area = validateUploadArea(String(formData.get('area') ?? 'general'));
  const visibility =
    String(formData.get('visibility') ?? 'private') === 'public' ? 'public' : 'private';
  const imageOnly = String(formData.get('imageOnly') ?? 'false') === 'true';

  try {
    assertUploadFile(file, imageOnly);
    const stored = await storeUpload({ file, area, visibility });
    return NextResponse.json(stored);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 400 },
    );
  }
}
