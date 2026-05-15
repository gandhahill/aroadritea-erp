import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const ALLOWED_AREAS = new Set([
  'product-images',
  'cms-images',
  'reimbursement',
  'disciplinary',
  'general',
]);

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

export function assertUploadFile(file: File, imageOnly = false) {
  if (!file.size || file.size > MAX_UPLOAD_BYTES) {
    throw new Error('invalid-size');
  }
  if (imageOnly && !file.type.startsWith('image/')) {
    throw new Error('invalid-type');
  }
}

export async function storeUpload({
  file,
  area,
  visibility,
}: {
  file: File;
  area: string;
  visibility: 'public' | 'private';
}): Promise<StoredUpload> {
  const cleanArea = validateUploadArea(area);
  const safeName = sanitizeFileName(file.name);
  const ext = path.extname(safeName);
  const fileName = `${Date.now()}-${crypto.randomUUID()}${ext}`;
  const key = `${visibility}/${cleanArea}/${fileName}`;
  const targetDir = path.join(uploadRoot(), visibility, cleanArea);
  await mkdir(targetDir, { recursive: true });
  await writeFile(path.join(targetDir, fileName), Buffer.from(await file.arrayBuffer()));
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
  const cleanArea = validateUploadArea(area);
  const cleanFileName = sanitizeFileName(fileName);
  const filePath = path.join(uploadRoot(), visibility, cleanArea, cleanFileName);
  const root = path.resolve(uploadRoot());
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(root)) throw new Error('invalid-key');
  const [bytes, info] = await Promise.all([readFile(resolved), stat(resolved)]);
  return { bytes, info, visibility };
}

function uploadRoot(): string {
  return process.env.UPLOAD_STORAGE_DIR ?? path.join(process.cwd(), 'storage', 'uploads');
}

function sanitizeFileName(value: string): string {
  const base = path.basename(value || 'file');
  return base.replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 160) || 'file';
}
