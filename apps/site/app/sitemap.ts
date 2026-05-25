import type { MetadataRoute } from 'next';
import { siteLocales } from '../i18n';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://aroadritea.com';

  const routes = ['', '/menu', '/locations', '/about', '/careers'].flatMap((route) =>
    siteLocales.map((locale) => ({
      url: `${baseUrl}/${locale}${route}`,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: route === '' ? 1 : 0.8,
    })),
  );

  return routes;
}
