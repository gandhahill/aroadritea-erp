import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('aiCompleteStream', () => {
  beforeEach(() => {
    process.env.DEEPSEEK_API_KEY = 'test-key';
  });

  afterEach(async () => {
    process.env.DEEPSEEK_API_KEY = undefined;
    vi.unstubAllGlobals();
    const { resetProviderConfigCache } = await import('../src/ai/client');
    resetProviderConfigCache();
  });

  it('emits reasoning and final answer deltas from DeepSeek SSE chunks', async () => {
    const sse = [
      'data: {"model":"deepseek-v4-pro","choices":[{"delta":{"reasoning_content":"cek data"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"Jawaban"}}]}\n\n',
      'data: [DONE]\n\n',
    ];

    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      expect(JSON.parse(String(init.body))).toMatchObject({ stream: true });
      return new Response(
        new ReadableStream({
          start(controller) {
            const encoder = new TextEncoder();
            for (const chunk of sse) controller.enqueue(encoder.encode(chunk));
            controller.close();
          },
        }),
        { status: 200 },
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    const { aiCompleteStream } = await import('../src/ai/client');
    const deltas: Array<{ type: string; text: string }> = [];
    const result = await aiCompleteStream(
      {
        model: 'deepseek-v4-pro',
        messages: [{ role: 'user', content: 'halo' }],
        thinkingMode: true,
      },
      (delta) => {
        deltas.push(delta);
      },
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(deltas).toEqual([
      { type: 'reasoning', text: 'cek data' },
      { type: 'content', text: 'Jawaban' },
    ]);
    expect(result.reasoningContent).toBe('cek data');
    expect(result.content).toBe('Jawaban');
  });
});
