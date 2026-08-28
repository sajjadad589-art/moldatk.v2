/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Subscriber,
  SubscriptionTierPricing,
  Collector,
  ActiveUserSession,
  GeneratorSpecs,
  LineDistribution,
} from './types';
import { INITIAL_PRICING_TIERS, INITIAL_GENERATOR_SPECS } from './data/initialData';
import { calculateSubscriberBill } from './utils/formatters';
import { Search, Printer, LogOut, Zap, CheckCircle, X, AlertCircle, Layers, Lock, Phone, UserPlus, Edit3, Save } from 'lucide-react';

const formatNumberEn = (num: number): string => num.toLocaleString('en-US');
const formatCurrencyEn = (amount: number): string => `${formatNumberEn(amount)} د.ع`;

const scopedKey = (baseKey: string, generatorId?: string | null) =>
  generatorId ? `${baseKey}_${generatorId}` : baseKey;

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch (e) {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new Event('moldatk-local-sync'));
}

function getKnownGeneratorIds(): string[] {
  const ids = new Set<string>();

  const accounts = readJson<any[]>('moldatk_generator_accounts', []);
  for (const item of accounts) {
    if (item?.generatorId) ids.add(String(item.generatorId));
  }

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i) || '';
    const match = key.match(/^moldatk_(?:subscribers|collectors|lines|monthly_tariffs|generator)_(.+)$/);
    if (match?.[1]) ids.add(match[1]);
  }

  return Array.from(ids);
}

function loadCollectorsIndex(): Collector[] {
  const collected: Collector[] = [];

  for (const generatorId of getKnownGeneratorIds()) {
    const list = readJson<Collector[]>(scopedKey('moldatk_collectors', generatorId), []);
    for (const collector of list) {
      collected.push({ ...collector, generatorId: collector.generatorId || generatorId });
    }
  }

  // دعم مؤقت للحسابات القديمة غير المعزولة؛ لا ننشئ بيانات وهمية.
  const legacy = readJson<Collector[]>('moldatk_collectors', []);
  for (const collector of legacy) {
    if (!collected.some(c => c.id === collector.id && c.phone === collector.phone)) {
      collected.push({ ...collector, generatorId: collector.generatorId || null });
    }
  }

  return collected;
}

function getActiveTariffs(generatorId?: string | null): SubscriptionTierPricing[] {
  const tariffs = readJson<any[]>(scopedKey('moldatk_monthly_tariffs', generatorId), []);
  const active = tariffs.find((m: any) => m?.isCurrentActive) || tariffs[0];
  return active?.tiers || INITIAL_PRICING_TIERS;
}

function loadGeneratorName(generatorId?: string | null): string {
  const specs = readJson<Partial<GeneratorSpecs>>(scopedKey('moldatk_generator', generatorId), {});
  if (specs?.generatorName) return String(specs.generatorName);

  const accounts = readJson<any[]>('moldatk_generator_accounts', []);
  const account = accounts.find(x => x?.generatorId === generatorId);
  if (account?.generatorName) return String(account.generatorName);

  return 'مولدتك';
}

function loadConfiguredLines(generatorId?: string | null): string[] {
  const lines = readJson<LineDistribution[]>(scopedKey('moldatk_lines', generatorId), []);
  return lines.map((l: any) => typeof l === 'string' ? l : l.name).filter(Boolean);
}

function generateUniqueSubscriberCode(generatorId: string | null | undefined, existing: Subscriber[]) {
  const prefix = generatorId ? generatorId.replace(/-/g, '').slice(0, 5).toUpperCase() : 'LOCAL';
  const used = new Set(existing.map(s => s.code || s.subscriberCode).filter(Boolean));
  let index = existing.length + 1;
  let code = `MW-${prefix}-${String(index).padStart(4, '0')}`;
  while (used.has(code)) {
    index += 1;
    code = `MW-${prefix}-${String(index).padStart(4, '0')}`;
  }
  return code;
}

