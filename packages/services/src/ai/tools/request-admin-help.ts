/**
 * Tool: request_admin_help — T-0171 (Phase 2).
 *
 * Builds a ready-to-forward chat template for the caller. Does NOT
 * contact the admin directly (no Slack / WhatsApp integration in the
 * loop yet) — the user copies the template and sends it themselves.
 *
 * This is the safest tool to ship first: no DB writes, no PII outside
 * the caller's own session, no external network. It also delivers
 * immediate UX value on the "user reports an error" use case the owner
 * highlighted.
 */

import type { AuditContext } from '@erp/shared/types';
import { z } from 'zod';

export const RequestAdminHelpInputSchema = z.object({
  error_summary: z.string().min(3).max(500),
  observed_message: z.string().max(2000).optional(),
  current_url: z.string().max(500).optional(),
  time_of_event: z.string().max(120).optional(),
});

export type RequestAdminHelpInput = z.infer<typeof RequestAdminHelpInputSchema>;

export interface RequestAdminHelpOutput {
  template: string;
  recommended_action: string;
  fields_used: {
    error_summary: string;
    observed_message: string | null;
    current_url: string | null;
    time_of_event: string | null;
    user_id: string;
    location_id: string | null;
    tenant_id: string;
  };
}

export async function requestAdminHelpTool(
  input: RequestAdminHelpInput,
  ctx: AuditContext,
): Promise<RequestAdminHelpOutput> {
  const observed = input.observed_message?.trim() ?? '';
  const url = input.current_url?.trim() ?? '';
  const when = input.time_of_event?.trim() ?? 'baru saja';
  const locationId = ctx.locationId?.trim() || null;

  const lines: string[] = [];
  lines.push('Halo admin, saya butuh bantuan terkait sebuah error di Aroadri Tea ERP.');
  lines.push('');
  lines.push(`Ringkasan: ${input.error_summary.trim()}`);
  if (observed) {
    lines.push(`Pesan yang muncul: "${observed}"`);
  }
  if (url) {
    lines.push(`Halaman: ${url}`);
  }
  lines.push(`Waktu kejadian: ${when}`);
  lines.push(`User: ${ctx.userId} (tenant ${ctx.tenantId}${locationId ? `, lokasi ${locationId}` : ''}).`);
  lines.push('');
  lines.push('Mohon arahan apa yang perlu saya lakukan. Terima kasih.');

  // Hint to the model — keep this short so it doesn't fill up the
  // assistant reply with boilerplate.
  const recommendation =
    'Sampaikan template ini ke admin (WhatsApp / chat internal). Jangan menebak akar masalah — pengiriman log lengkap dilakukan oleh admin lewat audit trail.';

  return {
    template: lines.join('\n'),
    recommended_action: recommendation,
    fields_used: {
      error_summary: input.error_summary.trim(),
      observed_message: observed || null,
      current_url: url || null,
      time_of_event: when,
      user_id: ctx.userId,
      location_id: locationId,
      tenant_id: ctx.tenantId,
    },
  };
}
