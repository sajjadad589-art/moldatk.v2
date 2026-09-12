import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const write = (path, value) => fs.writeFileSync(path, value, 'utf8');
const must = (value, message) => { if (!value) throw new Error(`Permanent data purge finalizer: ${message}`); };

function findMatchingBrace(source, openIndex) {
  let depth = 0;
  let quote = '';
  let escaped = false;
  let lineComment = false;
  let blockComment = false;
  for (let i = openIndex; i < source.length; i += 1) {
    const ch = source[i];
    const next = source[i + 1] || '';
    if (lineComment) {
      if (ch === '\n') lineComment = false;
      continue;
    }
    if (blockComment) {
      if (ch === '*' && next === '/') { blockComment = false; i += 1; }
      continue;
    }
    if (quote) {
      if (escaped) { escaped = false; continue; }
      if (ch === '\\') { escaped = true; continue; }
      if (ch === quote) quote = '';
      continue;
    }
    if (ch === '/' && next === '/') { lineComment = true; i += 1; continue; }
    if (ch === '/' && next === '*') { blockComment = true; i += 1; continue; }
    if (ch === "'" || ch === '"' || ch === '`') { quote = ch; continue; }
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function replaceArrowHandler(source, handlerName, replacement) {
  const start = source.indexOf(`  const ${handlerName} =`);
  if (start < 0) throw new Error(`${handlerName} start missing`);
  const arrow = source.indexOf('=>', start);
  const open = arrow >= 0 ? source.indexOf('{', arrow) : -1;
  if (open < 0) throw new Error(`${handlerName} body missing`);
  const close = findMatchingBrace(source, open);
  if (close < 0) throw new Error(`${handlerName} closing brace missing`);
  let end = close + 1;
  if (source[end] === ';') end += 1;
  return source.slice(0, start) + replacement + source.slice(end);
}

function replaceAllJsxPropExpressions(source, propName, replacementExpression) {
  let cursor = 0;
  let count = 0;
  while (true) {
    const tokenIndex = source.indexOf(`${propName}=`, cursor);
    if (tokenIndex < 0) break;
    const open = source.indexOf('{', tokenIndex + propName.length + 1);
    if (open < 0 || open > tokenIndex + propName.length + 4) {
      cursor = tokenIndex + propName.length + 1;
      continue;
    }
    const close = findMatchingBrace(source, open);
    if (close < 0) throw new Error(`${propName} JSX expression is not balanced`);
    source = source.slice(0, open) + `{${replacementExpression}}` + source.slice(close + 1);
    cursor = open + replacementExpression.length + 2;
    count += 1;
  }
  return { source, count };
}

// -----------------------------------------------------------------------------
// Owner reset + subscriber deletion: server is authoritative. Local deletion is
// performed only after the protected Edge Function confirms the permanent purge.
// -----------------------------------------------------------------------------
{
  const path = 'src/App.tsx';
  let source = read(path);

  const secureReset = `  const handleSecureSystemReset = async (password: string): Promise<SecureResetResult> => {
    if (userSession?.role !== 'generator_admin' || !userSession.generatorId) {
      return { ok: false, message: 'هذه العملية متاحة لصاحب المولدة فقط.' };
    }
    const generatorId = userSession.generatorId;
    const markerKey = getStorageKey('moldatk_factory_reset_in_progress');

    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      const email = userData.user?.email || userSession.email;
      if (!email) return { ok: false, message: 'تعذر تحديد بريد حساب صاحب المولدة.' };

      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) return { ok: false, message: 'كلمة المرور غير صحيحة. لم يتم حذف أي بيانات.' };

      const backup = {
        exportedAt: new Date().toISOString(),
        generatorId,
        generatorSpecs,
        subscribers,
        monthlyTariffs,
        auditLogs,
        lines,
        collectors,
        invoiceTemplate,
        walletResetTimestamp,
      };
      try {
        localStorage.setItem('moldatk_emergency_backup_last_' + generatorId + '_SAFE', JSON.stringify(backup));
      } catch (backupError) {
        console.warn('Could not keep local emergency backup:', backupError);
      }

      const isIOSBrowser = /iPad|iPhone|iPod/i.test(navigator.userAgent)
        || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      const shouldAutoDownloadBackup = !isIOSBrowser && !Capacitor.isNativePlatform();
      if (shouldAutoDownloadBackup) {
        const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'moldatk-backup-before-reset-' + new Date().toISOString().replace(/[:.]/g, '-') + '.json';
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      } else {
        console.info('Reset backup kept safely inside Moldatk; automatic file preview skipped on iOS/native app.');
      }

      // Freeze both push and pull before the server purge starts. The marker is
      // removed only after the local scoped cache is empty as well.
      localStorage.setItem(markerKey, '1');

      const { data: resetData, error: resetError } = await supabase.functions.invoke('generator-data-admin', {
        body: { action: 'reset_generator_data' },
      });
      if (resetError || !resetData?.ok) {
        throw new Error(resetData?.error || resetError?.message || 'تعذر تصفير البيانات السحابية');
      }

      const scopedSuffix = '_' + generatorId;
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i += 1) {
        const currentKey = localStorage.key(i);
        if (currentKey && currentKey.endsWith(scopedSuffix) && currentKey !== markerKey) keysToRemove.push(currentKey);
      }
      keysToRemove.forEach(currentKey => localStorage.removeItem(currentKey));

      setSubscribers([]);
      setMonthlyTariffs([]);
      setAuditLogs([]);
      setLines([]);
      setCollectors([]);
      setWalletResetTimestamp('');
      setGeneratorSpecs(prev => ({
        ...INITIAL_GENERATOR_SPECS,
        generatorName: prev.generatorName,
        ownerName: prev.ownerName,
        location: prev.location,
      }));
      setInvoiceTemplate(INITIAL_INVOICE_TEMPLATE);
      setSubscriberToEdit(null);
      setSelectedReceiptSubscriber(null);
      setSelectedReceiptInvoice(null);

      localStorage.removeItem(markerKey);
      window.dispatchEvent(new Event('moldatk-local-sync'));
      showToast('تم تصفير بيانات النظام سحابياً ومحلياً بالكامل وإنشاء نسخة احتياطية');
      window.setTimeout(() => window.location.reload(), 900);
      return { ok: true };
    } catch (e: any) {
      localStorage.removeItem(markerKey);
      console.error('Secure Moldatk reset failed:', e);
      return { ok: false, message: 'تعذر إكمال التصفير بأمان: ' + (e?.message || 'خطأ غير معروف') };
    }
  };`;

  source = replaceArrowHandler(source, 'handleSecureSystemReset', secureReset);

  const permanentSubscriberDelete = `  const handleDeleteSubscriberPermanent = async (subId: string) => {
    if (!subId) return;

    // Legacy local-only admin mode has no cloud account. Production generator
    // owners always use the protected permanent server purge below.
    if (userSession?.role === 'admin' && !userSession.generatorId) {
      setSubscribers(prev => {
        const updated = prev.filter(sub => sub.id !== subId);
        try { localStorage.setItem(getStorageKey('moldatk_subscribers'), JSON.stringify(updated)); } catch (e) {}
        return updated;
      });
      setIsSubscriberModalOpen(false);
      showToast('تم حذف المشترك محلياً');
      return;
    }

    if (userSession?.role !== 'generator_admin' || !userSession.generatorId) {
      showToast('حذف المشترك متاح لصاحب المولدة فقط');
      return;
    }

    const { data, error } = await supabase.functions.invoke('generator-data-admin', {
      body: { action: 'delete_subscriber', subscriber_id: subId },
    });
    if (error || !data?.ok) {
      showToast('تعذر حذف المشترك نهائياً: ' + (data?.error || error?.message || 'خطأ غير معروف'));
      return;
    }

    setSubscribers(prev => {
      const updated = prev.filter(sub => sub.id !== subId);
      try { localStorage.setItem(getStorageKey('moldatk_subscribers'), JSON.stringify(updated)); } catch (e) {}
      return updated;
    });
    setAuditLogs(prev => {
      const updated = prev.filter(log => log.entityId !== subId);
      try { localStorage.setItem(getStorageKey('moldatk_audit_logs'), JSON.stringify(updated)); } catch (e) {}
      return updated;
    });
    try {
      const tombstoneKey = getStorageKey('moldatk_deleted_subscribers');
      const deleted = JSON.parse(localStorage.getItem(tombstoneKey) || '[]') as string[];
      localStorage.setItem(tombstoneKey, JSON.stringify(deleted.filter(id => id !== subId)));
    } catch (e) {}

    if (subscriberToEdit?.id === subId) setSubscriberToEdit(null);
    if (selectedReceiptSubscriber?.id === subId) {
      setSelectedReceiptSubscriber(null);
      setSelectedReceiptInvoice(null);
      setIsReceiptModalOpen(false);
    }
    setIsSubscriberModalOpen(false);
    window.dispatchEvent(new Event('moldatk-local-sync'));
    showToast('تم حذف المشترك وجميع فواتيره وديونه وتسديداته نهائياً');
  };

`;

  if (!source.includes('const handleDeleteSubscriberPermanent = async (subId: string) =>')) {
    const insertion = source.indexOf('  const handleSaveSubscriber = (newSub: Subscriber) => {');
    must(insertion >= 0, 'handleSaveSubscriber insertion point missing');
    source = source.slice(0, insertion) + permanentSubscriberDelete + source.slice(insertion);
  }

  const replacedDeletes = replaceAllJsxPropExpressions(source, 'onDeleteSubscriber', 'handleDeleteSubscriberPermanent');
  source = replacedDeletes.source;
  must(replacedDeletes.count >= 3, `expected subscriber delete bindings, got ${replacedDeletes.count}`);

  must(source.includes("supabase.functions.invoke('generator-data-admin'"), 'generator data admin Edge Function is not wired');
  must(source.includes("action: 'reset_generator_data'"), 'cloud-authoritative owner reset missing');
  must(source.includes("action: 'delete_subscriber'"), 'permanent subscriber delete action missing');
  must(source.includes("localStorage.setItem(markerKey, '1')"), 'reset cloud-sync freeze marker missing');
  must(source.includes('moldatk_emergency_backup_last_'), 'emergency reset backup missing');
  write(path, source);
}

// -----------------------------------------------------------------------------
// Keep realtime cloud sync completely paused during a destructive factory reset.
// This prevents a stale local snapshot from being pushed back while the server is
// deleting data or between server completion and local-cache cleanup.
// -----------------------------------------------------------------------------
{
  const path = 'src/lib/useGeneratorCloudSync.ts';
  let source = read(path);
  const pushNeedle = "const resetInProgress = localStorage.getItem(key('moldatk_factory_reset_in_progress', generatorId)) === '1';";
  if (!source.includes(pushNeedle)) {
    source = source.replace(
      "    const push = async () => {\n      if (localStorage.getItem(key('moldatk_factory_reset_in_progress', generatorId)) === '1') return;",
      `    const push = async () => {\n      const resetInProgress = localStorage.getItem(key('moldatk_factory_reset_in_progress', generatorId)) === '1';\n      if (resetInProgress) return;`
    );
  }
  must(source.includes('moldatk_factory_reset_in_progress'), 'cloud sync reset guard missing');
  write(path, source);
}

// -----------------------------------------------------------------------------
// Super Admin delete means true purge: protected Edge Function removes database,
// auth and account-owned Storage objects instead of leaving SET NULL history.
// -----------------------------------------------------------------------------
{
  const path = 'src/components/SuperAdminDashboard.tsx';
  let source = read(path);
  const start = source.indexOf('  const deleteGeneratorAccount = async () =>');
  must(start >= 0, 'Super Admin delete handler missing');
  const nextHandler = source.indexOf('\n\n  const ', start + 20);
  const end = nextHandler >= 0 ? nextHandler : source.length;
  let block = source.slice(start, end);
  block = block.replace("supabase.functions.invoke('manage-generator-account'", "supabase.functions.invoke('purge-generator-account'");
  must(block.includes("supabase.functions.invoke('purge-generator-account'"), 'permanent generator purge Edge Function not wired');
  block = block.replace("action: 'delete_account',\n", '');
  source = source.slice(0, start) + block + source.slice(end);
  source = source.replace(
    "setMessage('تم حذف حساب صاحب المولدة وجميع بياناته التشغيلية المرتبطة بنجاح.');",
    "setMessage('تم حذف حساب صاحب المولدة نهائياً مع بياناته وحسابات الدخول والملفات المرتبطة.');"
  );
  write(path, source);
}

// -----------------------------------------------------------------------------
// Absolute final Android/PWA release version. Earlier legacy compatibility passes
// may temporarily downgrade markers; this is intentionally the final release pass.
// -----------------------------------------------------------------------------
{
  const gradlePath = 'android/app/build.gradle';
  let gradle = read(gradlePath);
  gradle = gradle.replace(/versionCode\s+\d+/, 'versionCode 32');
  gradle = gradle.replace(/versionName\s+"[^"]+"/, 'versionName "1.3.28"');
  write(gradlePath, gradle);

  for (const path of ['public/sw.js', 'src/main.tsx']) {
    let source = read(path);
    source = source.replace(/1\.3\.(?:18|19|20|21|22|23|24|25|26|27|28)/g, '1.3.28');
    write(path, source);
  }

  write('public/app-version.json', JSON.stringify({
    enabled: true,
    versionCode: 32,
    versionName: '1.3.28',
    minimumVersionCode: 32,
    force: true,
    apkUrl: 'https://github.com/sajjadad589-art/moldatk.v2/releases/download/v1.3.28/Moldatk-Android-Release.apk',
    notes: 'تحديث إلزامي 1.3.28: تصفير سحابي دائم، حذف كامل للمشترك وصاحب المولدة، ومنع رجوع البيانات بعد إعادة التحميل.'
  }, null, 2) + '\n');

  must(read(gradlePath).includes('versionCode 32'), 'Android versionCode 32 missing');
  must(read(gradlePath).includes('versionName "1.3.28"'), 'Android versionName 1.3.28 missing');
  must(read('public/sw.js').includes('1.3.28'), 'service worker 1.3.28 marker missing');
  must(read('src/main.tsx').includes('/sw.js?v=1.3.28'), 'service worker registration 1.3.28 missing');
}

console.log('Permanent data purge finalization passed: owner reset and subscriber deletion are server-authoritative, generator deletion purges database/auth/storage, and release 1.3.28 is aligned.');
