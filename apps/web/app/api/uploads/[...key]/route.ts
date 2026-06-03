import { getSession } from '@/lib/auth';
import { type UploadArea, readUpload } from '@/lib/upload-storage';
import { requirePermission } from '@erp/services/iam';
import type { PermissionCode } from '@erp/shared/types';
import { NextResponse } from 'next/server';

const PRIVATE_READ_PERMISSION: Record<UploadArea, string[]> = {
  'product-images': ['inventory.product.read', 'inventory.product.update'],
  'cms-images': ['cms.manage'],
  reimbursement: ['accounting.reimbursement.view'],
  disciplinary: ['hr.disciplinary.read', 'hr.disciplinary.write'],
  whistleblower: ['hr.whistleblower.read'],
  'shift-expenses': ['accounting.view'],
  general: ['settings.manage'],
  // Every authenticated employee may read SOPs (gated by hr.sop.read).
  sop: ['hr.sop.read', 'hr.sop.manage'],
  // AI assistant attachments — only the assistant operator + admins.
  'ai-attachments': ['ai.assistant.admin'],
};

export async function GET(request: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const { key } = await params;
  const normalizedKey = normalizeUploadKeyParts(key);
  try {
    const upload = await readUpload(normalizedKey);
    if (upload.visibility === 'private') {
      const session = await getSession();
      if (!session) return new NextResponse('Unauthenticated', { status: 401 });
      const allowed = await canReadPrivateUpload(session.user as Record<string, unknown>, upload);
      if (!allowed) return new NextResponse('Forbidden', { status: 403 });
    }
    const fileName = normalizedKey.at(-1) ?? 'download';
    const forceDownload = new URL(request.url).searchParams.get('download') === '1';
    const disposition = forceDownload || !isInlinePreviewSafe(fileName) ? 'attachment' : 'inline';

    return new NextResponse(upload.bytes, {
      headers: {
        'content-type': contentTypeFromName(fileName),
        'content-length': String(upload.info.size),
        'cache-control':
          upload.visibility === 'public' ? 'public, max-age=31536000, immutable' : 'no-store',
        'x-content-type-options': 'nosniff',
        'x-frame-options': 'SAMEORIGIN',
        'content-security-policy': "frame-ancestors 'self'",
        'content-disposition': `${disposition}; filename="${safeHeaderFileName(fileName)}"`,
      },
    });
  } catch {
    return new NextResponse('Not found', { status: 404 });
  }
}

function normalizeUploadKeyParts(key: string[]): string[] {
  let joined = key.filter(Boolean).join('/');
  const apiPrefix = 'api/uploads/';
  const apiPrefixIndex = joined.indexOf(apiPrefix);
  if (apiPrefixIndex >= 0) {
    joined = joined.slice(apiPrefixIndex + apiPrefix.length);
  }
  joined = joined.replace(/^(?:storage\/)?uploads\//, '');
  const visibilityMatch = joined.match(/(?:^|\/)(private|public)\//);
  if (visibilityMatch?.index && visibilityMatch.index > 0) {
    joined = joined.slice(visibilityMatch.index + 1);
  }
  return joined.split('/').filter(Boolean);
}

async function canReadPrivateUpload(
  user: Record<string, unknown>,
  upload: Awaited<ReturnType<typeof readUpload>>,
): Promise<boolean> {
  const userId = String(user.id ?? '');
  const tenantId = String(user.tenantId ?? 'default');
  if (!userId || !tenantId) return false;

  if (upload.metadata) {
    if (upload.metadata.tenantId !== tenantId) return false;
    if (upload.metadata.uploadedBy === userId) return true;
  }

  for (const permission of PRIVATE_READ_PERMISSION[upload.area]) {
    const result = await requirePermission(userId, permission as PermissionCode);
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

function isInlinePreviewSafe(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return (
    lower.endsWith('.png') ||
    lower.endsWith('.jpg') ||
    lower.endsWith('.jpeg') ||
    lower.endsWith('.webp') ||
    lower.endsWith('.gif') ||
    lower.endsWith('.pdf')
  );
}

function safeHeaderFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 160) || 'download';
}
