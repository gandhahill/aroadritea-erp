/**
 * BI charts (client) — recharts-based visualizations.
 *
 * The BI page is a server component; these charts run client-side
 * because recharts needs ResponsiveContainer and useEffect refs to
 * size SVG against the parent box.
 *
 * Brand palette: brand-red / brand-jade / brand-ember-5 / brand-ember-3
 * stays consistent with the rest of the dash (ADR-0006).
 */
'use client';

import {
  Bar,
  BarChart as RechartsBar,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const BRAND_RED = 'var(--color-brand-red, #d6262e)';
const BRAND_JADE = 'var(--color-brand-jade, #4a8f8a)';
const BRAND_EMBER_3 = 'var(--color-brand-ember-3, #f6c177)';
const BRAND_EMBER_5 = 'var(--color-brand-ember-5, #d97757)';
const BRAND_INK_3 = 'var(--color-brand-ink-3, #6b6b6b)';
const PIE_PALETTE = [BRAND_RED, BRAND_JADE, BRAND_EMBER_5, BRAND_EMBER_3, BRAND_INK_3];

const formatRupiahShort = (value: number): string => {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}jt`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}rb`;
  return new Intl.NumberFormat('id-ID').format(value);
};

const formatRupiahFull = (value: number): string =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value);

interface TrendDatum {
  label: string;
  value: number;
  orders?: number;
}

export function TrendLineChart({ data, height = 220 }: { data: TrendDatum[]; height?: number }) {
  if (data.length === 0) {
    return <p className="text-xs text-brand-ink-3">Belum ada data.</p>;
  }
  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: BRAND_INK_3 }} />
          <YAxis tickFormatter={formatRupiahShort} tick={{ fontSize: 10, fill: BRAND_INK_3 }} />
          <Tooltip
            formatter={(value) => formatRupiahFull(Number(value))}
            labelStyle={{ color: BRAND_INK_3, fontSize: 12 }}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke={BRAND_RED}
            strokeWidth={2}
            dot={{ r: 3, fill: BRAND_RED }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

interface BarDatum {
  label: string;
  value: number;
  sub?: string;
}

export function HorizontalBarChart({ data, height = 240 }: { data: BarDatum[]; height?: number }) {
  if (data.length === 0) {
    return <p className="text-xs text-brand-ink-3">Belum ada data.</p>;
  }
  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <RechartsBar
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 16, left: 8, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(0,0,0,0.06)" />
          <XAxis type="number" tickFormatter={formatRupiahShort} tick={{ fontSize: 10, fill: BRAND_INK_3 }} />
          <YAxis
            type="category"
            dataKey="label"
            width={86}
            tick={{ fontSize: 10, fill: BRAND_INK_3 }}
          />
          <Tooltip
            formatter={(value) => formatRupiahFull(Number(value))}
            labelStyle={{ color: BRAND_INK_3, fontSize: 12 }}
          />
          <Bar dataKey="value" fill={BRAND_RED} radius={[0, 4, 4, 0]} />
        </RechartsBar>
      </ResponsiveContainer>
    </div>
  );
}

export function VerticalBarChart({ data, height = 200 }: { data: BarDatum[]; height?: number }) {
  if (data.length === 0) {
    return <p className="text-xs text-brand-ink-3">Belum ada data.</p>;
  }
  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <RechartsBar
          data={data}
          margin={{ top: 4, right: 4, left: 8, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
          <XAxis dataKey="label" tick={{ fontSize: 9, fill: BRAND_INK_3 }} interval={0} />
          <YAxis tickFormatter={formatRupiahShort} tick={{ fontSize: 10, fill: BRAND_INK_3 }} />
          <Tooltip
            formatter={(value) => formatRupiahFull(Number(value))}
            labelStyle={{ color: BRAND_INK_3, fontSize: 12 }}
          />
          <Bar dataKey="value" fill={BRAND_RED} radius={[4, 4, 0, 0]} />
        </RechartsBar>
      </ResponsiveContainer>
    </div>
  );
}

interface PieDatum {
  label: string;
  value: number;
}

export function DonutChart({ data, height = 220 }: { data: PieDatum[]; height?: number }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) {
    return <p className="text-xs text-brand-ink-3">Belum ada data.</p>;
  }
  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="label"
            innerRadius="55%"
            outerRadius="85%"
            paddingAngle={2}
          >
            {data.map((_, index) => (
              <Cell key={index} fill={PIE_PALETTE[index % PIE_PALETTE.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(value) => formatRupiahFull(Number(value))} />
          <Legend
            wrapperStyle={{ fontSize: 11, color: BRAND_INK_3 }}
            iconSize={10}
            verticalAlign="bottom"
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
