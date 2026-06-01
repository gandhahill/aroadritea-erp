'use client';

import { PageHeader } from '@/components/page-header';
import { ConfirmDialog, InlineAlert } from '@/components/confirm-dialog';
import { Button, Input, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@erp/ui';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTransition, useState } from 'react';
import {
  cancelTransferAction,
  receiveTransferAction,
  shipTransferAction,
} from '../actions';

interface Props {
  data: any;
  currentUserId: string;
}

export function TransferDetail({ data, currentUserId }: Props) {
  const t = useTranslations('inventory.transfer');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [receiveData, setReceiveData] = useState<Record<string, number>>(
    Object.fromEntries(data.lines.map((l: any) => [l.id, Number(l.qtySent)]))
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<'ship' | 'receive' | 'cancel' | null>(null);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft':
        return 'bg-brand-cream-3 text-brand-ink-2';
      case 'in_transit':
        return 'bg-amber-100 text-amber-700';
      case 'received':
        return 'bg-green-100 text-green-700';
      case 'cancelled':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-brand-cream-3 text-brand-ink-2';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'draft':
        return t('statusDraft');
      case 'in_transit':
        return t('statusInTransit');
      case 'received':
        return t('statusReceived');
      case 'cancelled':
        return t('statusCancelled');
      default:
        return status;
    }
  };



  const executeAction = () => {
    if (!confirmAction) return;

    startTransition(async () => {
      setErrorMsg(null);
      let res;
      if (confirmAction === 'cancel') {
        res = await cancelTransferAction(data.id);
      } else if (confirmAction === 'ship') {
        res = await shipTransferAction(data.id, data.version);
      } else if (confirmAction === 'receive') {
        const receiveLines = Object.entries(receiveData).map(([lineId, qtyReceived]) => ({
          lineId,
          qtyReceived: String(qtyReceived),
        }));
        res = await receiveTransferAction(data.id, data.version, receiveLines);
      }

      if (res?.error) {
        setErrorMsg(res.error);
      }
      setConfirmAction(null);
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={<>{data.number}</>}
        description={<>{t('subtitle')}</>}
        actions={
          <div className="flex items-center gap-3">
            {data.status === 'draft' && (
              <>
                <Button variant="danger" onClick={() => setConfirmAction('cancel')} disabled={isPending}>
                  {t('actionCancel')}
                </Button>
                <Button onClick={() => setConfirmAction('ship')} disabled={isPending}>
                  {t('actionShip')}
                </Button>
              </>
            )}
            {data.status === 'in_transit' && (
              <Button variant="primary" onClick={() => setConfirmAction('receive')} disabled={isPending}>
                {t('actionReceive')}
              </Button>
            )}
          </div>
        }
      />

      {errorMsg && (
        <InlineAlert message={errorMsg} tone="error" onDismiss={() => setErrorMsg(null)} />
      )}

      {confirmAction && (
        <ConfirmDialog
          title={tCommon('actions.confirm')}
          message={
            confirmAction === 'cancel'
              ? 'Are you sure you want to cancel this transfer?'
              : confirmAction === 'ship'
                ? 'Are you sure you want to ship this transfer? This will deduct stock from the source location.'
                : 'Are you sure you want to receive this transfer? This will add stock to the destination location.'
          }
          tone={confirmAction === 'cancel' ? 'danger' : 'default'}
          onConfirm={executeAction}
          onCancel={() => setConfirmAction(null)}
        />
      )}

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
        <section className="rounded-xl border border-brand-cream-3 bg-card p-5 shadow-sm lg:col-span-2">
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-brand-cream-3 pb-4">
              <h2 className="font-semibold text-brand-ink">{t('lines')}</h2>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tCommon('labels.product')}</TableHead>
                  <TableHead>UoM</TableHead>
                  <TableHead className="text-right">{t('qtySent')}</TableHead>
                  <TableHead className="text-right">{t('qtyReceived')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.lines.map((line: any) => (
                  <TableRow key={line.id} className="hover:bg-brand-cream-2/50">
                    <TableCell className="font-medium">{line.productName}</TableCell>
                    <TableCell>{line.uom}</TableCell>
                    <TableCell className="text-right">{Number(line.qtySent)}</TableCell>
                    <TableCell className="text-right">
                      {data.status === 'in_transit' ? (
                        <Input
                          type="number"
                          step="0.001"
                          className="w-24 text-right ml-auto"
                          value={receiveData[line.id]}
                          onChange={(e) =>
                            setReceiveData({ ...receiveData, [line.id]: Number(e.target.value) })
                          }
                          disabled={isPending}
                        />
                      ) : (
                        Number(line.qtyReceived || 0)
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>

        <section className="rounded-xl border border-brand-cream-3 bg-card p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-brand-cream-3 pb-4">
            <h2 className="font-semibold text-brand-ink">{tCommon('labels.details')}</h2>
          </div>
          <div className="space-y-4">
            <div>
              <span className="block text-sm font-medium text-brand-ink-3">{t('status')}</span>
              <div className="mt-1">
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${getStatusColor(data.status)}`}>
                  {getStatusLabel(data.status)}
                </span>
              </div>
            </div>
            <div>
              <span className="block text-sm font-medium text-brand-ink-3">{t('date')}</span>
              <p className="mt-1 font-medium text-brand-ink">{data.transferDate}</p>
            </div>
            <div>
              <span className="block text-sm font-medium text-brand-ink-3">{t('fromLocation')}</span>
              <p className="mt-1 font-medium text-brand-ink">{data.fromLocationName}</p>
            </div>
            <div>
              <span className="block text-sm font-medium text-brand-ink-3">{t('toLocation')}</span>
              <p className="mt-1 font-medium text-brand-ink">{data.toLocationName}</p>
            </div>
            {data.notes && (
              <div>
                <span className="block text-sm font-medium text-brand-ink-3">{t('notes')}</span>
                <p className="mt-1 text-sm text-brand-ink/80 whitespace-pre-wrap">{data.notes}</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
