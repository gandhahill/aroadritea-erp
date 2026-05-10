/**
 * Offline fallback page — SD §35.1.1
 *
 * Shown when the POS is offline and the user navigates to a non-cached document.
 * This page is pre-cached as a fallback entry in the service worker.
 */

export default function OfflinePage() {
  return (
    <html lang="id">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Offline — Aroadri POS</title>
        <style>{`
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: 'Manrope', system-ui, sans-serif;
            background: #1A0A0A;
            color: #F5E6D3;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            text-align: center;
            padding: 24px;
          }
          .container {
            max-width: 400px;
          }
          .icon { font-size: 64px; margin-bottom: 16px; }
          h1 {
            font-size: 24px;
            font-weight: 700;
            color: #D6262E;
            margin-bottom: 8px;
          }
          p { font-size: 14px; color: #A08070; margin-bottom: 24px; line-height: 1.6; }
          .pending {
            background: #2A1A10;
            border: 1px solid #D6262E33;
            border-radius: 8px;
            padding: 12px 16px;
            font-size: 13px;
            color: #F5E6D3;
          }
        `}</style>
      </head>
      <body>
        <div className="container">
          <div className="icon">📡</div>
          <h1>Offline Mode</h1>
          <p>
            Koneksi internet terputus.<br />
            Pesanan tetap bisa diterima dan akan tersinkron<br />
            secara otomatis saat koneksi kembali.
          </p>
          <div className="pending">
            💾 Pesanan tersimpan di perangkat — aman dari kehilangan data.
          </div>
        </div>
      </body>
    </html>
  );
}