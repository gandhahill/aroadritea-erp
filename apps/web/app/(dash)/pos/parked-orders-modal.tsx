'use client';

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
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
    const cartName = name.trim() || \`Order \${new Date().toLocaleTimeString()}\`;
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('parkCart.title')}</DialogTitle>
          <DialogDescription>{t('parkCart.description')}</DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Label htmlFor="park-name">{t('parkCart.nameLabel')}</Label>
          <Input
            id="park-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('parkCart.namePlaceholder')}
            className="mt-2"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handlePark}>{t('parkCart.confirm')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('recallCart.title')}</DialogTitle>
          <DialogDescription>{t('recallCart.description')}</DialogDescription>
        </DialogHeader>
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
                    <Button variant="destructive" size="sm" onClick={() => handleDelete(cart.id)}>
                      {t('common.delete')}
                    </Button>
                    <Button size="sm" onClick={() => handleRecall(cart)}>
                      {t('recallCart.recall')}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
