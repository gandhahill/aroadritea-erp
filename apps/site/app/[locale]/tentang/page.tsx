/**
 * About Page — SD §22.2
 */
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: 'Tentang Kami',
    description: 'Cerita Aroadri Tea — Chinese-style bubble tea & dessert',
  };
}

export default async function AboutPage({ params }: Props) {
  const { locale } = await params;

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 text-center">
      <h1 className="text-3xl font-bold text-brand-ink">Tentang Aroadri Tea</h1>
      <p className="mt-4 text-lg leading-relaxed text-brand-ink-2">
        Aroadri Tea menghadirkan pengalaman <strong>teh bubble dan dessert</strong> ala tradisi China dalam suasana modern. Setiap minuman dibuat dengan bahan berkualitas dan penuh dedikasi.
      </p>
      <div className="mt-12 grid grid-cols-3 gap-6 text-center">
        {PILLARS.map((p) => (
          <div key={p.title} className="rounded-xl bg-white p-6 shadow-sm">
            <div className="text-3xl">{p.emoji}</div>
            <h3 className="mt-2 font-semibold text-brand-ink">{p.title}</h3>
            <p className="mt-1 text-sm text-brand-ink-3">{p.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

const PILLARS = [
  { emoji: '🏔️', title: 'Tradisi', desc: 'Cita rasa klasil China' },
  { emoji: '☕', title: 'Kualitas', desc: 'Bahan premium import' },
  { emoji: '💚', title: 'Passion', desc: 'Dibuat dengan cinta' },
];
