/**
 * Tool: ocr_receipt_struk - T-0172/T-0190.
 *
 * Reads a photographed receipt from the legacy POS. DeepSeek's official
 * Chat Completion schema is currently text/tool oriented, so the default
 * runtime first tries a local Tesseract OCR fallback for receipt photos.
 * If local OCR is unavailable and no configured provider explicitly
 * supports image input, the tool returns a structured
 * "vision_not_supported" response instead of forwarding unsupported
 * `image_url` payloads and crashing the chat.
 *
 * The tool itself does NOT post to manual_sales. It only stages a
 * draft so the cashier still has to click "Setujui & Posting" in the
 * UI; that path re-checks `pos.transact` permission.
 *
 * The `attachment_url` may be an uploaded `/api/uploads/...` URL or a
 * `data:image/...;base64,...` URI. Private app uploads are converted to
 * data URIs before being sent to a vision provider so external providers
 * never need staff cookies to read them.
 */

import { execFile as execFileCb } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import type { AuditContext } from '@erp/shared/types';
import { z } from 'zod';
import {
  type AiChatMessage,
  type AiCompletionResponse,
  aiComplete,
  loadProviderConfig,
} from '../client';
import { type AiRuntimeConfig, getAiRuntimeConfig } from '../settings';
import {
  type CreateManualSaleDraftToolDeps,
  createManualSaleDraftTool,
} from './create-manual-sale-draft';
import {
  type ResolvedLineItem,
  type ResolvedOrUnresolved,
  type UnresolvedLineItem,
  resolveOcrLineItems,
} from './resolve-line-items';
import { type LocationCandidate, findLocationCandidates } from './resolve-location';

const execFile = promisify(execFileCb);
const MAX_LOCAL_OCR_BYTES = 10 * 1024 * 1024;
const MAX_OCR_TEXT_CHARS = 12_000;

export const OcrReceiptStrukInputSchema = z.object({
  attachment_url: z.string().min(1).max(14_000_000),
  /** Outlet ID; defaults to caller's session location. */
  location_id: z.string().min(1).max(64).optional(),
  /** Optional hint about which channel the struk came from. */
  channel: z.string().min(2).max(32).optional(),
  /** Optional hint about the payment method. */
  payment_method: z
    .string()
    .regex(/^[a-z0-9_-]{2,32}$/)
    .optional(),
});

export type OcrReceiptStrukInput = z.infer<typeof OcrReceiptStrukInputSchema>;

export interface ExtractedLineItem {
  name: string;
  qty: number;
  amount: string;
}

interface ExtractedReceipt {
  sales_date: string;
  channel: string;
  payment_method: string;
  gross_sales: string;
  discount_total?: string;
  transaction_count?: number;
  outlet_hint?: string;
  outlet_address?: string;
  line_items?: ExtractedLineItem[];
  notes?: string;
}

interface OcrReceiptToolDeps extends CreateManualSaleDraftToolDeps {
  aiRuntimeConfig?: AiRuntimeConfig;
  /** Test seam for parser/staging without requiring a system OCR binary. */
  localOcrText?: string;
}

interface AttachmentForOcr {
  providerUrl: string;
  bytes?: Buffer;
  mimeType?: string;
}

function absolutizeAttachmentUrl(url: string): string {
  if (url.startsWith('data:')) return url;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const base =
    process.env.NEXT_PUBLIC_WEB_URL ?? process.env.BETTER_AUTH_URL ?? 'http://localhost:3000';
  return `${base.replace(/\/$/, '')}${url.startsWith('/') ? '' : '/'}${url}`;
}

function mimeToExtension(mimeType: string | undefined): string {
  if (mimeType === 'image/png') return '.png';
  if (mimeType === 'image/webp') return '.webp';
  return '.jpg';
}

function contentTypeFromName(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  return 'image/jpeg';
}

function sanitizeFileName(value: string): string {
  return (
    path
      .basename(value || 'file')
      .replace(/[^a-zA-Z0-9._-]/g, '-')
      .slice(0, 160) || 'file'
  );
}

