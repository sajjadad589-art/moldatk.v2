import fs from 'node:fs';

const p = 'src/components/SuperAdminDashboard.tsx';
if (!fs.existsSync(p)) {
  console.log('SuperAdminDashboard.tsx not found; skipping Excel import patch');
  process.exit(0);
}

let c = fs.readFileSync(p, 'utf8');

if (c.includes('SUPER_ADMIN_EXCEL_IMPORT_CLOUD_V5')) {
  console.log('Super Admin cloud Excel import already applied.');
  process.exit(0);
}

const start = c.indexOf('  const importSubscribersFromExcel = async (e: React.FormEvent) => {');
const end = c.indexOf('  const sendNotification = async (e: React.FormEvent) => {', start);

if (start === -1 || end === -1) {
  console.warn('Excel import handler markers not found; skipping Excel import patch.');
  process.exit(0);
}

const cloudHandler = String.raw`  // SUPER_ADMIN_EXCEL_IMPORT_CLOUD_V5
  const importSubscribersFromExcel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!excelImportForm.generator_id) return setMessage('اختر حساب صاحب المولدة قبل الرفع');
    if (!excelImportForm.file) return setMessage('اختر ملف Excel أولاً');

    const idle = () => new Promise<void>(resolve => setTimeout(resolve, 0));
    const cellValue = (sheet: XLSX.WorkSheet, rowIndex: number, colIndex: number) => {
      const cell = sheet[XLSX.utils.encode_cell({ r: rowIndex, c: colIndex })];
      return cell?.w ?? cell?.v ?? '';
    };
    const normalizeImportPhone = (value: unknown) => {
      const raw = normalizeText(value)
        .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
        .replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
      const digits = raw.replace(/\D/g, '');
      if (/^7\d{9}$/.test(digits)) return '0' + digits;
      return raw;
    };
    const toNullableNumber = (value: unknown) => isEmptyCell(value) ? null : toNumber(value);
    const toDateValue = (value: unknown) => {
      if (value instanceof Date && !Number.isNaN(value.getTime())) {
        const yyyy = value.getFullYear();
        const mm = String(value.getMonth() + 1).padStart(2, '0');
        const dd = String(value.getDate()).padStart(2, '0');
        return yyyy + '-' + mm + '-' + dd;
      }
      const raw = normalizeText(value);
      if (!raw) return null;
      const iso = raw.match(/^(\d{4})[-\/]([01]?\d)[-\/]([0-3]?\d)/);
      if (iso) return iso[1] + '-' + String(Number(iso[2])).padStart(2, '0') + '-' + String(Number(iso[3])).padStart(2, '0');
      const parsed = new Date(raw);
      if (Number.isNaN(parsed.getTime())) return null;
      return parsed.getFullYear() + '-' + String(parsed.getMonth() + 1).padStart(2, '0') + '-' + String(parsed.getDate()).padStart(2, '0');
    };
    const explicitPaymentStatus = (value: unknown): PaymentStatus | null => {
      const raw = normalizeText(value).toLowerCase();
      if (!raw) return null;
      if (raw.includes('مجاني') || raw.includes('معفي') || raw.includes('free')) return 'free';
      if (raw.includes('جزئي') || raw.includes('partial')) return 'partial';
      if (raw.includes('مسدد') || raw.includes('مدفوع') || raw.includes('paid')) return 'paid';
      if (raw.includes('غير') || raw.includes('unpaid')) return 'unpaid';
      return null;
    };
    const isTruthyExcel = (value: unknown) => {
      const raw = normalizeText(value).toLowerCase();
      return ['1', 'true', 'yes', 'y', 'نعم', 'معفي', 'مجاني'].includes(raw);
    };

    setExcelImporting(true);
    setExcelImportProgress(3);
    setExcelImportReport({ ...EMPTY_EXCEL_REPORT, status: 'processing', title: 'جاري تجهيز ملف Excel...', fileName: excelImportForm.file.name });
    setMessage(null);

    try {
      const generator = generators.find(g => g.id === excelImportForm.generator_id);
      const buffer = await excelImportForm.file.arrayBuffer();
      setExcelImportProgress(10);
      await idle();

      const workbook = XLSX.read(buffer, { type: 'array', cellDates: true, cellNF: false, cellStyles: false, WTF: false });
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) throw new Error('ملف Excel فارغ');
      const sheet = workbook.Sheets[firstSheetName];
      const ref = sheet['!ref'];
      if (!ref) throw new Error('لا توجد بيانات مشتركين داخل الملف');
      const range = XLSX.utils.decode_range(ref);

      const headers = Array.from({ length: range.e.c - range.s.c + 1 }, (_, index) => normalizeText(cellValue(sheet, range.s.r, range.s.c + index)));
      const extraKnownHeaders = [
        'الاسم الكامل', 'اسم الكابينة', 'رقم الجوزة / الصندوق', 'المبلغ المطلوب', 'المبلغ المسدد',
        'آخر تاريخ تسديد', 'معفي؟', 'سبب الإعفاء', 'تاريخ الانضمام'
      ].map(normalizeHeader);
      const importKnownHeaderSet = new Set([...knownHeaderSet, ...extraKnownHeaders]);
      const visibleHeaders = headers.filter(Boolean);
      const totalColumns = visibleHeaders.length;
      const unmappedColumns = visibleHeaders.filter(h => !importKnownHeaderSet.has(normalizeHeader(h)));
      const mappedColumns = Math.max(0, totalColumns - unmappedColumns.length);
      const readAny = (rowIndex: number, aliases: string[]) => {
        const wanted = aliases.map(normalizeHeader);
        const found = headers.findIndex(h => wanted.includes(normalizeHeader(h)));
        return found >= 0 ? cellValue(sheet, rowIndex, range.s.c + found) : '';
      };

      const dataStartRow = range.s.r + 1;
      const totalRows = Math.max(0, range.e.r - dataStartRow + 1);
      if (!totalRows) throw new Error('لا توجد بيانات مشتركين داخل الملف');

      setExcelImportProgress(18);
      setExcelImportReport({
        ...EMPTY_EXCEL_REPORT,
        status: 'processing',
        title: 'تمت قراءة الملف، جاري تجهيز البيانات للرفع السحابي...',
        generatorName: generator?.name || excelImportForm.generator_id,
        fileName: excelImportForm.file.name,
        totalRows,
        totalColumns,
        mappedColumns,
        unmappedColumns,
      });
      await idle();

      const rows: any[] = [];
      const parserWarnings: string[] = [];
      let parserSkipped = 0;
      let cellsRead = 0;

      for (let rowIndex = dataStartRow; rowIndex <= range.e.r; rowIndex += 1) {
        const rowValues = Array.from({ length: range.e.c - range.s.c + 1 }, (_, index) => cellValue(sheet, rowIndex, range.s.c + index));
        if (!rowValues.some(v => !isEmptyCell(v))) {
          parserSkipped += 1;
          continue;
        }
        cellsRead += rowValues.filter(v => !isEmptyCell(v)).length;

        const fullName = normalizeText(readAny(rowIndex, ['الاسم الكامل', 'اسم المشترك', 'اسم المشترك الكامل', 'الاسم', 'اسم الزبون', 'اسم العميل', 'المشترك', 'المستهلك', 'fullName', 'name', 'subscriberName']));
        const phone = normalizeImportPhone(readAny(rowIndex, ['رقم الهاتف', 'الهاتف', 'رقم الموبايل', 'موبايل', 'الموبايل', 'رقم العميل', 'phone', 'mobile', 'mobileNumber']));
        if (!fullName && !phone) {
          parserSkipped += 1;
          parserWarnings.push('السطر ' + (rowIndex + 1) + ': الاسم ورقم الهاتف فارغان.');
          continue;
        }

        const tier = parseTier(readAny(rowIndex, ['نوع الاشتراك', 'نوع المشترك', 'الفئة', 'التصنيف', 'tier', 'type', 'subscriptionType']));
        const rawExempt = readAny(rowIndex, ['معفي؟', 'معفي', 'اعفاء', 'إعفاء', 'isExempted']);
        const isExempted = tier === 'free' || isTruthyExcel(rawExempt);
        const paidValue = readAny(rowIndex, ['المبلغ المسدد', 'المبلغ المدفوع', 'المدفوع', 'المسدد', 'الواصل', 'paid', 'amountPaid']);
        const dueValue = readAny(rowIndex, ['المبلغ المطلوب', 'المبلغ المستحق', 'المستحق', 'الدين', 'الباقي', 'remaining', 'due', 'amountDue']);

        rows.push({
          excel_row: rowIndex + 1,
          code: normalizeText(readAny(rowIndex, ['كود المشترك', 'الكود', 'رقم المشترك', 'رمز المشترك', 'code', 'subscriberCode'])),
          full_name: fullName,
          phone,
          tier,
          amperes: Math.max(0, toNumber(readAny(rowIndex, ['عدد الأمبيرات', 'عدد الامبيرات', 'الأمبير', 'الامبير', 'امبير', 'عدد الامبير', 'amperes', 'amps', 'amp'])) || 1),
          line_name: normalizeText(readAny(rowIndex, ['اسم الكابينة', 'الكابينة', 'كابينة', 'البورد', 'البورد/الكابينة', 'الخط', 'اسم الخط', 'خط', 'line', 'lineName', 'zone'])),
          address: normalizeText(readAny(rowIndex, ['العنوان', 'الموقع', 'الدار', 'عنوان السكن', 'address', 'location'])),
          box_number: normalizeText(readAny(rowIndex, ['رقم الجوزة / الصندوق', 'رقم الجوزة/الصندوق', 'رقم الصندوق', 'رقم الجوزة', 'الجوزة', 'boxNumber', 'box'])),
          payment_status: explicitPaymentStatus(readAny(rowIndex, ['حالة التسديد', 'حالة الدفع', 'الحالة', 'status', 'paymentStatus'])),
          amount_due: toNullableNumber(dueValue),
          amount_paid: toNullableNumber(paidValue) ?? 0,
          last_payment_date: toDateValue(readAny(rowIndex, ['آخر تاريخ تسديد', 'تاريخ آخر دفع', 'تاريخ التسديد', 'lastPaymentDate', 'paymentDate'])),
          is_exempted: isExempted,
          exempt_reason: normalizeText(readAny(rowIndex, ['سبب الإعفاء', 'سبب الاعفاء', 'سبب المجاني', 'exemptReason'])),
          notes: normalizeText(readAny(rowIndex, ['ملاحظات', 'ملاحظة', 'notes', 'note'])),
          joining_date: toDateValue(readAny(rowIndex, ['تاريخ الانضمام', 'تاريخ الاشتراك', 'joiningDate', 'createdAt'])),
        });

        const doneRows = rowIndex - dataStartRow + 1;
        if (doneRows % 30 === 0 || rowIndex === range.e.r) {
          const progress = 18 + Math.round((doneRows / Math.max(totalRows, 1)) * 47);
          setExcelImportProgress(Math.min(progress, 65));
          setExcelImportReport(prev => ({ ...prev, title: 'جاري قراءة وتجهيز السطور... ' + Math.min(doneRows, totalRows) + ' / ' + totalRows, cellsRead, skippedRows: parserSkipped }));
          await idle();
        }
      }

      if (!rows.length) throw new Error('لم يتم العثور على أي مشترك صالح داخل الملف');

      setExcelImportProgress(72);
      setExcelImportReport(prev => ({ ...prev, title: 'جاري رفع البيانات فعلياً إلى حساب صاحب المولدة في السحابة...', cellsRead, skippedRows: parserSkipped }));
      await idle();

      const { data: result, error: invokeError } = await supabase.functions.invoke('super-admin-import-subscribers', {
        body: { generator_id: excelImportForm.generator_id, rows },
      });
      if (invokeError) throw new Error((result as any)?.error || invokeError.message || 'فشل الاتصال بخدمة الرفع السحابي');
      if (!(result as any)?.ok) throw new Error((result as any)?.error || 'فشل حفظ المشتركين في السحابة');

      const importedCount = Number((result as any).imported_count || 0);
      const backendSkipped = Number((result as any).skipped_count || 0);
      const skippedRows = parserSkipped + backendSkipped;
      const createdCabinets = Array.isArray((result as any).created_cabinets) ? (result as any).created_cabinets : [];
      const backendWarnings = Array.isArray((result as any).warnings) ? (result as any).warnings : [];
      const warnings = [
        ...(createdCabinets.length ? ['تم إنشاء الكابينات الجديدة: ' + createdCabinets.join('، ')] : []),
        ...parserWarnings,
        ...backendWarnings,
      ].slice(0, 100);

      setExcelImportProgress(100);
      if (importedCount === 0) {
        setExcelImportReport({
          status: 'error',
          title: 'لم تتم إضافة أي مشترك جديد — جميع السطور مكررة أو غير صالحة',
          generatorName: (result as any).generator_name || generator?.name || excelImportForm.generator_id,
          fileName: excelImportForm.file.name,
          totalRows,
          importedRows: 0,
          skippedRows,
          totalColumns,
          mappedColumns,
          unmappedColumns,
          cellsRead,
          cellsImported: 0,
          warnings,
          errors: [],
        });
        setMessage('لم تتم إضافة أي مشترك جديد. تم تخطي ' + skippedRows + ' سطر، ومنها ' + Number((result as any).duplicate_names || 0) + ' اسم مطابق موجود مسبقاً.');
      } else {
        setExcelImportReport({
          status: 'success',
          title: 'تم رفع ملف Excel وحفظ المشتركين فعلياً في السحابة',
          generatorName: (result as any).generator_name || generator?.name || excelImportForm.generator_id,
          fileName: excelImportForm.file.name,
          totalRows,
          importedRows: importedCount,
          skippedRows,
          totalColumns,
          mappedColumns,
          unmappedColumns,
          cellsRead,
          cellsImported: importedCount * 13,
          warnings,
          errors: [],
        });
        setMessage('تم رفع ' + importedCount + ' مشترك فعلياً إلى حساب صاحب المولدة — تم تخطي ' + skippedRows + ' سطر، منها ' + Number((result as any).duplicate_names || 0) + ' اسم مطابق.');
      }

      window.dispatchEvent(new CustomEvent('moldatk-cloud-import-complete', { detail: { generatorId: excelImportForm.generator_id, importedCount } }));
      await load();
    } catch (err: any) {
      const errorMessage = err?.message || 'خطأ غير معروف';
      setExcelImportProgress(100);
      setExcelImportReport(prev => ({ ...prev, status: 'error', title: 'فشل رفع ملف Excel إلى السحابة', errors: [...prev.errors, errorMessage] }));
      setMessage('تعذر رفع ملف Excel: ' + errorMessage);
    } finally {
      setExcelImporting(false);
    }
  };

`;

c = c.slice(0, start) + cloudHandler + c.slice(end);
fs.writeFileSync(p, c);
console.log('Applied Super Admin cloud Excel import with exact-name duplicate protection v5');
