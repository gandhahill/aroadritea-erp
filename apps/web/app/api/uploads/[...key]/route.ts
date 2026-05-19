import { getSession } from '@/lib/auth';
import { type UploadArea, readUpload } from '@/lib/upload-storage';
import { requirePermission } from '@erp/services/iam';
import { NextResponse } from 'next/server';

const PRIVATE_READ_PERMISSION: Record<UploadArea, string[]> = {
  'product-images': ['inventory.product.read', 'inventory.product.update'],
  'cms-images': ['cms.manage'],
  reimbursement: ['accounting.reimbursement.view', 'accounting.reimbursement.create'],
  disciplinary: ['hr.disciplinary.read', 'hr.disciplinary.write'],
  general: ['settings.manage'],
};

export async function GET(_request: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const { key } = await params;
  try {
    const upload = await readUpload(key);
    if (upload.visibility === 'private') {
      const session = await getSession();
      if (!session) return new NextResponse('Unauthenticated', { status: 401 });
      const allowed = await canReadPrivateUpload(session.user as Record<string, unknown>, upload);
      if (!allowed) return new NextResponse('Forbidden', { status: 403 });
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

async function canReadPrivateUpload(
  user: Record<string, unknown>,
  upload: Awaited<ReturnType<typeof readUpload>>,
): Promise<boolean> {
  const userId = String(user.id ?? '');
  const tenantId = String(user.tenantId ?? '');
  if (!userId || !tenantId) return false;

  if (upload.metadata) {
    if (upload.metadata.tenantId !== tenantId) return false;
    if (upload.metadata.uploadedBy === userId) return true;
  }

  for (const permission of PRIVATE_READ_PERMISSION[upload.area]) {
    const result = await requirePermission(userId, permission);
    if (result.ok) return true;
  }
  return false;
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