function uploadRoot(): string {
  const configured = process.env.UPLOAD_STORAGE_DIR;
  if (!configured) return path.join(resolveRepoRoot(), 'storage', 'uploads');
  if (path.isAbsolute(configured)) return configured;
  return path.resolve(resolveRepoRoot(), configured);
}

function resolveRepoRoot(): string {
  const explicit = process.env.ERP_REPO_ROOT;
  if (explicit) return explicit;

  let current = process.cwd();
  for (let depth = 0; depth < 8; depth += 1) {
    if (existsSync(path.join(current, 'pnpm-workspace.yaml'))) return current;
    if (existsSync(path.join(current, 'ecosystem.config.cjs'))) return current;
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return process.cwd();
}

function dataUriToAttachment(url: string): AttachmentForOcr | null {
  const match = url.match(/^data:(image\/(?:png|jpe?g|webp));base64,([\s\S]+)$/i);
  if (!match) return null;
  const mimeType = match[1]?.toLowerCase().replace('image/jpg', 'image/jpeg');
  const bytes = Buffer.from(match[2] ?? '', 'base64');
  if (!mimeType || bytes.length === 0 || bytes.length > MAX_LOCAL_OCR_BYTES) return null;
  return { providerUrl: url, bytes, mimeType };
}

function parseUploadKey(url: string): string[] | null {
  let pathname = url;
  if (url.startsWith('http://') || url.startsWith('https://')) {
    try {
      pathname = new URL(url).pathname;
    } catch {
      return null;
    }
  }
  const prefix = '/api/uploads/';
  if (!pathname.startsWith(prefix)) return null;
  return pathname
    .slice(prefix.length)
    .split('/')
    .map((part) => decodeURIComponent(part))
    .filter(Boolean);
}

async function readAppUploadedAttachment(
  url: string,
  ctx: AuditContext,
): Promise<AttachmentForOcr | null> {
  const parts = parseUploadKey(url);
  if (!parts || parts.length !== 3) return null;
  const [visibility, area, rawFileName] = parts;
  if ((visibility !== 'private' && visibility !== 'public') || area !== 'ai-attachments') {
    return null;
  }

  const root = path.resolve(uploadRoot());
  const fileName = sanitizeFileName(rawFileName ?? '');
  if (!fileName || fileName.toLowerCase().endsWith('.json')) return null;
  const filePath = path.resolve(root, visibility, area, fileName);
  if (!(filePath === root || filePath.startsWith(`${root}${path.sep}`))) return null;

  let bytes: Buffer;
  try {
    bytes = await readFile(filePath);
  } catch {
    return null;
  }
  if (bytes.length === 0 || bytes.length > MAX_LOCAL_OCR_BYTES) return null;

  if (visibility === 'private') {
    try {
      const metadata = JSON.parse(await readFile(`${filePath}.json`, 'utf8')) as {
        tenantId?: string;
        uploadedBy?: string;
      };
      if (metadata.tenantId !== ctx.tenantId || metadata.uploadedBy !== ctx.userId) {
        return null;
      }
    } catch {
      return null;
    }
  }

  const mimeType = contentTypeFromName(fileName);
  return {
    providerUrl: `data:${mimeType};base64,${bytes.toString('base64')}`,
    bytes,
    mimeType,
  };
}

async function resolveAttachmentForOcr(url: string, ctx: AuditContext): Promise<AttachmentForOcr> {
  const dataUri = dataUriToAttachment(url);
  if (dataUri) return dataUri;

  const uploaded = await readAppUploadedAttachment(url, ctx);
  if (uploaded) return uploaded;

  return { providerUrl: absolutizeAttachmentUrl(url) };
}

function extractFirstJsonBlock(text: string): string | null {
  const trimmed = text.trim();
  if (trimmed.startsWith('{')) return trimmed;
  const match = trimmed.match(/```json\s*([\s\S]*?)```/i) ?? trimmed.match(/```\s*([\s\S]*?)```/);
  return match?.[1]?.trim() ?? null;
}

const LineItemSchema = z.object({
  name: z.string().min(1).max(200),
  qty: z.number().positive().max(999),
  amount: z.string().regex(/^\d+$/),
});

const ExtractedSchema = z.object({
  sales_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  channel: z.string().min(2).max(32).default('walk_in'),
  payment_method: z
    .string()
    .regex(/^[a-z0-9_-]{2,32}$/)
    .default('cash'),
  gross_sales: z.string().regex(/^\d+$/),
  discount_total: z.string().regex(/^\d+$/).optional(),
  transaction_count: z.number().int().min(0).optional(),
  outlet_hint: z.string().min(1).max(200).optional(),
  outlet_address: z.string().min(1).max(300).optional(),
  line_items: z.array(LineItemSchema).max(50).optional(),
  notes: z.string().max(500).optional(),
});

export interface OcrReceiptStrukOutput {
  ok: boolean;
  error?: string;
  extracted?: ExtractedReceipt;
  /** Populated when location cannot be resolved — the model should call
   *  `resolve_location` with `outlet_hint` or ask the user which outlet. */
  outlet_hint?: string;
  /** Up to 5 location candidates when outlet_hint matches >1 outlet. */
  location_candidates?: Array<{ id: string; code: string; name: Record<string, unknown> }>;
  draft_id?: string;
  expires_at?: string;
  summary?: string;
  requires_confirmation?: true;
}

function extractOutletHintFromText(text: string): string | undefined {
  // Header on the legacy POS is typically the FIRST non-empty printed
  // line, e.g. "AROADRI TEA Plaza Malioboro" — sometimes split across
  // two lines by the printer. Find the line directly before
  // "Product Sales Report" and strip the brand prefix.
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  let header: string | undefined;
  const reportIdx = lines.findIndex((line) => /product\s*sales\s*report/i.test(line));
  if (reportIdx > 0) {
    // Take the line(s) before the report title — handle the line-wrap
    // case where "Plaza Mali" is on one line and "oboro" on the next.
    const headerLines = lines.slice(0, reportIdx).join(' ');
    header = headerLines;
  } else if (lines.length > 0) {
    header = lines[0];
  }
  if (!header) return undefined;
  const cleaned = header
    .replace(/aroadri\s*tea/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned.length > 0 ? cleaned.slice(0, 200) : undefined;
}

function extractLineItemsFromText(text: string): ExtractedLineItem[] {
  // Strategy: split on newlines, then for each line look for a pattern
  // where a product name (with bracketed modifiers) is followed by an
  // integer qty and an integer amount at the end. The legacy printer
  // sometimes wraps a long product name onto a second line — we glue
  // any line ending in an open bracket to the next.
  const rawLines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  // Join wrapped product lines (closing bracket missing).
  const joined: string[] = [];
  for (const line of rawLines) {
    const prev = joined[joined.length - 1];
    if (prev?.includes('[') && !prev.includes(']') && !/^[\[\{]?\d+[\]\}]?$/.test(line)) {
      joined[joined.length - 1] = `${prev} ${line}`;
    } else {
      joined.push(line);
    }
  }

  const items: ExtractedLineItem[] = [];
  // Match: <name with brackets>  <qty>  <amount>
  // Amount is at least 3 digits (allowing thin separators .,).
  const itemRe = /^(.+?)\s+(\d{1,3})\s+([0-9][0-9.,]{2,})\s*$/;
  for (const line of joined) {
    // Skip the bracketed category total line "[Milk Tea] [5] [230000]".
    if (/^\[[^\]]+\]\s*\[\d+\]\s*\[[\d.,]+\]\s*$/.test(line)) continue;
    const match = line.match(itemRe);
    if (!match) continue;
    const [, name, qtyStr, amountStr] = match;
    const qty = Number(qtyStr);
    const amount = (amountStr ?? '').replace(/\D/g, '');
    if (!name || !Number.isFinite(qty) || qty <= 0 || !amount) continue;
    items.push({ name: name.trim().slice(0, 200), qty, amount });
    if (items.length >= 50) break;
  }
  return items;
}

export function parseLegacyReceiptText(
  text: string,
  hints: Pick<OcrReceiptStrukInput, 'channel' | 'payment_method'> = {},
): ExtractedReceipt | null {
  const flat = text
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!flat) return null;

  const dateMatch = [...flat.matchAll(/\b(\d{4})\s*[-/]\s*(\d{1,2})\s*[-/]\s*(\d{1,2})\b/g)].at(-1);
  const [, year, month, day] = dateMatch ?? [];
  const date =
    year && month && day ? `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}` : undefined;
  const amount =
    flat.match(/amount[\s.]*recei\s*ved\s*:?\s*rp\s*([0-9][0-9.,]*)/i)?.[1] ??
    flat.match(/amount\s*received\s*:?\s*rp\s*([0-9][0-9.,]*)/i)?.[1] ??
    flat.match(/(?:gross|total)\s*(?:sales|amount)?\s*:?\s*rp?\s*([0-9][0-9.,]*)/i)?.[1];
  if (!date || !amount) return null;

  const grossSales = amount.replace(/\D/g, '');
  if (!grossSales) return null;

  const categoryCount = flat.match(
    new RegExp(String.raw`\[(\d+)\]\s*[\[\{]\s*${grossSales}\b`),
  )?.[1];
  const totalSalesCount = flat.match(/total\s*sales\s*:?\s*(\d+)/i)?.[1];
  const transactionCount = categoryCount ?? totalSalesCount;
  const lower = flat.toLowerCase();
  const inferredChannel = lower.includes('gofood')
    ? 'gofood'
    : lower.includes('grabfood')
      ? 'grabfood'
      : lower.includes('shopee')
        ? 'shopeefood'
        : 'walk_in';
  const inferredPayment = lower.includes('qris')
    ? 'qris'
    : lower.includes('debit')
      ? 'debit'
      : lower.includes('credit')
        ? 'credit'
        : lower.includes('ewallet')
          ? 'ewallet'
          : 'cash';

  const outletHint = extractOutletHintFromText(text);
  const lineItems = extractLineItemsFromText(text);

  return {
    sales_date: date.replace(/\//g, '-'),
    channel: hints.channel ?? inferredChannel,
    payment_method: hints.payment_method ?? inferredPayment,
    gross_sales: grossSales,
    transaction_count: transactionCount ? Number(transactionCount) : undefined,
    outlet_hint: outletHint,
    line_items: lineItems.length > 0 ? lineItems : undefined,
    notes:
      'OCR lokal dari Product Sales Report lama; cek ulang channel/metode bayar bila struk tidak menampilkannya jelas.',
  };
}

async function runLocalTesseractOcr(attachment: AttachmentForOcr): Promise<string | null> {
  if (!attachment.bytes || attachment.bytes.length === 0) return null;

  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'aroadri-ocr-'));
  const imagePath = path.join(tempDir, `receipt${mimeToExtension(attachment.mimeType)}`);
  try {
    await writeFile(imagePath, attachment.bytes);
    const { stdout } = await execFile(
      process.env.OCR_TESSERACT_BIN || 'tesseract',
      [imagePath, 'stdout', '--psm', '6', '-l', process.env.OCR_TESSERACT_LANG || 'eng'],
      { timeout: 25_000, maxBuffer: 1024 * 1024 },
    );
    return stdout.slice(0, MAX_OCR_TEXT_CHARS).trim() || null;
  } catch {
    return null;
  } finally {
    await rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

async function resolveRuntimeConfig(
  ctx: AuditContext,
  deps?: OcrReceiptToolDeps,
): Promise<AiRuntimeConfig | null> {
  if (deps?.aiRuntimeConfig) return deps.aiRuntimeConfig;
  try {
    return await getAiRuntimeConfig(ctx.tenantId);
  } catch {
    return null;
  }
}

function summariseCandidate(c: LocationCandidate): {
  id: string;
  code: string;
  name: Record<string, unknown>;
} {
  return { id: c.id, code: c.code, name: c.name };
}

async function stageExtractedReceipt(
  input: OcrReceiptStrukInput,
  extracted: ExtractedReceipt,
  ctx: AuditContext,
  deps?: OcrReceiptToolDeps,
): Promise<OcrReceiptStrukOutput> {
  // Resolve outlet — priority order:
  //   1. Explicit `location_id` in the tool call.
  //   2. Caller's session locationId (cashier signed in at their outlet).
  //   3. Top-scoring outlet that matches the printed header (≥1 cand).
  // Only when ALL three fail do we return location_required. Without
  // this relaxation, a director with no session location + a struk
  // whose header doesn't have a perfect outlet match would never see
  // the Setujui & Posting button.
  let resolvedLocationId: string | undefined =
    input.location_id?.trim() || ctx.locationId?.trim() || undefined;
  let candidates: LocationCandidate[] = [];
  let pickedFromMultipleHint: string | undefined;
  if (!resolvedLocationId && extracted.outlet_hint) {
    candidates = await findLocationCandidates(extracted.outlet_hint, ctx, 5);
    const top = candidates[0];
    if (top) {
      resolvedLocationId = top.id;
      if (candidates.length > 1) {
        // Cashier sees this as a warning in the summary — they can
        // Batal and re-issue the call with the right outlet if wrong.
        pickedFromMultipleHint = candidates
          .slice(0, 3)
          .map((c) => c.code)
          .join(', ');
      }
    }
  }

  if (!resolvedLocationId) {
    return {
      ok: false,
      error: 'location_required',
      extracted,
      outlet_hint: extracted.outlet_hint,
      location_candidates: candidates.length > 0 ? candidates.map(summariseCandidate) : undefined,
      summary: extracted.outlet_hint
        ? `OCR berhasil. Struk menyebut outlet "${extracted.outlet_hint}" tapi tidak ada outlet yang cocok di sesi. Minta user mengonfirmasi outlet, lalu panggil create_manual_sale_draft langsung dengan location_id yang benar.`
        : 'OCR berhasil tapi outlet tidak tercetak di struk. Tanyakan outlet ke user, lalu panggil create_manual_sale_draft dengan location_id yang benar.',
    };
  }

  // Fuzzy-match every line item against the product catalogue so the
  // commit path (createManualSalesClosing → deductIngredients) can run
  // BOM deduction per line. Items the resolver can't match end up in
  // display_line_items with a warning — they show on the card but do
  // NOT trigger BOM.
  const resolvedItems: ResolvedOrUnresolved[] =
    extracted.line_items && extracted.line_items.length > 0
      ? await resolveOcrLineItems(extracted.line_items, ctx)
      : [];
  const realLineItems = resolvedItems.filter((i): i is ResolvedLineItem => i.resolved);
  const unresolvedItems = resolvedItems.filter((i): i is UnresolvedLineItem => !i.resolved);
  const ocrNotesParts = [extracted.notes ?? ''].filter(Boolean);
  if (pickedFromMultipleHint) {
    ocrNotesParts.push(
      `Outlet auto-pilih dari kandidat: ${pickedFromMultipleHint}. Verifikasi sebelum Setujui.`,
    );
  }

  const draft = await createManualSaleDraftTool(
    {
      location_id: resolvedLocationId,
      sales_date: extracted.sales_date,
      channel: input.channel ?? extracted.channel,
      payment_method: input.payment_method ?? extracted.payment_method,
      gross_sales: extracted.gross_sales,
      discount_total: extracted.discount_total ?? '0',
      transaction_count: extracted.transaction_count ?? 0,
      deduct_bom: true,
      source_reference: `ocr:${input.attachment_url.slice(0, 100)}`,
      notes: ocrNotesParts.join(' | ') || undefined,
      line_items: realLineItems.map((item) => ({
        productId: item.productId,
        variantId: item.variantId,
        name: item.name,
        qty: item.qty,
        price: item.price,
        total: item.total,
        matched_product_sku: item.matchedProductSku,
        matched_product_name: item.matchedProductName,
        matched_variant_name: item.matchedVariantName,
        confidence: item.confidence,
      })),
      display_line_items: unresolvedItems.map((item) => ({
        name: item.name,
        qty: item.qty,
        amount: item.total,
      })),
      outlet_hint: extracted.outlet_hint,
    },
    ctx,
    deps,
  );

  if (!draft.ok) {
    // OCR pre-resolves locationId above, so this branch is only reached
    // when the draft tool's own fallback resolution returns no exact
    // match — forward the structured error untouched.
    return {
      ok: false,
      error: draft.error,
      extracted,
      outlet_hint: draft.outlet_hint,
      location_candidates: draft.location_candidates,
      summary: draft.summary,
    };
  }

  return {
    ok: true,
    extracted,
    draft_id: draft.draft_id,
    expires_at: draft.expires_at,
    summary: draft.summary,
    requires_confirmation: true,
  };
}

async function tryLocalReceiptOcr(
  input: OcrReceiptStrukInput,
  attachment: AttachmentForOcr,
  ctx: AuditContext,
  deps?: OcrReceiptToolDeps,
): Promise<OcrReceiptStrukOutput | null> {
  const localText = deps?.localOcrText ?? (await runLocalTesseractOcr(attachment));
  const localExtracted = localText ? parseLegacyReceiptText(localText, input) : null;
  return localExtracted ? stageExtractedReceipt(input, localExtracted, ctx, deps) : null;
}

export async function ocrReceiptStrukTool(
  input: OcrReceiptStrukInput,
  ctx: AuditContext,
  deps?: OcrReceiptToolDeps,
): Promise<OcrReceiptStrukOutput> {
  const runtimeConfig = await resolveRuntimeConfig(ctx, deps);
  const providerConfig = loadProviderConfig();
  const config = {
    ...providerConfig,
    ...(runtimeConfig ?? {}),
    apiKey: providerConfig.apiKey,
  };
  const attachment = await resolveAttachmentForOcr(input.attachment_url, ctx);

  if (!config.apiKey) {
    const localDraft = await tryLocalReceiptOcr(input, attachment, ctx, deps);
    if (localDraft) return localDraft;
    return { ok: false, error: 'ai.provider.notConfigured' };
  }
  const url = attachment.providerUrl;

  const systemPrompt = [
    'You are an OCR + structured-extraction engine for a small Indonesian',
    'bubble-tea shop. The user is uploading a photo of a paper receipt',
    'printed by an OLD point-of-sale system. Read it carefully.',
    '',
    'Return ONLY a JSON object with this shape (no prose, no markdown):',
    '{',
    '  "sales_date": "YYYY-MM-DD",',
    '  "channel": "walk_in" | "gofood" | "grabfood" | "shopeefood" | "self_pickup" | "delivery",',
    '  "payment_method": "cash" | "qris" | "debit" | "credit" | "bank_transfer" | "ewallet",',
    '  "gross_sales": "<integer rupiah, no separators>",',
    '  "discount_total": "<integer rupiah, optional>",',
    '  "transaction_count": <integer, optional>,',
    '  "outlet_hint": "<branch/outlet name as printed on the receipt header, e.g. \\"Plaza Malioboro\\". Drop the brand prefix (\\"AROADRI TEA\\") if present.>",',
    '  "outlet_address": "<short address line if visible, optional>",',
    '  "line_items": [',
    '    { "name": "<product + modifiers as printed, single line>", "qty": <integer>, "amount": "<integer rupiah>" }',
    '  ],',
    '  "notes": "<short free text, optional - mention if anything was unreadable>"',
    '}',
    '',
    'Rules:',
    '- If the receipt is unreadable, return {"error":"unreadable"} and nothing else.',
    '- If the date is ambiguous, use Asia/Jakarta today.',
    '- gross_sales is the TOTAL the customer paid (Amount Received) in rupiah (e.g. "230000").',
    '- line_items: extract every product row visible. Use the printed line exactly (do NOT translate or rename); join wrapped lines into one string; if a qty is bracketed like "[5]" treat that as the GROUP total, not a row qty.',
    '- Pay close attention to line wrapping and bad OCR spacing! A quantity might be accidentally merged into the middle of text (e.g., "S 2 tandard" means Qty 2 and "Standard", "L 1 ess" means Qty 1 and "Less"). Extract the hidden qty and clean up the item name.',
    '- outlet_hint: take only the location/branch part of the header. For "AROADRI TEA Plaza Malioboro", outlet_hint is "Plaza Malioboro". Never invent.',
    '- If a field is genuinely unreadable, omit it. Do not guess.',
  ].join('\n');

  let messages: AiChatMessage[];
  if (config.supportsVision) {
    messages = [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Ekstrak isi struk berikut menjadi JSON sesuai skema.',
          },
          { type: 'image_url', image_url: { url } },
        ],
      },
    ];
  } else {
    const localText = deps?.localOcrText ?? (await runLocalTesseractOcr(attachment));
    if (!localText) {
      return {
        ok: false,
        error: 'vision_not_supported',
        summary:
          'OCR gambar belum aktif untuk provider AI saat ini dan fallback OCR lokal tidak berhasil membaca teks gambar. Minta user mengetik tanggal, outlet, channel, metode bayar, total penjualan, diskon, dan jumlah transaksi dari struk.',
      };
    }
    if (deps) deps.localOcrText = localText;
    messages = [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: `Ekstrak isi struk berikut menjadi JSON sesuai skema. Karena provider AI saat ini tidak mendukung input gambar secara langsung, berikut adalah teks mentah hasil ekstraksi OCR lokal (Tesseract). Format struk mungkin berantakan atau ada yang salah baca, harap teliti dalam mengekstrak data JSON yang diminta dari teks ini:\n\n${localText}`,
      },
    ];
  }

  let providerResponse: AiCompletionResponse;
  try {
    providerResponse = await aiComplete({
      model: config.reasoningModel,
      provider: {
        baseUrl: config.baseUrl,
        model: config.model,
        reasoningModel: config.reasoningModel,
        temperature: config.temperature,
        maxTokens: config.maxTokens,
        supportsVision: config.supportsVision,
      },
      thinkingMode: true,
      messages,
    });
  } catch (e) {
    const localDraft = await tryLocalReceiptOcr(input, attachment, ctx, deps);
    if (localDraft) return localDraft;
    return {
      ok: false,
      error: `provider_error:${e instanceof Error ? e.message : String(e)}`,
      summary:
        'Provider AI gagal membaca gambar dan fallback OCR lokal belum berhasil. Minta user mengetik tanggal, outlet, channel, metode bayar, total penjualan, diskon, dan jumlah transaksi dari struk.',
    };
  }

  const rawJson = extractFirstJsonBlock(providerResponse.content);
  if (!rawJson) {
    const localDraft = await tryLocalReceiptOcr(input, attachment, ctx, deps);
    if (localDraft) return localDraft;
    return { ok: false, error: 'no_json_in_response' };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    const localDraft = await tryLocalReceiptOcr(input, attachment, ctx, deps);
    if (localDraft) return localDraft;
    return { ok: false, error: 'invalid_json_in_response' };
  }
  if (
    parsed &&
    typeof parsed === 'object' &&
    'error' in (parsed as Record<string, unknown>) &&
    (parsed as { error?: string }).error === 'unreadable'
  ) {
    const localDraft = await tryLocalReceiptOcr(input, attachment, ctx, deps);
    if (localDraft) return localDraft;
    return { ok: false, error: 'receipt_unreadable' };
  }

  const validated = ExtractedSchema.safeParse(parsed);
  if (!validated.success) {
    const localDraft = await tryLocalReceiptOcr(input, attachment, ctx, deps);
    if (localDraft) return localDraft;
    return {
      ok: false,
      error: `invalid_extracted:${validated.error.issues.map((i) => i.message).join('; ')}`,
    };
  }
  const extracted = validated.data as ExtractedReceipt;

  return stageExtractedReceipt(input, extracted, ctx, deps);
}
