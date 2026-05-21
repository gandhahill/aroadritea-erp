import { describe, expect, it } from 'vitest';
import { CreateNotificationChannelSchema } from '../src/notification/index';

describe('CreateNotificationChannelSchema', () => {
  it('allows party ledger reminder email channels', () => {
    const result = CreateNotificationChannelSchema.safeParse({
      label: 'Finance reminders',
      channelType: 'email',
      target: 'finance@example.com',
      purpose: 'party_ledger',
      isActive: true,
    });

    expect(result.success).toBe(true);
  });
});
