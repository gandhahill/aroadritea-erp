import { AppError } from '@erp/shared/errors';

export const BINDERBYTE_ENDPOINT = 'https://api.binderbyte.com/v1/track';

export interface BinderByteTrackResponse {
  status?: number;
  message?: string;
  data?: {
    summary?: Record<string, unknown>;
    detail?: Record<string, unknown>;
    history?: Array<Record<string, unknown>>;
  };
}

export interface BinderByteResult {
  success: boolean;
  httpStatus: number | null;
  errorMessage: string | null;
  payload: BinderByteTrackResponse | null;
}

/**
 * Fetches tracking information from BinderByte API.
 * Throws AppError.internal if API key is missing.
 */
export async function fetchBinderByteTracking(
  courierCode: string,
  awb: string,
  phoneLast5?: string | null,
): Promise<BinderByteResult> {
  const apiKey = process.env.BINDERBYTE_API_KEY;
  if (!apiKey) {
    throw AppError.internal('binderbyte.apiKeyMissing');
  }

  const url = new URL(BINDERBYTE_ENDPOINT);
  url.searchParams.set('courier', courierCode);
  url.searchParams.set('awb', awb);
  if (phoneLast5) {
    url.searchParams.set('number', phoneLast5);
  }

  let httpStatus: number | null = null;
  let payload: BinderByteTrackResponse | null = null;
  let errorMessage: string | null = null;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'api_key': apiKey,
      },
      signal: AbortSignal.timeout(10_000),
    });
    httpStatus = response.status;
    payload = (await response.json()) as BinderByteTrackResponse;
    if (!response.ok || payload.status !== 200) {
      errorMessage = payload.message ?? `BinderByte HTTP ${response.status}`;
    }
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : String(error);
  }

  const success = !errorMessage && payload?.status === 200;

  return {
    success,
    httpStatus,
    errorMessage,
    payload,
  };
}