export default function CollectorApp() {
  const [userSession, setUserSession] = useState<ActiveUserSession | null>(() =>
    readJson<ActiveUserSession | null>('moldatk_collector_session', null)
  );

  const [collectors, setCollectors] = useState<Collector[]>(() => loadCollectorsIndex());

  const [loginPhone, setLoginPhone] = useState('');
  const [loginPin, setLoginPin] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);

  const [subscribers, setSubscribers] = useState<Subscriber[]>(() =>
    userSession?.generatorId
      ? readJson<Subscriber[]>(scopedKey('moldatk_subscribers', userSession.generatorId), [])
      : []
  );

  const [generatorName, setGeneratorName] = useState<string>(() => loadGeneratorName(userSession?.generatorId || null));
  const [pricingTiers, setPricingTiers] = useState<SubscriptionTierPricing[]>(() => getActiveTariffs(userSession?.generatorId || null));
  const [configuredLines, setConfiguredLines] = useState<string[]>(() => loadConfiguredLines(userSession?.generatorId || null));

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLineFilter, setSelectedLineFilter] = useState<string>('الكل');
  const [showOnlyPaid, setShowOnlyPaid] = useState(false);
  const [selectedSub, setSelectedSub] = useState<Subscriber | null>(null);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [editFullName, setEditFullName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editLine, setEditLine] = useState('');
  const [editAmperes, setEditAmperes] = useState(5);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  const refreshCollectorRegistry = () => setCollectors(loadCollectorsIndex());

  const refreshScopedData = (generatorId?: string | null) => {
    const gid = generatorId || userSession?.generatorId || null;
    if (!gid) {
      setSubscribers([]);
      setGeneratorName('مولدتك');
      setPricingTiers(INITIAL_PRICING_TIERS);
      setConfiguredLines([]);
      return;
    }

    setSubscribers(readJson<Subscriber[]>(scopedKey('moldatk_subscribers', gid), []));
    setGeneratorName(loadGeneratorName(gid));
    setPricingTiers(getActiveTariffs(gid));
    setConfiguredLines(loadConfiguredLines(gid));
  };

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      refreshCollectorRegistry();
      if (!e.key || (userSession?.generatorId && e.key.endsWith(`_${userSession.generatorId}`))) {
        refreshScopedData(userSession?.generatorId || null);
      }
    };

    const onLocalSync = () => {
      refreshCollectorRegistry();
      refreshScopedData(userSession?.generatorId || null);
    };

    window.addEventListener('storage', onStorage);
    window.addEventListener('moldatk-local-sync', onLocalSync);
    const timer = window.setInterval(() => {
      refreshCollectorRegistry();
      if (userSession?.generatorId) refreshScopedData(userSession.generatorId);
    }, 1200);

    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('moldatk-local-sync', onLocalSync);
      window.clearInterval(timer);
    };
  }, [userSession?.generatorId]);

  useEffect(() => {
    refreshScopedData(userSession?.generatorId || null);
  }, [userSession?.generatorId]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);

    const trimmedPhone = loginPhone.trim();
    const trimmedPin = loginPin.trim();
    const latestCollectors = loadCollectorsIndex();

    const foundCollector = latestCollectors.find(c => {
      const dbPhone = String(c.phone || '').trim();
      const dbPasscode = String((c as any).passcode || (c as any).pinCode || '1234').trim();
      return dbPhone === trimmedPhone && dbPasscode === trimmedPin;
    });

    if (foundCollector) {
      const session: ActiveUserSession = {
        collectorId: foundCollector.id,
        collectorName: foundCollector.name,
        role: 'collector',
        generatorId: foundCollector.generatorId || null,
        loginTime: new Date().toISOString(),
      };

      if (!session.generatorId) {
        setLoginError('هذا الجابي غير مربوط بحساب مولدة. أعد إنشاء حساب الجابي من داخل حساب صاحب المولدة.');
        return;
      }

      setUserSession(session);
      writeJson('moldatk_collector_session', session);
      refreshScopedData(session.generatorId);
      setLoginError(null);
    } else {
      setLoginError('رقم الهاتف أو رمز الدخول غير صحيح!');
    }
  };

  const handleLogout = () => {
    if (window.confirm('هل تريد تسجيل الخروج من تطبيق الجباة؟')) {
      localStorage.removeItem('moldatk_collector_session');
      setUserSession(null);
      setSubscribers([]);
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const saveSubscribersToStorage = (updated: Subscriber[]) => {
    const gid = userSession?.generatorId || null;
    if (!gid) {
      showToast('لا يوجد حساب مولدة مربوط بهذا الجابي');
      return;
    }
    setSubscribers(updated);
    writeJson(scopedKey('moldatk_subscribers', gid), updated);
  };

  const handleMarkAsPaid = (subId: string) => {
    const updated = subscribers.map(sub => {
      if (sub.id === subId) {
        const calc = calculateSubscriberBill(sub.amperes, sub.tier, pricingTiers);
        return {
          ...sub,
          paymentStatus: 'paid' as const,
          amountPaid: calc.total,
          amountDue: 0,
          lastPaymentDate: new Date().toISOString().split('T')[0],
        };
      }
      return sub;
    });
    saveSubscribersToStorage(updated);
    showToast('تم تسجيل التسديد وطباعة الوصل بنجاح');

    setTimeout(() => window.print(), 300);
  };

  const handleSaveEdit = (subId: string) => {
    const updated = subscribers.map(sub => {
      if (sub.id === subId) {
        const calc = calculateSubscriberBill(editAmperes, sub.tier, pricingTiers);
        return {
          ...sub,
          fullName: editFullName,
          phone: editPhone,
          lineName: editLine,
          line: editLine,
          amperes: Number(editAmperes),
          amountDue: sub.paymentStatus === 'paid' ? 0 : calc.total,
        };
      }
      return sub;
    });
    saveSubscribersToStorage(updated);
    showToast('تم تحديث بيانات المشترك بنجاح');
    setIsEditing(false);
    setSelectedSub(null);
  };

  const handleAddNewSubscriber = (e: React.FormEvent) => {
    e.preventDefault();

    const gid = userSession?.generatorId || null;
    const code = generateUniqueSubscriberCode(gid, subscribers);
    const tier = 'normal' as const;
    const amperes = Number(editAmperes);
    const calc = calculateSubscriberBill(amperes, tier, pricingTiers);
    const lineName = editLine || configuredLines[0] || 'الكابينة الرئيسية';

    const newSub: Subscriber = {
      id: `sub-${gid || 'local'}-${Date.now()}`,
      code,
      subscriberCode: code,
      fullName: editFullName,
      phone: editPhone,
      lineName,
      line: lineName,
      amperes,
      tier,
      paymentStatus: 'unpaid',
      amountDue: calc.total,
      amountPaid: 0,
      joiningDate: new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
    };

    const updated = [newSub, ...subscribers];
    saveSubscribersToStorage(updated);
    showToast('تمت إضافة المشترك الجديد بنجاح');
    setIsAddModalOpen(false);
    setEditFullName('');
    setEditPhone('');
    setEditLine('');
    setEditAmperes(5);
  };

  const uniqueLines = ['الكل', ...configuredLines];

  const totalCollectedToday = subscribers
    .filter(s => s.paymentStatus === 'paid')
    .reduce((acc, sub) => acc + (sub.amountPaid || calculateSubscriberBill(sub.amperes, sub.tier, pricingTiers).total), 0);

  const totalUnpaidAmount = subscribers
    .filter(s => s.paymentStatus !== 'paid')
    .reduce((acc, sub) => acc + (sub.amountDue || calculateSubscriberBill(sub.amperes, sub.tier, pricingTiers).total), 0);

  const paidSubscribersCount = subscribers.filter(s => s.paymentStatus === 'paid').length;
  const currentAmpPrice = pricingTiers[0]?.pricePerAmpere || 0;

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setStartX(e.pageX - (scrollRef.current?.offsetLeft || 0));
    setScrollLeft(scrollRef.current?.scrollLeft || 0);
  };
  const handleMouseLeave = () => setIsDragging(false);
  const handleMouseUp = () => setIsDragging(false);
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    e.preventDefault();
    const x = e.pageX - (scrollRef.current?.offsetLeft || 0);
    const walk = (x - startX) * 1.5;
    if (scrollRef.current) scrollRef.current.scrollLeft = scrollLeft - walk;
  };

  if (!userSession) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 font-['Cairo']" dir="rtl">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-sm space-y-6 shadow-2xl">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-blue-600/20 text-blue-400 mx-auto flex items-center justify-center">
              <Zap className="w-6 h-6 fill-amber-400 text-amber-400 animate-pulse" />
            </div>
            <h1 className="text-lg font-black text-amber-400 drop-shadow-[0_0_15px_rgba(251,191,36,0.6)] tracking-wide">
              مولدتك
            </h1>
            <p className="text-xs text-slate-400">تسجيل دخول المحاسب / الجابي</p>
          </div>

          {loginError && (
            <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-3 rounded-xl text-xs font-bold text-center">
              {loginError}
            </div>
          )}

          {collectors.length === 0 && (
            <div className="bg-amber-500/10 border border-amber-500/20 text-amber-300 p-3 rounded-xl text-xs font-bold text-center leading-6">
              لا توجد حسابات جباة مربوطة حالياً. أضف جابي من حساب صاحب المولدة أولاً.
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 flex items-center gap-1">
                <Phone className="w-3.5 h-3.5 text-blue-400" /> رقم الهاتف
              </label>
              <input
                type="text"
                value={loginPhone}
                onChange={e => setLoginPhone(e.target.value)}
                placeholder="أدخل رقم هاتف الجابي..."
                required
                className="w-full bg-slate-800 border border-slate-700 rounded-2xl px-4 py-3 text-xs font-bold text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 flex items-center gap-1">
                <Lock className="w-3.5 h-3.5 text-amber-400" /> الرمز المخصص
              </label>
              <input
                type="password"
                value={loginPin}
                onChange={e => setLoginPin(e.target.value)}
                placeholder="أدخل الرمز السري..."
                required
                className="w-full bg-slate-800 border border-slate-700 rounded-2xl px-4 py-3 text-xs font-bold text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
            >
              تسجيل الدخول للنظام الميداني
            </button>
          </form>
        </div>
      </div>
    );
  }

  const filteredSubscribers = subscribers.filter(s => {
    const query = searchQuery ? searchQuery.toLowerCase() : '';
    const nameMatch = s.fullName ? s.fullName.toLowerCase().includes(query) : false;
    const codeMatch = (s.code || s.subscriberCode || '').toLowerCase().includes(query);
    const phoneMatch = s.phone ? s.phone.includes(query) : false;
    const currentLineName = s.lineName || s.line || '';
    const lineMatch = currentLineName.toLowerCase().includes(query);

    const matchesSearch = !searchQuery || nameMatch || codeMatch || phoneMatch || lineMatch;
    const matchesLine = selectedLineFilter === 'الكل' || currentLineName === selectedLineFilter;
    const matchesPaidStatus = showOnlyPaid ? s.paymentStatus === 'paid' : s.paymentStatus !== 'paid';

    return matchesSearch && matchesLine && matchesPaidStatus;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-['Cairo'] pb-24" dir="rtl">
      {toastMessage && (
        <div className="fixed top-5 left-5 right-5 z-[100] bg-emerald-600 text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3 text-xs font-bold animate-in slide-in-from-top">
          <CheckCircle className="w-4 h-4" />
          <span>{toastMessage}</span>
        </div>
      )}

      <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 px-4 py-3 shadow-lg">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-blue-600/20 flex items-center justify-center shrink-0">
              <Zap className="w-5 h-5 text-amber-400 fill-amber-400" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-black text-white truncate">{generatorName}</h1>
              <p className="text-[11px] text-slate-400">الجابي: {userSession.collectorName}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="p-2 rounded-xl bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white transition-all">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4 space-y-4">
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3">
            <span className="text-[10px] text-slate-400 block">المقبوض</span>
            <strong className="text-sm text-emerald-400">{formatCurrencyEn(totalCollectedToday)}</strong>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3">
            <span className="text-[10px] text-slate-400 block">غير مسدد</span>
            <strong className="text-sm text-rose-400">{formatCurrencyEn(totalUnpaidAmount)}</strong>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3">
            <span className="text-[10px] text-slate-400 block">سعر الأمبير</span>
            <strong className="text-sm text-amber-400">{formatCurrencyEn(currentAmpPrice)}</strong>
          </div>
        </div>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-500 absolute right-3 top-3" />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="بحث بالاسم، الكود، الهاتف..."
              className="w-full bg-slate-900 border border-slate-800 rounded-2xl py-2.5 pr-9 pl-3 text-xs text-white outline-none focus:border-blue-500"
            />
          </div>
          <button onClick={() => setIsAddModalOpen(true)} className="px-4 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black flex items-center gap-1">
            <UserPlus className="w-4 h-4" />
            إضافة
          </button>
        </div>

        <div
          ref={scrollRef}
          className="flex gap-2 overflow-x-auto pb-1 cursor-grab active:cursor-grabbing"
          onMouseDown={handleMouseDown}
          onMouseLeave={handleMouseLeave}
          onMouseUp={handleMouseUp}
          onMouseMove={handleMouseMove}
        >
          {uniqueLines.map(line => (
            <button
              key={line}
              onClick={() => setSelectedLineFilter(line)}
              className={`shrink-0 px-3 py-2 rounded-xl text-xs font-bold border ${selectedLineFilter === line ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-900 border-slate-800 text-slate-300'}`}
            >
              {line}
            </button>
          ))}
          <button
            onClick={() => setShowOnlyPaid(!showOnlyPaid)}
            className={`shrink-0 px-3 py-2 rounded-xl text-xs font-bold border ${showOnlyPaid ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-slate-900 border-slate-800 text-slate-300'}`}
          >
            {showOnlyPaid ? 'عرض المسددين' : 'عرض غير المسددين'}
          </button>
        </div>

        <div className="space-y-3">
          {filteredSubscribers.length === 0 ? (
            <div className="text-center py-14 bg-slate-900 rounded-3xl border border-slate-800">
              <AlertCircle className="w-10 h-10 mx-auto text-slate-600 mb-2" />
              <p className="text-xs text-slate-400 font-bold">لا توجد نتائج لهذا الحساب</p>
            </div>
          ) : filteredSubscribers.map(sub => {
            const bill = calculateSubscriberBill(sub.amperes, sub.tier, pricingTiers);
            const amount = sub.amountDue || bill.total;
            return (
              <div key={sub.id} className="bg-slate-900 border border-slate-800 rounded-3xl p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-black text-white truncate">{sub.fullName}</h3>
                    <p className="text-[11px] text-slate-400 mt-1 font-mono">{sub.code || sub.subscriberCode} • {sub.phone}</p>
                    <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                      <Layers className="w-3 h-3" />
                      {sub.lineName || sub.line || 'بدون خط'} • {sub.amperes}A
                    </p>
                  </div>
                  <span className={`px-2 py-1 rounded-lg text-[10px] font-black ${sub.paymentStatus === 'paid' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'}`}>
                    {sub.paymentStatus === 'paid' ? 'مسدد' : 'غير مسدد'}
                  </span>
                </div>

                <div className="flex items-center justify-between bg-slate-950/60 rounded-2xl p-3">
                  <span className="text-xs text-slate-400">المبلغ</span>
                  <strong className="text-base text-white">{formatCurrencyEn(sub.paymentStatus === 'paid' ? (sub.amountPaid || bill.total) : amount)}</strong>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => {
                      setSelectedSub(sub);
                      setEditFullName(sub.fullName);
                      setEditPhone(sub.phone);
                      setEditLine(sub.lineName || sub.line || '');
                      setEditAmperes(sub.amperes);
                      setIsEditing(true);
                    }}
                    className="py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center justify-center gap-1"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    تعديل
                  </button>
                  <button
                    onClick={() => { setSelectedSub(sub); setIsReceiptOpen(true); }}
                    className="py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center justify-center gap-1"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    وصل
                  </button>
                  <button
                    onClick={() => handleMarkAsPaid(sub.id)}
                    disabled={sub.paymentStatus === 'paid'}
                    className="py-2 rounded-xl bg-emerald-600 disabled:bg-slate-700 disabled:text-slate-500 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-1"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    تسديد
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {(isAddModalOpen || isEditing) && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <form onSubmit={isEditing && selectedSub ? (e) => { e.preventDefault(); handleSaveEdit(selectedSub.id); } : handleAddNewSubscriber} className="w-full max-w-md bg-slate-900 rounded-3xl border border-slate-800 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-black text-white">{isEditing ? 'تعديل مشترك' : 'إضافة مشترك'}</h2>
              <button type="button" onClick={() => { setIsAddModalOpen(false); setIsEditing(false); setSelectedSub(null); }} className="p-2 rounded-xl bg-slate-800 text-slate-300">
                <X className="w-4 h-4" />
              </button>
            </div>

            <input value={editFullName} onChange={e => setEditFullName(e.target.value)} required placeholder="اسم المشترك" className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-xs text-white outline-none focus:border-blue-500" />
            <input value={editPhone} onChange={e => setEditPhone(e.target.value)} required placeholder="رقم الهاتف" className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-xs text-white outline-none focus:border-blue-500" />

            <select value={editLine} onChange={e => setEditLine(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-xs text-white outline-none focus:border-blue-500">
              <option value="">اختر الخط / الكابينة</option>
              {configuredLines.map(line => <option key={line} value={line}>{line}</option>)}
            </select>

            <input type="number" min={1} value={editAmperes} onChange={e => setEditAmperes(Number(e.target.value) || 1)} required placeholder="عدد الأمبيرات" className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-xs text-white outline-none focus:border-blue-500" />

            <button type="submit" className="w-full py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black flex items-center justify-center gap-2">
              <Save className="w-4 h-4" />
              حفظ
            </button>
          </form>
        </div>
      )}

      {isReceiptOpen && selectedSub && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white text-black rounded-3xl p-5 space-y-4" dir="rtl">
            <div className="text-center border-b pb-3">
              <h2 className="font-black">{generatorName}</h2>
              <p className="text-xs">وصل تسديد اشتراك</p>
            </div>
            <div className="space-y-2 text-sm">
              <div>المشترك: <strong>{selectedSub.fullName}</strong></div>
              <div>الكود: <strong>{selectedSub.code || selectedSub.subscriberCode}</strong></div>
              <div>الأمبير: <strong>{selectedSub.amperes}</strong></div>
              <div>المبلغ: <strong>{formatCurrencyEn(selectedSub.amountPaid || calculateSubscriberBill(selectedSub.amperes, selectedSub.tier, pricingTiers).total)}</strong></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setIsReceiptOpen(false)} className="py-2 rounded-xl bg-slate-200 text-xs font-bold">إغلاق</button>
              <button onClick={() => window.print()} className="py-2 rounded-xl bg-blue-600 text-white text-xs font-bold">طباعة</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
