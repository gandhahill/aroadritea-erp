import type { PermissionCode } from '@erp/shared/types';
import { getSession } from '@/lib/auth';
import {
  type UploadArea,
  assertImageMagicBytes,
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
  whistleblower: '', // Bypassed
  'shift-expenses': 'pos.shift.close',
  general: 'settings.manage',
  sop: 'hr.sop.manage',
  'ai-attachments': 'ai.assistant.use',
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

  if (area !== 'whistleblower') {
    const permission = await requirePermission(userId, UPLOAD_WRITE_PERMISSION[area]);
    if (!permission.ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Whistleblower attachments must not be linkable back to the reporter
  // (AGENTS.md "audit trail ANONIM"). We require a session so the form
  // is only available to authenticated employees, but the upload metadata
  // never records who they were.
  const effectiveUploader = area === 'whistleblower' ? 'anonymous_whistleblower' : userId;

  try {
    assertUploadFile(uploadFile, imageOnly);

    // When the upload claims to be an image, verify the actual file
    // bytes match a real image signature before we ever write it to
    // disk. Client-set MIME / extension are not trustworthy.
    if (imageOnly) {
      const head = Buffer.from(await uploadFile.slice(0, 16).arrayBuffer());
      const magicErr = assertImageMagicBytes(head);
      if (magicErr) {
        return NextResponse.json({ error: magicErr }, { status: 400 });
      }
    }

    const stored = await storeUpload({
      file: uploadFile,
      area,
      visibility,
      tenantId,
      uploadedBy: effectiveUploader,
    });
    return NextResponse.json(stored);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 400 },
    );
  }
}
