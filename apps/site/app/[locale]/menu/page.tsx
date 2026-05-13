/**
 * Menu Page — SD §22.2
 * Lists sellable products by category from DB.
 */
import { db } from '@erp/db';
import { productCategories, products } from '@erp/db/schema/inventory';
import { and, eq } from 'drizzle-orm';
import { getTranslations } from 'next-intl/server';

interface Props {
  params: Promise<{ locale: string }>;
}

type Locale = 'id' | 'en' | 'zh';
type LocalizedText = { id?: string; en?: string; zh?: string };

interface MenuCategory {
  id: string;
  name: string;
  items: MenuItem[];
}

interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  price: string;
}

export const dynamic = 'force-dynamic';

export default async function MenuPage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'menu' });
  const categories = await getPublicMenu(locale as Locale);

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="mb-8 text-center text-3xl font-bold text-brand-ink">{t('title')}</h1>

      {categories.length === 0 ? (
        <p className="text-center text-sm text-brand-ink-3">{t('empty')}</p>
      ) : (
        <div className="space-y-12">
          {categories.map((cat) => (
            <section key={cat.id}>
              <h2 className="mb-4 border-b border-brand-cream-3 pb-2 text-xl font-semibold text-brand-red">
                {cat.name}
              </h2>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                {cat.items.map((item) => (
                  <article
                    key={item.id}
                    className="rounded-lg border border-brand-cream-3 bg-brand-cream-1 p-4"
                  >
                    <div className="mb-3 flex aspect-square items-center justify-center overflow-hidden rounded-md bg-brand-cream-2 text-3xl font-semibold text-brand-red">
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt=""
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        item.name.slice(0, 1)
                      )}
                    </div>
                    <p className="font-medium text-brand-ink">{item.name}</p>
                    {item.description ? (
                      <p className="mt-1 line-clamp-2 text-xs text-brand-ink-3">
                        {item.description}
                      </p>
                    ) : null}
                    <p className="mt-2 text-sm font-semibold text-brand-red">{item.price}</p>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

async function getPublicMenu(locale: Locale): Promise<MenuCategory[]> {
  const tenantId = 'default';
  const rows = await db
    .select({
      categoryId: productCategories.id,
      categoryName: productCategories.name,
      productId: products.id,
      productName: products.name,
      productDescription: products.description,
      imageUrl: products.imageUrl,
      defaultSellPrice: products.defaultSellPrice,
    })
    .from(products)
    .innerJoin(productCategories, eq(products.categoryId, productCategories.id))
    .where(
      and(
        eq(products.tenantId, tenantId),
        eq(productCategories.tenantId, tenantId),
        eq(products.isActive, true),
        eq(products.isSellable, true),
        eq(productCategories.isActive, true),
      ),
    )
    .orderBy(productCategories.sortOrder, productCategories.code, products.sku);

  const categoryMap = new Map<string, MenuCategory>();
  for (const row of rows) {
    let category = categoryMap.get(row.categoryId);
    if (!category) {
      category = {
        id: row.categoryId,
        name: localized(row.categoryName, locale),
        items: [],
      };
      categoryMap.set(row.categoryId, category);
    }

    category.items.push({
      id: row.productId,
      name: localized(row.productName, locale),
      description: row.productDescription ? localized(row.productDescription, locale) : null,
      imageUrl: row.imageUrl,
      price: formatRupiah(row.defaultSellPrice, locale),
    });
  }

  return Array.from(categoryMap.values());
}

function localized(value: LocalizedText, locale: Locale): string {
  return value[locale] ?? value.id ?? value.en ?? value.zh ?? '';
}

function formatRupiah(value: bigint, locale: Locale): string {
  const intlLocale = locale === 'id' ? 'id-ID' : locale === 'zh' ? 'zh-CN' : 'en-US';
  return new Intl.NumberFormat(intlLocale, {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(Number(value));
}
