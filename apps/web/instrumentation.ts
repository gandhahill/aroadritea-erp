/**
 * Next.js instrumentation — runs once when the server starts.
 * Installs server-side error reporting that sends notifications
 * to helpdesk.handle permission holders via notifyByPermission.
 *
 * IMPORTANT: We dynamically import only the specific function we need
 * (notifyByPermission) to avoid pulling nodemailer into the webpack
 * bundle. The notification/index.ts re-exports email-transport which
 * depends on nodemailer (Node-only). So we import the file directly.
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Dynamic import at runtime only — avoids webpack bundling nodemailer
    const mod = await import(
      /* webpackIgnore: true */
      '@erp/services/notification'
    );
    const notifyByPermission = mod.notifyByPermission;

    process.on('unhandledRejection', async (reason: unknown) => {
      try {
        const err = reason instanceof Error ? reason : new Error(String(reason));
        await notifyByPermission({
          tenantId: 'default',
          kind: 'error',
          title: `Server Unhandled Rejection: ${err.message.slice(0, 120)}`,
          body: [
            `[${new Date().toISOString()}] Server Unhandled Rejection`,
            `Message: ${err.message.slice(0, 500)}`,
            err.stack ? `--- Stack ---\n${err.stack.slice(0, 800)}` : '',
          ]
            .filter(Boolean)
            .join('\n')
            .slice(0, 2000),
          link: '/dashboard',
          permission: 'helpdesk.handle',
        });
      } catch {
        // Reporting must never crash the process
      }
    });

    process.on('uncaughtException', async (err: Error) => {
      try {
        await notifyByPermission({
          tenantId: 'default',
          kind: 'error',
          title: `Server Uncaught Exception: ${err.message.slice(0, 120)}`,
          body: [
            `[${new Date().toISOString()}] Server Uncaught Exception`,
            `Message: ${err.message.slice(0, 500)}`,
            err.stack ? `--- Stack ---\n${err.stack.slice(0, 800)}` : '',
          ]
            .filter(Boolean)
            .join('\n')
            .slice(0, 2000),
          link: '/dashboard',
          permission: 'helpdesk.handle',
        });
      } catch {
        // Reporting must never crash the process
      }
    });
  }
}
