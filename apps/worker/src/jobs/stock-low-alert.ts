/**
 * Stock low alert job.
 *
 * The stock alert workflow must not report success until the notification
 * channel and inventory threshold policy are fully configured.
 */

export interface StockAlertJobData {
  tenantId?: string;
  locationId?: string;
  thresholdMultiplier?: number;
}

export async function stockLowAlertHandler(data: StockAlertJobData): Promise<void> {
  const { tenantId = 'default', locationId, thresholdMultiplier = 1.0 } = data;
  console.info('[stock-alert] Starting stock level check', {
    tenantId,
    locationId,
    thresholdMultiplier,
  });

  const {
    and,
    db,
    eq,
    isNotNull,
    locations,
    notificationChannels,
    or,
    products,
    sql,
    stockLevels,
  } = await import('@erp/db');

  const conditions = [
    eq(stockLevels.tenantId, tenantId),
    isNotNull(stockLevels.minStock),
    sql`${stockLevels.qtyAvailable} <= (${stockLevels.minStock} * ${thresholdMultiplier})`,
  ];
  if (locationId) conditions.push(eq(stockLevels.locationId, locationId));

  const rows = await db
    .select({
      productName: products.name,
      locationName: locations.name,
      qtyAvailable: stockLevels.qtyAvailable,
      minStock: stockLevels.minStock,
      uom: stockLevels.uom,
    })
    .from(stockLevels)
    .innerJoin(products, eq(products.id, stockLevels.productId))
    .innerJoin(locations, eq(locations.id, stockLevels.locationId))
    .where(and(...conditions))
    .limit(100);

  if (rows.length === 0) {
    console.info('[stock-alert] No low-stock rows found.');
    return;
  }

  const channels = await db
    .select({
      channelType: notificationChannels.channelType,
      target: notificationChannels.target,
    })
    .from(notificationChannels)
    .where(
      and(
        eq(notificationChannels.tenantId, tenantId),
        eq(notificationChannels.isActive, true),
        or(
          eq(notificationChannels.purpose, 'all'),
          eq(notificationChannels.purpose, 'stock_alert'),
        ),
      ),
    );

  if (channels.length === 0) {
    console.warn(
      '[stock-alert] Low stock found but no active stock alert channels are configured.',
      {
        count: rows.length,
      },
    );
    return;
  }

  const lines = rows.map((row) => {
    const productName = row.productName as { id?: string; en?: string; zh?: string } | null;
    const locationName = row.locationName as { id?: string; en?: string; zh?: string } | null;
    const product = productName?.id ?? productName?.en ?? productName?.zh ?? 'Produk';
    const location = locationName?.id ?? locationName?.en ?? locationName?.zh ?? 'Lokasi';
    return `- ${product} (${location}): ${row.qtyAvailable} ${row.uom}; minimum ${row.minStock}`;
  });
  const message = [
    '[Aroadri ERP] Peringatan stok rendah',
    '',
    `Jumlah item: ${rows.length}`,
    ...lines,
  ].join('\n');

  for (const channel of channels) {
    const result = await sendOperationalMessage(channel.channelType, channel.target, {
      subject: `[Aroadri ERP] ${rows.length} item stok rendah`,
      body: message,
    });
    if (!result.sent) {
      console.warn('[stock-alert] Notification delivery failed', {
        channelType: channel.channelType,
        target: channel.target,
        error: result.error,
      });
    }
  }
}

async function sendOperationalMessage(
  channelType: string,
  target: string,
  message: { subject: string; body: string },
): Promise<{ sent: boolean; error?: string }> {
  if (channelType === 'email') {
    return sendEmail(target, message);
  }
  if (channelType === 'whatsapp') {
    return sendWhatsApp(target, message.body);
  }
  return { sent: false, error: `Unsupported channel type: ${channelType}` };
}

async function sendEmail(
  to: string,
  msg: { subject: string; body: string },
): Promise<{ sent: boolean; error?: string }> {
  const smtpHost = process.env.SMTP_HOST;
  const configuredPort = Number.parseInt(process.env.SMTP_PORT ?? '587', 10);
  const smtpPort = Number.isFinite(configuredPort) ? configuredPort : 587;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const fromAddr = process.env.SMTP_FROM ?? 'noreply@aroadritea.com';
  const fromName = process.env.SMTP_FROM_NAME ?? 'Aroadri ERP';

  if (!smtpHost || !smtpUser || !smtpPass) {
    return { sent: false, error: 'SMTP env vars not configured' };
  }

  try {
    const nodemailer = await import('nodemailer');
    const secure =
      process.env.SMTP_SECURE !== undefined ? process.env.SMTP_SECURE === 'true' : smtpPort === 465;
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure,
      requireTLS: smtpPort === 587,
      auth: { user: smtpUser, pass: smtpPass },
    });

    await transporter.sendMail({
      from: fromAddr.includes('<') ? fromAddr : `${fromName} <${fromAddr}>`,
      to,
      subject: msg.subject,
      text: msg.body,
    });

    return { sent: true };
  } catch (err) {
    return { sent: false, error: err instanceof Error ? err.message : String(err) };
  }
}

async function sendWhatsApp(to: string, body: string): Promise<{ sent: boolean; error?: string }> {
  const twilioSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioToken = process.env.TWILIO_AUTH_TOKEN;
  const twilioFrom = process.env.TWILIO_WHATSAPP_FROM;

  if (!twilioSid || !twilioToken || !twilioFrom) {
    return { sent: false, error: 'Twilio env vars not configured' };
  }

  try {
    const credentials = Buffer.from(`${twilioSid}:${twilioToken}`).toString('base64');
    // ISO 22301 — bound the call so the alert job never blocks waiting
    // on a degraded Twilio API.
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          From: twilioFrom,
          To: to.startsWith('whatsapp:') ? to : `whatsapp:${to}`,
          Body: body,
        }),
        signal: AbortSignal.timeout(10000),
      },
    );

    if (!response.ok) {
      const text = await response.text();
      return { sent: false, error: `Twilio ${response.status}: ${text}` };
    }

    return { sent: true };
  } catch (err) {
    return { sent: false, error: err instanceof Error ? err.message : String(err) };
  }
}
