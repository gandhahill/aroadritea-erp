/**
 * Kitchen customer display SSE feed — SD §21.7
 *
 * Stateless, unauthenticated stream (the customer display is a kiosk screen
 * with no session) that periodically pushes the queued/making/ready queue
 * for a single location to `/kitchen-display/[locationId]`.
 */

import { createQueueUpdateEvent, formatSseEvent, getDisplayQueue } from '@erp/services/kitchen';

export const dynamic = 'force-dynamic';

const POLL_INTERVAL_MS = 5000;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ locationId: string }> },
) {
  const { locationId } = await params;

  const encoder = new TextEncoder();
  let closed = false;
  let interval: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const sendQueue = async () => {
        const result = await getDisplayQueue(locationId);
        if (!result.ok || closed) return;
        controller.enqueue(
          encoder.encode(formatSseEvent(createQueueUpdateEvent(locationId, result.value))),
        );
      };

      await sendQueue();
      interval = setInterval(() => {
        sendQueue().catch(() => {});
      }, POLL_INTERVAL_MS);
    },
    cancel() {
      closed = true;
      if (interval) clearInterval(interval);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-store, no-transform',
      Connection: 'keep-alive',
    },
  });
}
