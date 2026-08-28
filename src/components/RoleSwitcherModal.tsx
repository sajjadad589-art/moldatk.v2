import React, { useState } from 'react';
import {
  X,
  Shield,
  ShieldCheck,
  UserCheck,
  Users,
  Check,
  Lock,
  Phone,
  Key,
  Layers,
  ArrowRight,
  SlidersHorizontal,
} from 'lucide-react';
import { Collector, ActiveUserSession } from '../types';
import { formatNumberArabic } from '../utils/formatters';

interface RoleSwitcherModalProps {
  isOpen: boolean;
  onClose: () => void;
  collectors: Collector[];
  currentSession: ActiveUserSession;
  onSwitchSession: (session: ActiveUserSession) => void;
}

export const RoleSwitcherModal: React.FC<RoleSwitcherModalProps> = ({
  isOpen,
  onClose,
  collectors,
  currentSession,
  onSwitchSession,
}) => {
  if (!isOpen) return null;

  const isAdmin = currentSession.role === 'admin';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs select-none">
      <div
        id="role-switcher-modal"
        className="w-full max-w-lg bg-white dark:bg-[#111c38] rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Modal Header */}
        <div className="p-5 bg-gradient-to-r from-blue-900 to-indigo-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-white/10 text-white backdrop-blur-xs">
              <ShieldCheck className="w-6 h-6 text-yellow-400" />
            </div>
            <div>
              <h3 className="text-base font-black">تبديل حساب المستخدم والصلاحيات</h3>
              <p className="text-xs text-blue-200 mt-0.5">
                اختر الحساب لتجربة صلاحيات الجابي أو صلاحيات المدير
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          {/* Admin Account Option */}
          <div
            onClick={() => {
              onSwitchSession({ role: 'admin' });
              onClose();
            }}
            className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between gap-3 ${
              isAdmin
                ? 'bg-blue-50 dark:bg-blue-950/50 border-blue-600 ring-2 ring-blue-500/20 shadow-sm'
                : 'bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-700'
            }`}
          >
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center font-black shadow-md shrink-0">
                <Shield className="w-6 h-6 text-yellow-300" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-black text-sm text-slate-900 dark:text-white">
                    مدير المنظومة (Admin)
                  </span>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                    صلاحيات كاملة
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  الوصول لكافة الإعدادات، تعديل التسعيرة، التحكم بالمولد، وسجلات الأمان
                </p>
              </div>
            </div>

            {isAdmin && (
              <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                <Check className="w-4 h-4" />
              </div>
            )}
          </div>

          <div className="relative py-2 flex items-center justify-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200 dark:border-slate-800" />
            </div>
            <span className="relative px-3 bg-white dark:bg-[#111c38] text-[11px] font-bold text-slate-400">
              حسابات الجباة المسجلين ({formatNumberArabic(collectors.length)})
            </span>
          </div>

          {/* Collectors List */}
          <div className="space-y-2.5">
            {collectors.map(c => {
              const isSelected =
                currentSession.role === 'collector' && currentSession.collectorId === c.id;

              const perms = c.permissions || {
                canCollectPayments: true,
                canCancelPayments: false,
                canAddSubscribers: false,
                canEditSubscribers: false,
                canDeleteSubscribers: false,
                canApplyFreeExemption: false,
                canPrintReceipts: true,
                canViewFinancialReports: false,
                canAccessSystemSettings: false,
              };

              return (
                <div
                  key={c.id}
                  onClick={() => {
                    onSwitchSession({
                      role: 'collector',
                      collectorId: c.id,
                      collectorName: c.name,
                    });
                    onClose();
                  }}
                  className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between gap-3 ${
                    isSelected
                      ? 'bg-blue-50 dark:bg-blue-950/50 border-blue-600 ring-2 ring-blue-500/20 shadow-sm'
                      : 'bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-700'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center font-bold text-sm shrink-0">
                      <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 dark:text-white truncate">
                          {c.name}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 shrink-0">
                          {c.assignedLineName}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                        <span className="flex items-center gap-1 font-mono">
                          <Phone className="w-3 h-3 text-slate-400" />
                          {c.phone}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1 font-mono text-amber-600 dark:text-amber-400 font-bold">
                          <Key className="w-3 h-3" />
                          الرمز: {c.passcode || '1234'}
                        </span>
                      </div>

                      {/* Brief permissions badges */}
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                          تسديد المشتركين ✓
                        </span>
                        {perms.canPrintReceipts && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300">
                            طباعة وصولات ✓
                          </span>
                        )}
                        {!perms.canAccessSystemSettings && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300">
                            حجب الإعدادات ✕
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {isSelected && (
                    <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                      <Check className="w-3.5 h-3.5" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="text-[11px] text-slate-500 dark:text-slate-400">
            الحساب الحالي:{' '}
            <strong className="text-slate-900 dark:text-white">
              {isAdmin ? 'مدير المنظومة (Admin)' : `الجابي: ${currentSession.collectorName}`}
            </strong>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs transition-colors"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
