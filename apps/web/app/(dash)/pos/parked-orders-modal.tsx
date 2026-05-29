'use client';

import {
  Button,
  Input,
} from '@erp/ui';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { deleteParkedCart, getParkedCarts, type ParkedCart, saveParkedCart } from './idb';
import { usePosCart } from './pos-cart-context';

export function ParkCartDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations('pos');
  const { state, clearCart } = usePosCart();
  const [name, setName] = useState('');

  const handlePark = async () => {
    if (state.lines.length === 0) {
      onOpenChange(false);
      return;
    }
    const cartName = name.trim() || `Order ${new Date().toLocaleTimeString()}`;
    const cart: ParkedCart = {
      id: crypto.randomUUID(),
      name: cartName,
      parkedAt: new Date(),
      state,
    };
    await saveParkedCart(cart);
    clearCart();
    setName('');
    onOpenChange(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg bg-card shadow-lg p-6">
        <h2 className="text-lg font-semibold text-brand-ink">{t('parkCart.title')}</h2>
        <p className="mt-1 text-sm text-brand-ink-3">{t('parkCart.description')}</p>
        <div className="py-4">
          <label htmlFor="park-name" className="text-sm font-medium text-brand-ink">{t('parkCart.nameLabel')}</label>
          <Input
            id="park-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('parkCart.namePlaceholder')}
            className="mt-2 w-full"
          />
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" onClick={handlePark}>{t('parkCart.confirm')}</Button>
        </div>
      </div>
    </div>
  );
}

export function RecallCartDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations('pos');
  const { loadCart } = usePosCart();
  const [carts, setCarts] = useState<ParkedCart[]>([]);

  const fetchCarts = async () => {
    const list = await getParkedCarts();
    setCarts(list.sort((a, b) => b.parkedAt.getTime() - a.parkedAt.getTime()));
  };

  useEffect(() => {
    if (open) {
      fetchCarts();
    }
  }, [open]);

  const handleRecall = async (cart: ParkedCart) => {
    loadCart(cart.state);
    await deleteParkedCart(cart.id);
    onOpenChange(false);
  };

  const handleDelete = async (id: string) => {
    await deleteParkedCart(id);
    fetchCarts();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl rounded-lg bg-card shadow-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-lg font-semibold text-brand-ink">{t('recallCart.title')}</h2>
            <p className="mt-1 text-sm text-brand-ink-3">{t('recallCart.description')}</p>
          </div>
          <button onClick={() => onOpenChange(false)} className="text-brand-ink-3 hover:text-brand-ink">&times;</button>
        </div>
        <div className="py-4 max-h-[60vh] overflow-y-auto">
          {carts.length === 0 ? (
            <p className="text-center text-sm text-brand-ink-3 py-8">
              {t('recallCart.empty')}
            </p>
          ) : (
            <ul className="space-y-3">
              {carts.map((cart) => (
                <li
                  key={cart.id}
                  className="flex items-center justify-between rounded-lg border border-brand-cream-3 p-4 bg-brand-cream-1/30"
                >
                  <div>
                    <h4 className="font-semibold text-brand-ink-1">{cart.name}</h4>
                    <p className="text-sm text-brand-ink-3 mt-1">
                      {new Date(cart.parkedAt).toLocaleString()} • {cart.state.lines.length} {t('recallCart.items')}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="danger" size="sm" onClick={() => handleDelete(cart.id)}>
                      {t('common.delete')}
                    </Button>
                    <Button variant="primary" size="sm" onClick={() => handleRecall(cart)}>
                      {t('recallCart.recall')}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
