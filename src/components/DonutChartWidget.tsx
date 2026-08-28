import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { formatNumberArabic, formatCurrency } from '../utils/formatters';

interface DonutSlice {
  name: string;
  value: number;
  color: string;
  amount?: number;
}

interface DonutChartWidgetProps {
  id?: string;
  title: string;
  subtitle: string;
  totalCount: number;
  targetCount: number;
  totalAmount?: number;
  amountLabel?: string;
  slices: DonutSlice[];
  theme: 'emerald' | 'rose' | 'blue' | 'purple';
  icon: React.ReactNode;
  actionButtonLabel?: string;
  onActionClick?: () => void;
  badgeText?: string;
}

export const DonutChartWidget: React.FC<DonutChartWidgetProps> = ({
  id,
  title,
  subtitle,
  totalCount,
  targetCount,
  totalAmount,
  amountLabel,
  slices,
  theme,
  icon,
  actionButtonLabel,
  onActionClick,
  badgeText,
}) => {
  const percentage = totalCount > 0 ? Math.round((targetCount / totalCount) * 100) : 0;

  const getThemeStyles = () => {
    switch (theme) {
      case 'emerald':
        return {
          badgeBg: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300',
          ringColor: '#10b981',
          tag: 'PAID',
        };
      case 'rose':
        return {
          badgeBg: 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300',
          ringColor: '#f43f5e',
          tag: 'UNPAID',
        };
      case 'purple':
        return {
          badgeBg: 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300',
          ringColor: '#a855f7',
          tag: 'FREE',
        };
      default:
        return {
          badgeBg: 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300',
          ringColor: '#3b82f6',
          tag: 'ACTIVE',
        };
    }
  };

  const currentTheme = getThemeStyles();

  return (
    <div
      id={id}
      className="bg-white dark:bg-[#111c38] rounded-3xl p-6 sm:p-7 shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col justify-between transition-all hover:shadow-md"
    >
      <div>
        {/* Header */}
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-slate-50 dark:bg-slate-800/80 flex items-center justify-center">
              {icon}
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">{title}</h3>
              <p className="text-xs text-slate-400 dark:text-slate-400">{subtitle}</p>
            </div>
          </div>

          <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${currentTheme.badgeBg}`}>
            {badgeText || currentTheme.tag}
          </span>
        </div>

        {/* Chart & Big Metrics in Bento Ring Style */}
        <div className="flex flex-col sm:flex-row items-center gap-4 my-2">
          {/* Circular Donut Ring */}
          <div className="w-36 h-36 relative shrink-0 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload as DonutSlice;
                      return (
                        <div className="bg-[#1E3A8A] text-white text-xs p-2 rounded-xl shadow-xl border border-blue-700 dir-rtl text-right">
                          <p className="font-bold">{data.name}</p>
                          <p className="text-blue-200">{formatNumberArabic(data.value)} مشترك</p>
                          {data.amount !== undefined && (
                            <p className="text-yellow-300 font-semibold">{formatCurrency(data.amount)}</p>
                          )}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Pie
                  data={slices}
                  cx="50%"
                  cy="50%"
                  innerRadius={46}
                  outerRadius={62}
                  paddingAngle={3}
                  dataKey="value"
                  animationDuration={800}
                >
                  {slices.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>

            {/* Centered Percentage */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl font-black text-slate-900 dark:text-white tabular-nums">
                {formatNumberArabic(percentage)}%
              </span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                {currentTheme.tag}
              </span>
            </div>
          </div>

          {/* Counts & Amount Highlights */}
          <div className="flex-1 w-full space-y-2.5">
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
              <div className="flex justify-between items-baseline">
                <span className="text-xs text-slate-500 dark:text-slate-400">العدد الفعلي:</span>
                <span className="text-lg font-black text-slate-900 dark:text-white tabular-nums">
                  {formatNumberArabic(targetCount)} <span className="text-xs font-normal text-slate-400">مشترك</span>
                </span>
              </div>
              {totalAmount !== undefined && (
                <div className="flex justify-between items-baseline mt-1 pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                  <span className="text-[11px] text-slate-400">{amountLabel || 'المبلغ'}:</span>
                  <span className="text-xs font-black text-[#1E3A8A] dark:text-blue-400 tabular-nums">
                    {formatCurrency(totalAmount)}
                  </span>
                </div>
              )}
            </div>

            {/* Slices Breakdown */}
            <div className="space-y-1">
              {slices.slice(0, 3).map((slice, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between text-xs py-0.5 px-1.5 rounded-lg text-slate-600 dark:text-slate-300"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: slice.color }}
                    />
                    <span className="text-[11px] truncate">{slice.name}</span>
                  </div>
                  <span className="font-bold tabular-nums text-[11px]">
                    {formatNumberArabic(slice.value)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {actionButtonLabel && (
        <button
          id={`btn-action-${id || 'chart'}`}
          onClick={onActionClick}
          className="w-full mt-3 py-2 px-3 text-xs font-bold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors flex items-center justify-center cursor-pointer"
        >
          {actionButtonLabel}
        </button>
      )}
    </div>
  );
};
