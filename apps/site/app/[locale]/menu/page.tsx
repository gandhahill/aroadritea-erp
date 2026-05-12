/**
 * Menu Page — SD §22.2
 * Lists products by category. CMS-driven in production.
 */
import { getTranslations } from 'next-intl/server';

interface Props {
  params: Promise<{ locale: string }>;
}

export default async function MenuPage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'menu' });

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="mb-8 text-center text-3xl font-bold text-brand-ink">{t('title')}</h1>

      {/* Categories */}
      <div className="space-y-12">
        {CATEGORIES.map((cat) => (
          <section key={cat.slug}>
            <h2 className="mb-4 border-b border-brand-cream-3 pb-2 text-xl font-semibold text-brand-red">{cat.name}</h2>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              {cat.items.map((item) => (
                <div key={item.name} className="rounded-xl bg-white p-4 shadow-sm">
                  <div className="mb-2 flex h-28 items-center justify-center rounded-lg bg-brand-cream-3 text-4xl">{item.emoji}</div>
                  <p className="font-medium text-brand-ink">{item.name}</p>
                  <p className="mt-1 text-sm text-brand-ink-3">{item.price}</p>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

// Placeholder data — will be replaced by CMS in T-0121/T-0123
const CATEGORIES = [
  {
    slug: 'boba-tea',
    name: 'Bubble Tea',
    items: [
      { name: 'Brown Sugar Boba', price: 'Rp 22.000', emoji: '🧋' },
      { name: 'Taro Milk Tea', price: 'Rp 22.000', emoji: '🧋' },
      { name: 'Matcha Latte', price: 'Rp 25.000', emoji: '🍵' },
    ],
  },
  {
    slug: 'dessert',
    name: 'Dessert',
    items: [
      { name: 'Grass Jelly', price: 'Rp 12.000', emoji: '🍵' },
      { name: 'Pudding', price: 'Rp 12.000', emoji: '🍮' },
      { name: 'Mochi', price: 'Rp 10.000', emoji: '🍡' },
    ],
  },
];
