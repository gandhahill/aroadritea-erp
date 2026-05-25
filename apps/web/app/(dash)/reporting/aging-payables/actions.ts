'use server';

import {
  fetchAgingPayables as fetchAgingPayablesFromReceivables,
} from '../aging-receivables/actions';

export async function fetchAgingPayables(input: {
  asOf: string;
  locationId?: string;
}) {
  return fetchAgingPayablesFromReceivables(input);
}
