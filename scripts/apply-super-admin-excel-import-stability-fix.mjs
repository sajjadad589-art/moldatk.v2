import fs from 'node:fs';

const p = 'src/components/SuperAdminDashboard.tsx';
if (!fs.existsSync(p)) {
  console.log('SuperAdminDashboard.tsx not found; skipping Excel import patch');
  process.exit(0);
}

let c = fs.readFileSync(p, 'utf8');

if (c.includes('SUPER_ADMIN_EXCEL_IMPORT_STABILITY_V4')) {
  console.log('Super Admin Excel import stability/cabinet auto-link already applied.');
  process.exit(0);
}

const start = c.indexOf('  const importSubscribersFromExcel = async (e: React.FormEvent) => {');
const end = c.indexOf('  const sendNotification = async (e: React.FormEvent) => {', start);

if (start === -1 || end === -1) {
  console.warn('Excel import handler markers not found; skipping Excel import patch.');
  process.exit(0);
}

const stableHandler = String.raw`  // SUPER_ADMIN_EXCEL_IMPORT_STABILITY_V4
  const importSubscribersFromExcel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!excelImportForm.generator_id) return setMessage('اختر حساب صاحب المولدة قبل الرفع');
    if (!excelImportForm.file) return setMessage('اختر ملف Excel أولاً');

    const idle = () => new Promise<void>(resolve => setTimeout(resolve, 0));
    const normalizePhoneKey = (value: unknown) => normalizeText(value)
      .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
      .replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
      .replace(/\D/g, '');
    const normalizeLineKey = (value: unknown) => normalizeText(value)
      .replace(/[ً-ْ]/g, '')
      .replace(/[أإآ]/g, 'ا')
      .replace(/ة/g, 'ه')
      .replace(/ى/g, 'ي')
      .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
      .replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
      .replace(/[ـ_\-.\/\:،,()\[\]]/g, '')
      .replace(/\s+/g, '')
      .toLowerCase();
    const cellValue = (sheet: XLSX.WorkSheet, rowIndex: number, colIndex: number) => {
      const cell = sheet[XLSX.utils.encode_cell({ r: rowIndex, c: colIndex })];
      return cell?.w ?? cell?.v ?? '';
    };

    setExcelImporting(true);
    setExcelImportProgress(3);
    setExcelImportReport({ ...EMPTY_EXCEL_REPORT, status: 'processing', title: 'جاري تجهيز ملف Excel...', fileName: excelImportForm.file.name });
    setMessage(null);

    try {
      const generator = generators.find(g => g.id === excelImportForm.generator_id);
      await idle();
      const buffer = await excelImportForm.file.arrayBuffer();
      setExcelImportProgress(10);
      setExcelImportReport(prev => ({ ...prev, title: 'جاري قراءة المصنف بدون تجميد الصفحة...' }));
      await idle();

      const workbook = XLSX.read(buffer, { type: 'array', cellDates: true, cellNF: false, cellStyles: false, WTF: false });
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) throw new Error('ملف Excel فارغ');
      const sheet = workbook.Sheets[firstSheetName];
      const ref = sheet['!ref'];
      if (!ref) throw new Error('لا توجد بيانات مشتركين داخل الملف');
      const range = XLSX.utils.decode_range(ref);

      const headers = Array.from({ length: range.e.c - range.s.c + 1 }, (_, index) => normalizeText(cellValue(sheet, range.s.r, range.s.c + index)));
      const visibleHeaders = headers.filter(Boolean);
      const totalColumns = visibleHeaders.length;
      const unmappedColumns = visibleHeaders.filter(h => !knownHeaderSet.has(normalizeHeader(h)));
      const mappedColumns = Math.max(0, totalColumns - unmappedColumns.length);
      const headerIndexByField: Record<string, number> = {};
      for (const field of Object.keys(EXCEL_FIELD_ALIASES)) {
        const wanted = EXCEL_FIELD_ALIASES[field].map(normalizeHeader);
        const found = headers.findIndex(h => wanted.includes(normalizeHeader(h)));
        if (found >= 0) headerIndexByField[field] = range.s.c + found;
      }
      const readField = (rowIndex: number, field: string) => {
        const colIndex = headerIndexByField[field];
        return typeof colIndex === 'number' ? cellValue(sheet, rowIndex, colIndex) : '';
      };
      const readAny = (rowIndex: number, aliases: string[]) => {
        const wanted = aliases.map(normalizeHeader);
        const found = headers.findIndex(h => wanted.includes(normalizeHeader(h)));
        return found >= 0 ? cellValue(sheet, rowIndex, range.s.c + found) : '';
      };
      const readCabinetName = (rowIndex: number) => {
        const explicitCabinet = normalizeText(readAny(rowIndex, ['الكابينة', 'كابينة', 'البورد', 'البورد/الكابينة', 'اسم الكابينة', 'cabinet', 'board']));
        const line = normalizeText(readField(rowIndex, 'line'));
        const box = normalizeText(readField(rowIndex, 'boxNumber'));
        return explicitCabinet || line || box;
      };

      const dataStartRow = range.s.r + 1;
      const totalRows = Math.max(0, range.e.r - dataStartRow + 1);
      if (!totalRows) throw new Error('لا توجد بيانات مشتركين داخل الملف');

      setExcelImportProgress(20);
      setExcelImportReport({ ...EMPTY_EXCEL_REPORT, status: 'processing', title: 'تمت قراءة الملف، جاري إنشاء الكابينات وربط المشتركين...', generatorName: generator?.name || excelImportForm.generator_id, fileName: excelImportForm.file.name, totalRows, totalColumns, mappedColumns, unmappedColumns, cellsRead: 0 });
      await idle();

      const subscribersKey = scopedKey('moldatk_subscribers', excelImportForm.generator_id);
      const tariffsKey = scopedKey('moldatk_monthly_tariffs', excelImportForm.generator_id);
      const linesKey = scopedKey('moldatk_lines', excelImportForm.generator_id);
      const auditKey = scopedKey('moldatk_audit_logs', excelImportForm.generator_id);
      const generatorKey = scopedKey('moldatk_generator', excelImportForm.generator_id);
      const existing = readJson<Subscriber[]>(subscribersKey, []);
      const tariffs = readJson<MonthlyTariffRecord[]>(tariffsKey, INITIAL_MONTHLY_TARIFFS);
      const activeTariff = tariffs.find(t => t.isCurrentActive) || tariffs[0] || INITIAL_MONTHLY_TARIFFS[0];
      const lines = readJson<LineDistribution[]>(linesKey, []);
      const imported: Subscriber[] = [];
      const warnings: string[] = [];
      const errors: string[] = [];
      const createdCabinets: string[] = [];
      const now = new Date().toISOString();
      const usedPhones = new Set(existing.map(s => normalizePhoneKey(s.phone)).filter(Boolean));
      const usedCodes = new Set(existing.map(s => s.code || s.subscriberCode).filter(Boolean));
      const lineByKey = new Map<string, LineDistribution>();
      const registerLine = (line: LineDistribution) => {
        [line.id, line.name, line.zone, (line as any).lineName].filter(Boolean).forEach(value => {
          const key = normalizeLineKey(value);
          if (key && !lineByKey.has(key)) lineByKey.set(key, line);
        });
      };
      lines.forEach(registerLine);
      const ensureCabinet = (rawName: string): LineDistribution | null => {
        const name = normalizeText(rawName);
        if (!name) return null;
        const key = normalizeLineKey(name);
        const found = lineByKey.get(key);
        if (found) return found;
        const nextIndex = lines.length + 1;
        const phaseTypes = ['phase-R', 'phase-S', 'phase-T', '3-phase'];
        const phaseType = phaseTypes[(nextIndex - 1) % phaseTypes.length];
        const newLine = {
          id: 'excel-line-' + Date.now() + '-' + nextIndex + '-' + (normalizeLineKey(name).slice(0, 24) || 'cabinet' + nextIndex),
          name,
          zone: name,
          phaseType,
          phaseNameAr: phaseType === 'phase-R' ? 'فيز R (الأحمر) - 380V' : phaseType === 'phase-S' ? 'فيز S (الأصفر) - 380V' : phaseType === 'phase-T' ? 'فيز T (الأزرق) - 380V' : 'ثلاثي الفيز (3-Phase)',
          maxCapacityAmperes: 200,
          currentLoadAmperes: 0,
          subscribersCount: 0,
          technicianName: '',
          breakerNumber: 'Q' + nextIndex + '-250A',
        } as any as LineDistribution;
        lines.push(newLine);
        registerLine(newLine);
        createdCabinets.push(name);
        return newLine;
      };

      let skippedRows = 0;
      let cellsRead = 0;
      let cellsImported = 0;
      let rowsWithoutCabinet = 0;
      for (let rowIndex = dataStartRow; rowIndex <= range.e.r; rowIndex += 1) {
        try {
          const rowValues = Array.from({ length: range.e.c - range.s.c + 1 }, (_, index) => cellValue(sheet, rowIndex, range.s.c + index));
          if (!rowValues.some(v => !isEmptyCell(v))) { skippedRows += 1; continue; }
          cellsRead += rowValues.filter(v => !isEmptyCell(v)).length;
          const fullName = normalizeText(readField(rowIndex, 'fullName'));
          const phone = normalizeText(readField(rowIndex, 'phone'));
          const phoneKey = normalizePhoneKey(phone);
          if (!fullName && !phone) { skippedRows += 1; warnings.push('السطر ' + (rowIndex + 1) + ': لم يتم رفعه لأن اسم المشترك ورقم الهاتف فارغين.'); continue; }
          if (phoneKey && usedPhones.has(phoneKey)) { skippedRows += 1; warnings.push('السطر ' + (rowIndex + 1) + ': لم يتم رفعه لأن رقم الهاتف مكرر (' + phone + ').'); continue; }
          if (phoneKey) usedPhones.add(phoneKey);

          const tier = parseTier(readField(rowIndex, 'tier'));
          const amperes = Math.max(0, toNumber(readField(rowIndex, 'amperes')) || 1);
          const calc = calculateSubscriberBill(amperes, tier, activeTariff?.tiers || []);
          const paid = toNumber(readField(rowIndex, 'amountPaid'));
          const explicitDue = toNumber(readField(rowIndex, 'amountDue'));
          const total = explicitDue > 0 ? explicitDue + paid : calc.total;
          const paymentStatus = parsePaymentStatus(readField(rowIndex, 'paymentStatus'), paid, total);
          const cabinetName = readCabinetName(rowIndex);
          const cabinet = ensureCabinet(cabinetName);
          if (!cabinet) { rowsWithoutCabinet += 1; if (rowsWithoutCabinet <= 20) warnings.push('السطر ' + (rowIndex + 1) + ': لا يحتوي اسم كابينة/خط، تم رفع المشترك بدون ربط كابينة.'); }

          const givenCode = normalizeText(readField(rowIndex, 'code'));
          let code = givenCode && !usedCodes.has(givenCode) ? givenCode : generateImportCode(excelImportForm.generator_id, [...existing, ...imported]);
          while (usedCodes.has(code)) code = generateImportCode(excelImportForm.generator_id, [...existing, ...imported]);
          usedCodes.add(code);
          const dueAmount = paymentStatus === 'free' || tier === 'free' ? 0 : Math.max(total - paid, 0);
          const subscriber: Subscriber = {
            id: (crypto as any)?.randomUUID?.() || 'sub-' + Date.now() + '-' + Math.random().toString(16).slice(2),
            code,
            subscriberCode: code,
            fullName: fullName || 'مشترك ' + (existing.length + imported.length + 1),
            phone,
            tier,
            amperes,
            lineId: cabinet?.id,
            lineName: cabinet?.name || cabinetName || '',
            line: cabinet?.name || cabinetName || '',
            address: normalizeText(readField(rowIndex, 'address')),
            boxNumber: normalizeText(readField(rowIndex, 'boxNumber')),
            paymentStatus,
            lastPaymentDate: normalizeText(readAny(rowIndex, ['تاريخ آخر دفع', 'تاريخ التسديد', 'lastPaymentDate', 'paymentDate'])) || undefined,
            amountDue: dueAmount,
            amountPaid: paymentStatus === 'free' ? 0 : paid,
            notes: normalizeText(readField(rowIndex, 'notes')),
            isExempted: paymentStatus === 'free' || tier === 'free',
            exemptReason: paymentStatus === 'free' || tier === 'free' ? normalizeText(readField(rowIndex, 'exemptReason')) || 'استيراد من Excel' : undefined,
            invoicesHistory: [],
            createdAt: now,
            joiningDate: normalizeText(readField(rowIndex, 'joiningDate')) || now.slice(0, 10),
          };
          imported.push(subscriber);
          cellsImported += 13;
        } catch (rowErr: any) {
          skippedRows += 1;
          errors.push('السطر ' + (rowIndex + 1) + ': ' + (rowErr?.message || 'تعذر قراءة السطر'));
        }
        const doneRows = rowIndex - dataStartRow + 1;
        if (doneRows % 25 === 0 || rowIndex === range.e.r) {
          const progress = 20 + Math.round((doneRows / Math.max(totalRows, 1)) * 65);
          setExcelImportProgress(Math.min(progress, 88));
          setExcelImportReport(prev => ({ ...prev, title: 'جاري تحويل البيانات وربط الكابينات... ' + Math.min(doneRows, totalRows) + ' / ' + totalRows, totalRows, importedRows: imported.length, skippedRows, cellsRead, cellsImported, warnings: warnings.slice(-30), errors: errors.slice(-30) }));
          await idle();
        }
      }

      if (!imported.length) throw new Error('لم يتم رفع أي مشترك. تأكد من وجود عمود اسم المشترك أو رقم الهاتف وعدم تكرار الأرقام.');
      const nextSubscribers = [...existing, ...imported];
      const lineStats = new Map<string, { count: number; amps: number }>();
      nextSubscribers.forEach(sub => {
        if (!sub.lineId) return;
        const prev = lineStats.get(sub.lineId) || { count: 0, amps: 0 };
        prev.count += 1;
        prev.amps += Number(sub.amperes || 0);
        lineStats.set(sub.lineId, prev);
      });
      const nextLines = lines.map(line => {
        const stats = lineStats.get(line.id) || { count: 0, amps: 0 };
        return { ...line, subscribersCount: stats.count, currentLoadAmperes: stats.amps };
      });
      setExcelImportProgress(92);
      setExcelImportReport(prev => ({ ...prev, title: 'جاري حفظ المشتركين والكابينات داخل حساب صاحب المولدة...' }));
      await idle();
      try {
        localStorage.setItem(subscribersKey, JSON.stringify(nextSubscribers));
        localStorage.setItem(linesKey, JSON.stringify(nextLines));
      } catch (storageError) {
        throw new Error('حجم ملف Excel كبير جداً على تخزين المتصفح. قسّم الملف إلى دفعات أصغر ثم ارفعه من جديد.');
      }
      if (generator) {
        const oldGenerator = readJson<any>(generatorKey, {});
        localStorage.setItem(generatorKey, JSON.stringify({ ...oldGenerator, generatorName: generator.name, ownerName: generator.owner_name, phone: generator.phone || oldGenerator.phone || '', area: generator.area || oldGenerator.area || '' }));
      }
      localStorage.setItem(auditKey, JSON.stringify([{ id: 'audit-' + Date.now(), timestamp: now, category: 'subscriber', title: 'رفع مشتركين من Excel عبر السوبر أدمن', details: 'تم رفع ' + imported.length + ' مشترك، وإنشاء ' + createdCabinets.length + ' كابينة، وتخطي ' + skippedRows + ' سطر.', entityName: generator?.name || excelImportForm.generator_id, actorName: 'Super Admin' }, ...readJson<any[]>(auditKey, [])]));
      setExcelImportProgress(100);
      setExcelImportReport({ status: 'success', title: 'تم رفع ملف Excel وربط الكابينات بنجاح', generatorName: generator?.name || excelImportForm.generator_id, fileName: excelImportForm.file.name, totalRows, importedRows: imported.length, skippedRows, totalColumns, mappedColumns, unmappedColumns, cellsRead, cellsImported, warnings: createdCabinets.length ? ['تم إنشاء الكابينات الجديدة: ' + createdCabinets.join('، '), ...warnings] : warnings, errors });
      window.dispatchEvent(new Event('moldatk-local-sync'));
      setMessage('تم رفع ' + imported.length + ' مشترك وربطهم بالكابينات بنجاح — تم إنشاء ' + createdCabinets.length + ' كابينة وتخطي ' + skippedRows + ' سطر.');
    } catch (err: any) {
      const errorMessage = err?.message || 'خطأ غير معروف';
      setExcelImportProgress(100);
      setExcelImportReport(prev => ({ ...prev, status: 'error', title: 'فشل رفع ملف Excel', errors: [...prev.errors, errorMessage] }));
      setMessage('تعذر رفع ملف Excel: ' + errorMessage);
    } finally {
      setExcelImporting(false);
    }
  };

`;

c = c.slice(0, start) + stableHandler + c.slice(end);
fs.writeFileSync(p, c);
console.log('Applied stable Super Admin Excel import with automatic cabinet creation/linking v4');
