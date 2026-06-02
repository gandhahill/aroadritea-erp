/**
 * Next.js instrumentation — runs once when the server starts.
 * Installs server-side error reporting that sends notifications
 * to helpdesk.handle permission holders via notifyByPermission.
 *
 * Keep the notification import bundled by Next.js. Bypassing webpack
 * here makes production resolve workspace .ts files directly, which
 * breaks Node ESM resolution for extensionless internal imports.
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const mod = await import('@erp/services/notification');
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
