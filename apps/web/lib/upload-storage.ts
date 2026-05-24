import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

export { assertImageMagicBytes } from '@erp/shared/image-magic-bytes';

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const ALLOWED_UPLOAD_AREAS = [
  'product-images',
  'cms-images',
  'reimbursement',
  'disciplinary',
  'whistleblower',
  'general',
  'shift-expenses',
] as const;

export type UploadArea = (typeof ALLOWED_UPLOAD_AREAS)[number];

const ALLOWED_AREAS = new Set<string>(ALLOWED_UPLOAD_AREAS);
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);

export interface UploadMetadata {
  tenantId: string;
  uploadedBy: string;
  area: UploadArea;
  visibility: 'public' | 'private';
  originalName: string;
  mimeType: string;
  fileSize: number;
  uploadedAt: string;
}

export interface StoredUpload {
  key: string;
  url: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
}

export function validateUploadArea(area: string): string {
  const clean = area.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  if (!ALLOWED_AREAS.has(clean)) return 'general';
  return clean;
}

export function parseUploadArea(area: string): UploadArea | null {
  const clean = area.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  return ALLOWED_AREAS.has(clean) ? (clean as UploadArea) : null;
}

export function assertUploadFile(file: File, imageOnly = false) {
  if (!file.size || file.size > MAX_UPLOAD_BYTES) {
    throw new Error('invalid-size');
  }
  const ext = path.extname(sanitizeFileName(file.name)).toLowerCase();
  if (imageOnly) {
    if (!IMAGE_EXTENSIONS.has(ext)) {
      throw new Error('invalid-type');
    }
    if (file.type && file.type !== 'application/octet-stream' && !file.type.startsWith('image/')) {
      throw new Error('invalid-type');
    }
  }
}


export async function storeUpload({
  file,
  area,
  visibility,
  tenantId,
  uploadedBy,
}: {
  file: File;
  area: UploadArea;
  visibility: 'public' | 'private';
  tenantId: string;
  uploadedBy: string;
}): Promise<StoredUpload> {
  const cleanArea = area;
  const safeName = sanitizeFileName(file.name);
  const ext = path.extname(safeName);
  const fileName = `${Date.now()}-${crypto.randomUUID()}${ext}`;
  const key = `${visibility}/${cleanArea}/${fileName}`;
  const targetDir = path.join(uploadRoot(), visibility, cleanArea);
  await mkdir(targetDir, { recursive: true });
  const targetPath = path.join(targetDir, fileName);
  await writeFile(targetPath, Buffer.from(await file.arrayBuffer()));
  const metadata: UploadMetadata = {
    tenantId,
    uploadedBy,
    area,
    visibility,
    originalName: safeName,
    mimeType: file.type || 'application/octet-stream',
    fileSize: file.size,
    uploadedAt: new Date().toISOString(),
  };
  await writeFile(`${targetPath}.json`, JSON.stringify(metadata, null, 2));
  return {
    key,
    url: `/api/uploads/${key}`,
    fileName: safeName,
    mimeType: file.type || 'application/octet-stream',
    fileSize: file.size,
  };
}

export async function readUpload(keyParts: string[]) {
  const [visibility, area, fileName] = keyParts;
  if ((visibility !== 'public' && visibility !== 'private') || !area || !fileName) {
    throw new Error('invalid-key');
  }
  const cleanArea = parseUploadArea(area);
  if (!cleanArea) throw new Error('invalid-key');
  const cleanFileName = sanitizeFileName(fileName);
  if (cleanFileName.toLowerCase().endsWith('.json')) throw new Error('invalid-key');
  const filePath = path.join(uploadRoot(), visibility, cleanArea, cleanFileName);
  const root = path.resolve(uploadRoot());
  const resolved = path.resolve(filePath);
  if (!(resolved === root || resolved.startsWith(`${root}${path.sep}`)))
    throw new Error('invalid-key');
  const [bytes, info, metadata] = await Promise.all([
    readFile(resolved),
    stat(resolved),
    readUploadMetadata(resolved),
  ]);
  return { bytes, info, visibility, area: cleanArea, metadata };
}

function uploadRoot(): string {
  return process.env.UPLOAD_STORAGE_DIR ?? path.join(process.cwd(), 'storage', 'uploads');
}

function sanitizeFileName(value: string): string {
  const base = path.basename(value || 'file');
  return base.replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 160) || 'file';
}

async function readUploadMetadata(filePath: string): Promise<UploadMetadata | null> {
  try {
    const raw = await readFile(`${filePath}.json`, 'utf8');
    const parsed = JSON.parse(raw) as Partial<UploadMetadata>;
    if (
      !parsed ||
      typeof parsed.tenantId !== 'string' ||
      typeof parsed.uploadedBy !== 'string' ||
      typeof parsed.area !== 'string' ||
      typeof parsed.visibility !== 'string'
    ) {
      return null;
    }
    return parsed as UploadMetadata;
  } catch {
    return null;
  }
}
