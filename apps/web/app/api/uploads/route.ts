import { getSession } from '@/lib/auth';
import {
  type UploadArea,
  assertUploadFile,
  parseUploadArea,
  storeUpload,
} from '@/lib/upload-storage';
import { requirePermission } from '@erp/services/iam';
import { NextResponse } from 'next/server';

const UPLOAD_WRITE_PERMISSION: Record<UploadArea, string> = {
  'product-images': 'inventory.product.update',
  'cms-images': 'cms.manage',
  reimbursement: 'accounting.reimbursement.create',
  disciplinary: 'hr.disciplinary.write',
  general: 'settings.manage',
};

const PUBLIC_UPLOAD_AREAS = new Set<UploadArea>(['product-images', 'cms-images']);

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get('file');
  if (!file || typeof file !== 'object' || !('name' in file) || !('size' in file)) {
    return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
  }
  const uploadFile = file as File;

  const area = parseUploadArea(String(formData.get('area') ?? 'general'));
  if (!area) return NextResponse.json({ error: 'Invalid upload area' }, { status: 400 });

  const visibility =
    String(formData.get('visibility') ?? 'private') === 'public' ? 'public' : 'private';
  const imageOnly = String(formData.get('imageOnly') ?? 'false') === 'true';

  if (visibility === 'public' && (!PUBLIC_UPLOAD_AREAS.has(area) || !imageOnly)) {
    return NextResponse.json(
      { error: 'Public uploads must be approved image assets' },
      { status: 400 },
    );
  }

  const user = session.user as Record<string, unknown>;
  const userId = String(user.id ?? '');
  const tenantId = String(user.tenantId ?? 'default');
  if (!userId || !tenantId) {
    return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
  }

  const permission = await requirePermission(userId, UPLOAD_WRITE_PERMISSION[area]);
  if (!permission.ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    assertUploadFile(uploadFile, imageOnly);
    const stored = await storeUpload({
      file: uploadFile,
      area,
      visibility,
      tenantId,
      uploadedBy: userId,
    });
    return NextResponse.json(stored);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 400 },
    );
  }
}
