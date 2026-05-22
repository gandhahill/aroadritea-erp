/**
 * Menu Page - SD §22.2
 * Lists sellable products by category from DB.
 */
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

const PUBLIC_MENU_IMAGE_URLS: Record<string, string> = {
  'FMT-BOO': '/photo/menu/bamboo-oolong-milk-tea.jpg',
  'FMT-OSM': '/photo/menu/osmanthus-oolong-milk-tea.jpg',
  'FMT-GLU': '/photo/menu/glutinous-fragrant-milk-tea.jpg',
  'FT-BOO': '/photo/menu/fresh-tea.jpg',
  'FT-GLU': '/photo/menu/fresh-tea.jpg',
  'FT-OSM': '/photo/menu/fresh-tea.jpg',
  'LFT-BOO': '/photo/menu/bamboo-oolong-lemon-tea.jpg',
  'LFT-GLU': '/photo/menu/glutinous-fragrant-lemon-tea.jpg',
  'LFT-OSM': '/photo/menu/osmanthus-oolong-lemon-tea.jpg',
};

export const dynamic = 'force-dynamic';

export default async function MenuPage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'menu' });
  const categories = await getPublicMenu(locale as Locale);

  return (
    <div className="px-4 py-12 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-8 lg:grid-cols-[0.78fr_1.22fr] lg:items-end">
          <div>
            <p className="inline-flex rounded-full border border-brand-red/16 bg-brand-cream-1 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-brand-red">
              Aroadri Tea
            </p>
            <h1 className="mt-5 text-4xl font-black text-brand-ink md:text-6xl">{t('title')}</h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-brand-ink-2">{t('subtitle')}</p>
          </div>
          <div className="rounded-[8px] border border-brand-red/10 bg-brand-cream-1 p-4 shadow-soft">
            <h2 className="text-sm font-black uppercase tracking-[0.16em] text-brand-red">
              {t('optionsTitle')}
            </h2>
            <div className="mt-4 grid gap-2 text-sm font-semibold text-brand-ink-2 sm:grid-cols-3">
              <p className="rounded-[8px] bg-brand-cream px-3 py-2">{t('sizeTemp')}</p>
              <p className="rounded-[8px] bg-brand-cream px-3 py-2">{t('sugarIce')}</p>
              <p className="rounded-[8px] bg-brand-cream px-3 py-2">{t('toppings')}</p>
            </div>
          </div>
        </div>

        {categories.length === 0 ? (
          <p className="mt-12 rounded-[8px] border border-brand-red/10 bg-brand-cream-1 px-4 py-6 text-center text-sm text-brand-ink-3 shadow-soft">
            {t('empty')}
          </p>
        ) : (
          <div className="mt-12 space-y-12">
            {categories.map((cat) => (
              <section key={cat.id}>
                <div className="mb-5 flex items-end justify-between gap-4 border-b border-brand-red/12 pb-3">
                  <h2 className="text-2xl font-black text-brand-red">{cat.name}</h2>
                  <span className="text-xs font-bold uppercase tracking-[0.16em] text-brand-ink-3">
                    {cat.items.length} items
                  </span>
                </div>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {cat.items.map((item) => (
                    <article
                      key={item.id}
                      className="rounded-[8px] border border-brand-red/10 bg-brand-cream-1 p-4 shadow-soft transition-brand hover:-translate-y-0.5 hover:shadow-pop"
                    >
                      <div className="mb-4 flex aspect-[5/3] items-center justify-center overflow-hidden rounded-[8px] bg-brand-cream text-4xl font-black text-brand-red/28">
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
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="font-display text-lg font-black text-brand-ink">
                          {item.name}
                        </h3>
                        <p className="shrink-0 rounded-full bg-brand-red px-3 py-1 text-xs font-black text-brand-cream">
                          {item.price}
                        </p>
                      </div>
                      {item.description ? (
                        <p className="mt-2 line-clamp-2 text-sm leading-6 text-brand-ink-3">
                          {item.description}
                        </p>
                      ) : null}
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

async function getPublicMenu(locale: Locale): Promise<MenuCategory[]> {
  if (!process.env.DATABASE_URL) return [];

  const tenantId = 'default';

  let rows: Array<{
    categoryId: string;
    categoryName: unknown;
    categorySortOrder: number | null;
    categoryCode: string;
    productId: string;
    productName: unknown;
    productDescription: unknown;
    imageUrl: string | null;
    defaultSellPrice: bigint;
    productSku: string;
  }>;

  let variants: Array<{ productId: string; sellPrice: bigint }>;

  try {
    const [{ db }, { productCategories, productVariants, products }, { and, eq, inArray }] =
      await Promise.all([
        import('@erp/db'),
        import('@erp/db/schema/inventory'),
        import('drizzle-orm'),
      ]);

    rows = await db
      .select({
        categoryId: productCategories.id,
        categoryName: productCategories.name,
        categorySortOrder: productCategories.sortOrder,
        categoryCode: productCategories.code,
        productId: products.id,
        productName: products.name,
        productDescription: products.description,
        imageUrl: products.imageUrl,
        defaultSellPrice: products.defaultSellPrice,
        productSku: products.sku,
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

    const productIds = rows.map((row) => row.productId);
    variants =
      productIds.length > 0
        ? await db
            .select({
              productId: productVariants.productId,
              sellPrice: productVariants.sellPrice,
            })
            .from(productVariants)
            .where(
              and(
                inArray(productVariants.productId, productIds),
                eq(productVariants.isActive, true),
              ),
            )
        : [];
  } catch {
    return [];
  }

  const priceMap = new Map<string, bigint[]>();
  for (const variant of variants) {
    const prices = priceMap.get(variant.productId) ?? [];
    if (variant.sellPrice > BigInt(0)) prices.push(variant.sellPrice);
    priceMap.set(variant.productId, prices);
  }

  const categoryMap = new Map<string, MenuCategory>();
  for (const row of rows) {
    let category = categoryMap.get(row.categoryId);
    if (!category) {
      category = {
        id: row.categoryId,
        name: localized(row.categoryName as LocalizedText, locale),
        items: [],
      };
      categoryMap.set(row.categoryId, category);
    }

    const prices = priceMap.get(row.productId) ?? [];
    category.items.push({
      id: row.productId,
      name: localized(row.productName as LocalizedText, locale),
      description: row.productDescription
        ? localized(row.productDescription as LocalizedText, locale)
        : null,
      imageUrl:
        PUBLIC_MENU_IMAGE_URLS[row.productSku] ??
        (row.imageUrl?.startsWith('/api/')
          ? `${process.env.NEXT_PUBLIC_WEB_URL || 'https://erp.aroadritea.com'}${row.imageUrl}`
          : row.imageUrl),
      price:
        prices.length > 0
          ? formatPriceRange(prices, locale)
          : row.defaultSellPrice > BigInt(0)
            ? formatRupiah(row.defaultSellPrice, locale)
            : '',
    });
  }

  return Array.from(categoryMap.values());
}

function localized(value: LocalizedText, locale: Locale): string {
  return value[locale] ?? value.id ?? value.en ?? value.zh ?? '';
}

function formatPriceRange(values: bigint[], locale: Locale): string {
  const sorted = [...values].sort((a, b) => Number(a - b));
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  if (!min || !max) return '';
  if (min === max) return formatRupiah(min, locale);
  return `${formatRupiah(min, locale)}-${formatRupiah(max, locale).replace(/^Rp\s?/, '')}`;
}

function formatRupiah(value: bigint, locale: Locale): string {
  const intlLocale = locale === 'id' ? 'id-ID' : locale === 'zh' ? 'zh-CN' : 'en-US';
  return new Intl.NumberFormat(intlLocale, {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(Number(value));
}
