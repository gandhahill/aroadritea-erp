'use client';

import { useState, useEffect, useTransition } from 'react';
import { Button, Input, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, toast } from '@erp/ui';
import { fetchOmzetBulananAction, exportOmzetBulananXlsxAction } from './actions';
import type { OmzetBulananResult } from '@erp/services/reporting';
import { useTranslations, useLocale } from 'next-intl';

interface LocationOption {
  id: string;
  name: Record<string, string>;
}

export default function Pb1MonthlyClient({
  initialLocationId,
  locations,
}: {
  initialLocationId: string;
  locations: LocationOption[];
}) {
  const t = useTranslations('tax.pb1Monthly');
  const locale = useLocale();
  const [period, setPeriod] = useState<string>(
    `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
  );
  const [locationId, setLocationId] = useState<string>(initialLocationId);
  const [data, setData] = useState<OmzetBulananResult | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!period || !locationId) return;
    startTransition(async () => {
      const res = await fetchOmzetBulananAction(period, locationId);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      setData(res.data ?? null);
    });
  }, [period, locationId]);

  const handleExport = async () => {
    if (!period || !locationId) return;
    const res = await exportOmzetBulananXlsxAction(period, locationId);
    if (res.error) {
      toast.error(res.error);
    } else if (res.base64 && res.filename) {
      const byteCharacters = atob(res.base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = res.filename;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="w-full sm:w-48 grid gap-2">
            <label className="text-sm font-medium leading-none">{t('taxPeriod')}</label>
            <Input type="month" value={period} onChange={(e: any) => setPeriod(e.target.value)} />
          </div>
          <div className="w-full sm:w-64 grid gap-2">
            <label className="text-sm font-medium leading-none">{t('location')}</label>
            <select
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              className="h-9 w-full rounded-md border border-brand-cream-3 bg-card px-2.5 text-sm text-brand-ink focus:border-brand-red focus:outline-none"
            >
              {locations.length === 0 && <option value="">-</option>}
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name?.[locale] ?? loc.name?.id ?? loc.id}
                </option>
              ))}
            </select>
          </div>
        </div>
        <Button onClick={handleExport} disabled={isPending || !data} variant="secondary">
          {t('exportExcel')}
        </Button>
      </div>

      <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
        <div className="flex flex-col space-y-1.5 p-6 border-b">
          <h3 className="font-semibold leading-none tracking-tight">
            {t('summaryTitle')} - {data?.locationName ?? '...'}
          </h3>
        </div>
        <div className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('date')}</TableHead>
                <TableHead className="text-right">{t('grossSales')}</TableHead>
                <TableHead className="text-right">{t('netOmzet')}</TableHead>
                <TableHead className="text-right">{t('pb1')}</TableHead>
                <TableHead className="text-right">{t('adjustment')}</TableHead>
                <TableHead className="text-right">{t('fiscalOmzet')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isPending ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                    {t('loading')}
                  </TableCell>
                </TableRow>
              ) : !data ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                    {t('noData')}
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {data.rows.map((row) => (
                    <TableRow key={row.date}>
                      <TableCell>{row.date}</TableCell>
                      <TableCell className="text-right">{(Number(row.grossSales) / 100).toLocaleString('id-ID')}</TableCell>
                      <TableCell className="text-right">{(Number(row.netOmzet) / 100).toLocaleString('id-ID')}</TableCell>
                      <TableCell className="text-right">{(Number(row.pb1Amount) / 100).toLocaleString('id-ID')}</TableCell>
                      <TableCell className="text-right">{(Number(row.adjustmentAmount) / 100).toLocaleString('id-ID')}</TableCell>
                      <TableCell className="text-right font-medium">{(Number(row.fiscalOmzet) / 100).toLocaleString('id-ID')}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/50 font-bold">
                    <TableCell>{t('total')}</TableCell>
                    <TableCell className="text-right">{(Number(data.totals.grossSales) / 100).toLocaleString('id-ID')}</TableCell>
                    <TableCell className="text-right">{(Number(data.totals.netOmzet) / 100).toLocaleString('id-ID')}</TableCell>
                    <TableCell className="text-right">{(Number(data.totals.pb1Amount) / 100).toLocaleString('id-ID')}</TableCell>
                    <TableCell className="text-right">{(Number(data.totals.adjustmentAmount) / 100).toLocaleString('id-ID')}</TableCell>
                    <TableCell className="text-right">{(Number(data.totals.fiscalOmzet) / 100).toLocaleString('id-ID')}</TableCell>
                  </TableRow>
                </>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
