'use client';

import type { BupotSummaryRow } from '@erp/services/tax';
import {
  Button,
  Input,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  toast,
} from '@erp/ui';
import { useTranslations } from 'next-intl';
import { useEffect, useState, useTransition } from 'react';
import {
  exportBuktiPotongCsvAction,
  exportBupot21XmlAction,
  exportBupotUnifikasiXmlAction,
  fetchBuktiPotongAction,
} from './actions';

export default function BupotClient() {
  const t = useTranslations('tax.bupot');
  const [period, setPeriod] = useState<string>(
    `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
  );
  const [rows, setRows] = useState<BupotSummaryRow[]>([]);
  const [isPending, startTransition] = useTransition();

  // Manual overrides for Coretax export (blank = default/derived per row).
  const [taxObjectCode, setTaxObjectCode] = useState('');
  const [documentType, setDocumentType] = useState('');
  const [rateDecimals, setRateDecimals] = useState('4');

  const exportOpts = () => ({
    taxObjectCode: taxObjectCode.trim() || undefined,
    document: documentType.trim() || undefined,
    rateDecimals: rateDecimals.trim() === '' ? undefined : Number(rateDecimals),
  });

  useEffect(() => {
    if (!period) return;
    startTransition(async () => {
      const res = await fetchBuktiPotongAction(period);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      setRows(res.rows ?? []);
    });
  }, [period]);

  const handleExport = async () => {
    if (!period) return;
    const res = await exportBuktiPotongCsvAction(period);
    if (res.error) {
      toast.error(res.error);
    } else if (res.csv) {
      const blob = new Blob([res.csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bupot-${period}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const downloadXml = (xml: string, filename: string) => {
    const blob = new Blob([xml], { type: 'application/xml;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportBp21 = async () => {
    if (!period) return;
    const res = await exportBupot21XmlAction(period, exportOpts());
    if (res.error) {
      toast.error(res.error);
    } else if (res.xml && res.filename) {
      downloadXml(res.xml, res.filename);
    }
  };

  const handleExportBpu = async () => {
    if (!period) return;
    const res = await exportBupotUnifikasiXmlAction(period, exportOpts());
    if (res.error) {
      toast.error(res.error);
    } else if (res.xml && res.filename) {
      downloadXml(res.xml, res.filename);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="w-full sm:w-64 grid gap-2">
          <label className="text-sm font-medium leading-none">{t('taxPeriodYm')}</label>
          <Input type="month" value={period} onChange={(e: any) => setPeriod(e.target.value)} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={handleExport}
            disabled={isPending || rows.length === 0}
            variant="secondary"
          >
            {t('exportCsv')}
          </Button>
          <Button
            onClick={handleExportBpu}
            disabled={isPending || rows.length === 0}
            variant="secondary"
          >
            {t('exportBpuXml')}
          </Button>
          <Button onClick={handleExportBp21} disabled={isPending} variant="primary">
            {t('exportBp21Xml')}
          </Button>
        </div>
      </div>
      <p className="-mt-2 text-xs text-brand-ink-3">{t('bp21Hint')}</p>

      <div className="rounded-lg border border-brand-cream-3 bg-card p-4">
        <h3 className="text-sm font-semibold text-brand-ink">{t('overrides.title')}</h3>
        <p className="mt-0.5 text-xs text-brand-ink-3">{t('overrides.hint')}</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div className="grid gap-1">
            <label className="text-xs font-semibold text-brand-ink-2">
              {t('overrides.taxObjectCode')}
            </label>
            <Input
              type="text"
              value={taxObjectCode}
              placeholder={t('overrides.taxObjectCodePlaceholder')}
              onChange={(e: any) => setTaxObjectCode(e.target.value)}
            />
          </div>
          <div className="grid gap-1">
            <label className="text-xs font-semibold text-brand-ink-2">
              {t('overrides.document')}
            </label>
            <Input
              type="text"
              value={documentType}
              placeholder={t('overrides.documentPlaceholder')}
              onChange={(e: any) => setDocumentType(e.target.value)}
            />
          </div>
          <div className="grid gap-1">
            <label className="text-xs font-semibold text-brand-ink-2">
              {t('overrides.rateDecimals')}
            </label>
            <Input
              type="number"
              min={0}
              max={8}
              value={rateDecimals}
              onChange={(e: any) => setRateDecimals(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
        <div className="flex flex-col space-y-1.5 p-6 border-b">
          <h3 className="font-semibold leading-none tracking-tight">{t('listTitle')}</h3>
        </div>
        <div className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('bupotNo')}</TableHead>
                <TableHead>{t('date')}</TableHead>
                <TableHead>{t('vendor')}</TableHead>
                <TableHead>{t('taxCode')}</TableHead>
                <TableHead>{t('type')}</TableHead>
                <TableHead className="text-right">{t('dpp')}</TableHead>
                <TableHead className="text-right">{t('taxAmount')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isPending ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-6 text-muted-foreground">
                    {t('loading')}
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-6 text-muted-foreground">
                    {t('noData')}
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-mono text-xs">{row.bupotNumber}</TableCell>
                    <TableCell>
                      {new Date(row.issueDate).toLocaleDateString('id-ID', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </TableCell>
                    <TableCell>{row.vendorName}</TableCell>
                    <TableCell>{row.taxCode}</TableCell>
                    <TableCell>{row.incomeType}</TableCell>
                    <TableCell className="text-right">
                      {Number(row.dpp).toLocaleString('id-ID')}
                    </TableCell>
                    <TableCell className="text-right">
                      {Number(row.taxAmount).toLocaleString('id-ID')}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
