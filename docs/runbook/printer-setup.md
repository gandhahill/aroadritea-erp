# Runbook — Cashier printer setup & kiosk printing

The POS prints two artefacts per sale: an 80 mm thermal **receipt**
and 40 × 30 mm cup **labels** (one per cup). When two printers are
available these go to separate devices; otherwise they share one
80 mm printer.

## Hardware checklist

- **Receipt printer**: 80 mm thermal (EPSON TM-T82 / XPrinter XP-T80A
  / Iware HOP-T802). USB or LAN.
- **Label printer**: 40 × 30 mm thermal (XPrinter XP-365B / TSC TE-200).
  USB.
- Both installed via OS, given recognisable names. Examples:
  - `EPSON_TM-T82`
  - `XP-365B`

## Step 1 — Install printer drivers in OS

Follow the vendor instructions. Print a Windows / macOS test page from
the OS printer dialog to confirm.

## Step 2 — Configure POS settings

1. Sign in as director.
2. Open **Settings → POS** (path `/settings/pos`).
3. For each outlet:
   - **Lebar Struk Thermal**: typically 80 (mm).
   - Click **Detect printers**. If the local Print Bridge is running,
     the receipt and label printer fields become dropdowns populated
     from the cashier PC.
   - **Printer Struk (OS)**: select the receipt printer (e.g.
     `EPSON_TM-T82`) or type it manually if bridge detection is not
     available.
   - **Printer Label (OS)**: select the label printer (e.g. `XP-365B`)
     or leave blank if only one printer is in use.
4. Click "Simpan".

## Step 3 — Enable kiosk printing (skip print preview)

By default the browser shows the print preview dialog before printing.
For a cashier-friendly silent print, do this once per cashier PC:

1. **Close all Chrome windows** on the cashier PC.
2. Edit the Chrome launcher (Desktop shortcut → Properties → Target).
   Append the `--kiosk-printing` flag, e.g.:

   ```text
   "C:\Program Files\Google\Chrome\Application\chrome.exe" --kiosk-printing
   ```

3. Save. Always launch the cashier Chrome via this shortcut.
4. Set the **OS default printer** to whichever printer the auto-print
   flow should target. If two printers are wired, accept the
   limitation: kiosk mode prints to one device only.
5. In ERP POS settings, tick **"Mode Kiosk Printing"** for the outlet.
   The print routes (`/pos/print/receipt/...`, `/pos/print/label/...`)
   will skip the 250 ms delay and call `window.print()` immediately.

## Step 4 — Verify

1. From the POS, take a test order (cash, Rp 1.000).
2. After payment, two print windows open back to back.
3. With `--kiosk-printing` on:
   - The dialog does NOT appear.
   - The receipt prints on the OS default device.
   - The label window prints next — go to OS Default if only one
     printer is set; otherwise the OS user must manually select the
     label device in the dialog (kiosk limitation).

## Optional — Local Print Bridge

Kiosk printing is single-device by design. For per-route routing
(receipt → printer A, label → printer B) without operator intervention,
deploy the **Print Bridge** agent on the cashier PC:

- Listens on `http://127.0.0.1:7913` by default.
- `GET /printers` returns either `["Printer A"]` or
  `{ "printers": [{ "name": "Printer A" }] }`.
- The ERP POS settings page tries `NEXT_PUBLIC_PRINT_BRIDGE_URL`,
  `https://127.0.0.1:7913`, `http://127.0.0.1:7913`,
  `https://localhost:7913`, and `http://localhost:7913`, then shows a
  dropdown when printers are detected.
- Future bridge builds may also expose `POST /print/receipt` and
  `POST /print/label` to bypass browser windows entirely while routing
  to the configured OS printer names.
- Distribution: Tauri-packaged ~5 MB exe, installed via MSI for Windows
  cashier PCs.

Without the bridge, browser security rules do not allow the ERP page to
enumerate OS printers directly; manual printer-name input remains the
fallback.

## Troubleshooting

| Symptom                                | Likely cause                                  | Fix                                                                                 |
| -------------------------------------- | --------------------------------------------- | ----------------------------------------------------------------------------------- |
| Print dialog still shown               | `--kiosk-printing` flag not active            | Confirm Chrome launched via the modified shortcut.                                  |
| Receipt prints to label printer        | OS default set to the wrong device            | Set OS default to the receipt printer; live with the kiosk-single-device limit.     |
| Garbled characters                     | Wrong code page on printer driver             | Re-install vendor driver, set ESC/POS code page to CP-1252 / 437.                   |
| Truncated label                        | `receiptLabelWidthMm` / `receiptLabelHeightMm` mismatch | Update in `/settings/pos` to match the physical paper size, then resave.            |
| QR code on label not scanning          | Print head dirty / low contrast               | Clean the print head with isopropyl; check that paper roll is genuine thermal stock. |
