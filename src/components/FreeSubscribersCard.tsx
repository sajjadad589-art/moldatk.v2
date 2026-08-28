import React from 'react';
import { HeartHandshake, ShieldCheck, Sparkles, ArrowLeft } from 'lucide-react';
import { formatNumberArabic } from '../utils/formatters';
import { Subscriber } from '../types';

interface FreeSubscribersCardProps {
  id?: string;
  freeSubscribers: Subscriber[];
  totalSubscribersCount: number;
  onViewListClick: () => void;
}

export const FreeSubscribersCard: React.FC<FreeSubscribersCardProps> = ({
  id,
  freeSubscribers,
  totalSubscribersCount,
  onViewListClick,
}) => {
  const freeCount = freeSubscribers.length;
  const totalFreeAmperes = freeSubscribers.reduce((acc, sub) => acc + sub.amperes, 0);
  const freePercentage =
    totalSubscribersCount > 0 ? ((freeCount / totalSubscribersCount) * 100).toFixed(1) : '0';

  // Sample avatars or initials for the Bento Avatar Stack
  const sampleInitials = ['مسجد', 'شهيد', 'حراسة', 'صحي', '+'];

  return (
    <div
      id={id}
      className="bg-[#1E3A8A] rounded-3xl p-6 sm:p-7 shadow-lg flex flex-col justify-between text-white relative overflow-hidden transition-all hover:shadow-xl group"
    >
      {/* Subtle background illumination */}
      <div className="absolute top-0 right-0 w-44 h-44 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      <div>
        {/* Header */}
        <div className="flex justify-between items-start mb-3">
          <div>
            <span className="text-blue-200 text-sm font-bold block">
              الاشتراكات المجانية (Free Subscribers)
            </span>
            <p className="text-xs text-blue-300/80 mt-0.5">
              الإعفاءات الخدمية والإنسانية والمساجد
            </p>
          </div>
          <span className="bg-blue-900/80 text-blue-200 border border-blue-700/60 text-[10px] px-3 py-1 rounded-full font-bold uppercase tracking-wider">
            FREE / إعفاء
          </span>
        </div>

        {/* Big Key Counter */}
        <div className="my-3">
          <div className="flex items-baseline gap-2">
            <span className="text-5xl font-black text-white tracking-tight tabular-nums">
              {formatNumberArabic(freeCount)}
            </span>
            <span className="text-sm text-blue-200 font-bold">مشترك معفي</span>
          </div>
          <p className="text-xs text-blue-200/90 mt-1">
            يعادل {formatNumberArabic(Number(freePercentage))}% من إجمالي المشتركين ({formatNumberArabic(totalFreeAmperes)} أمبير مغطى مجاناً)
          </p>
        </div>

        {/* Avatar Bubble Stack (Bento Design Element) */}
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-blue-800/80">
          <div className="flex -space-x-2 space-x-reverse">
            <div className="w-8 h-8 rounded-full border-2 border-[#1E3A8A] bg-blue-400 flex items-center justify-center text-[10px] font-bold text-[#1E3A8A] shadow-xs">
              🕌
            </div>
            <div className="w-8 h-8 rounded-full border-2 border-[#1E3A8A] bg-emerald-400 flex items-center justify-center text-[10px] font-bold text-emerald-950 shadow-xs">
              🎖️
            </div>
            <div className="w-8 h-8 rounded-full border-2 border-[#1E3A8A] bg-yellow-400 flex items-center justify-center text-[10px] font-bold text-yellow-950 shadow-xs">
              🏥
            </div>
            <div className="w-8 h-8 rounded-full border-2 border-[#1E3A8A] bg-blue-900 flex items-center justify-center text-[10px] font-bold text-white shadow-xs">
              +{freeCount}
            </div>
          </div>

          <span className="text-[11px] text-blue-200 flex items-center gap-1 font-medium">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" />
            معفى من الفاتورة
          </span>
        </div>
      </div>

      {/* Action Trigger Button */}
      <button
        id="btn-view-free-subscribers"
        onClick={onViewListClick}
        className="w-full mt-4 py-2 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-colors border border-white/15 flex items-center justify-center gap-1.5 cursor-pointer"
      >
        <span>عرض قائمة المشتركين المعفيين</span>
        <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform" />
      </button>
    </div>
  );
};
