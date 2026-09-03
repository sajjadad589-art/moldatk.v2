import fs from 'node:fs';

const read = p => fs.readFileSync(p, 'utf8');
const write = (p, c) => fs.writeFileSync(p, c);

// Desktop reports: reuse the tested monthly reports engine/UI on wide screens.
{
  const p = 'src/App.tsx';
  let c = read(p);
  if (!c.includes("import { MobileMonthlyReports } from './components/mobile/MobileMonthlyReports';")) {
    c = c.replace(
      "import { MobileLayout } from './components/mobile/MobileLayout';",
      "import { MobileLayout } from './components/mobile/MobileLayout';\nimport { MobileMonthlyReports } from './components/mobile/MobileMonthlyReports';"
    );
  }

  if (!c.includes("activeTab === 'reports'")) {
    c = c.replace(
      "          {activeTab === 'wallet' && (",
      `          {activeTab === 'reports' && (\n            <div className=\"max-w-6xl mx-auto\">\n              <MobileMonthlyReports\n                subscribers={subscribers}\n                currency={generatorSpecs.currency}\n                monthlyTariffs={monthlyTariffs}\n              />\n            </div>\n          )}\n\n          {activeTab === 'wallet' && (`
    );
  }
  write(p, c);
}

// Add reports to the desktop sidebar (mobile has its own bottom navigation).
{
  const p = 'src/components/Sidebar.tsx';
  let c = read(p);
  if (!c.includes('FileBarChart2')) {
    c = c.replace('  Activity,', '  Activity,\n  FileBarChart2,');
  }
  if (!c.includes("id: 'reports'")) {
    c = c.replace(
      `    {\n      id: 'settings',\n      label: 'الإعدادات',`,
      `    {\n      id: 'reports',\n      label: 'التقارير',\n      icon: FileBarChart2,\n      badge: null,\n    },\n    {\n      id: 'settings',\n      label: 'الإعدادات',`
    );
  }
  write(p, c);
}

// Pricing editor: stable while open, fixed tier names, numeric months, immediate ledger activation.
{
  const p = 'src/components/PricingModal.tsx';
  let c = read(p);

  // Do not overwrite an open editor when realtime/local sync refreshes parent props.
  c = c.replace('  }, [isOpen, monthlyTariffs, pricingTiers]);', '  }, [isOpen]);');

  if (!c.includes('const fixedTierName =')) {
    const marker = "  useEffect(() => {";
    const helper = `  const fixedTierName = (type: string) => {\n    switch (type) {\n      case 'golden': return 'ذهبي';\n      case 'commercial': return 'محلات';\n      case 'free': return 'مجاني';\n      case 'normal':\n      default: return 'نهاري';\n    }\n  };\n\n  const numericMonthLabel = (month: number, year: number) => String(month) + '-' + String(year);\n\n  const normalizeTierNames = (tiers: SubscriptionTierPricing[]) =>\n    tiers.map(t => ({ ...t, nameAr: fixedTierName(t.type) }));\n\n`;
    c = c.replace(marker, helper + marker);
  } else if (!c.includes('const numericMonthLabel =')) {
    c = c.replace(
      '  const normalizeTierNames = (tiers: SubscriptionTierPricing[]) =>',
      "  const numericMonthLabel = (month: number, year: number) => String(month) + '-' + String(year);\n\n  const normalizeTierNames = (tiers: SubscriptionTierPricing[]) =>"
    );
  }

  // Existing months are shown numerically too; tier names are normalized every time the modal opens.
  c = c.replace(
    '        setTariffs(monthlyTariffs);',
    '        setTariffs(monthlyTariffs.map(month => ({ ...month, monthNameAr: numericMonthLabel(month.month, month.year), tiers: normalizeTierNames(month.tiers || []) })));'
  );
  c = c.replace(
    '        setTariffs(monthlyTariffs.map(month => ({ ...month, tiers: normalizeTierNames(month.tiers || []) })));',
    '        setTariffs(monthlyTariffs.map(month => ({ ...month, monthNameAr: numericMonthLabel(month.month, month.year), tiers: normalizeTierNames(month.tiers || []) })));'
  );

  c = c.replace(/          monthNameAr: 'شهر 8 \([^\n]*\)',/, '          monthNameAr: numericMonthLabel(8, 2026),');
  c = c.replace(
    '          tiers: pricingTiers.map(t => ({ ...t, fixedFee: 0 })),',
    '          tiers: normalizeTierNames(pricingTiers).map(t => ({ ...t, fixedFee: 0 })), '
  );

  c = c.replace(
    "    const baseTiers = currentTiers.map(t => ({ ...t, fixedFee: Number(t.fixedFee || 0), description: t.description || '' }));",
    "    const baseTiers = normalizeTierNames(currentTiers).map(t => ({ ...t, fixedFee: Number(t.fixedFee || 0), description: t.description || '' }));"
  );
  c = c.replace(
    "    const baseTiers = currentTiers.map(t => ({ ...t, fixedFee: 0, description: '' }));",
    "    const baseTiers = normalizeTierNames(currentTiers).map(t => ({ ...t, fixedFee: 0, description: '' }));"
  );

  // New month labels and the iOS/Android picker use 1..12 only, no month names.
  c = c.replace(/    const monthLabel = [^\n]*;/, '    const monthLabel = numericMonthLabel(newMonthNumber, newYearNumber);');
  c = c.replace(
    /\{monthNamesArabic\.map\(\(name, i\) => \(\s*<option key=\{i \+ 1\} value=\{i \+ 1\}>\s*\{name\}\s*<\/option>\s*\)\)\}/m,
    `{monthNamesArabic.map((name, i) => (\n                      <option key={i + 1} value={i + 1}>\n                        {i + 1}\n                      </option>\n                    ))}`
  );

  // Fixed category names: owner only enters the monthly amount.
  c = c.replace('disabled={!isEditable}\n                          value={tier.nameAr}\n                          onChange={e => handleNameChange(tier.id, e.target.value)}',
                'disabled={true}\n                          value={fixedTierName(tier.type)}\n                          readOnly');
  c = c.replace('{isEditable && (\n                <button\n                  onClick={handleAddNewTier}', '{false && isEditable && (\n                <button\n                  onClick={handleAddNewTier}');
  c = c.replace('{isEditable && currentTiers.length > 1 && (', '{false && isEditable && currentTiers.length > 1 && (');

  // The ledger finalizer persists a new month first; force full month activation here after all patches.
  c = c.replace(
    'onSaveMonthlyTariffs(updatedTariffs, monthId, false);',
    'onSaveMonthlyTariffs(updatedTariffs, monthId, true);'
  );
  if (!c.includes('onSaveMonthlyTariffs(updatedTariffs, monthId, true);')) {
    const createTail = '    setTariffs(updatedTariffs);\n    setSelectedMonthId(monthId);\n    setIsAddingNewMonth(false);';
    if (c.includes(createTail)) {
      c = c.replace(
        createTail,
        '    setTariffs(updatedTariffs);\n    setSelectedMonthId(monthId);\n    onSaveMonthlyTariffs(updatedTariffs, monthId, true);\n    setIsAddingNewMonth(false);'
      );
    } else {
      throw new Error('PricingModal: could not enforce immediate new-month activation');
    }
  }

  // Safe deletion of the active tariff only. Historical tariffs remain protected.
  const start = c.indexOf('  const handleDeleteMonth = (monthId: string) => {');
  const end = start >= 0 ? c.indexOf('\n\n  const handleSave =', start) : -1;
  if (start >= 0 && end > start) {
    const handler = `  const handleDeleteMonth = (monthId: string) => {\n    if (tariffs.length <= 1) {\n      window.alert('لا يمكن حذف آخر تسعيرة موجودة. أضف شهراً آخر أولاً.');\n      return;\n    }\n    const target = tariffs.find(m => m.id === monthId);\n    if (!target?.isCurrentActive) return;\n    if (!window.confirm('هل تريد مسح تسعيرة الشهر الحالي؟ لن يتم حذف الأشهر السابقة.')) return;\n\n    const remaining = tariffs.filter(m => m.id !== monthId);\n    const nextActive = [...remaining].sort((a, b) => b.id.localeCompare(a.id))[0];\n    const updated = remaining.map(m => ({ ...m, isCurrentActive: m.id === nextActive.id }));\n    setTariffs(updated);\n    setSelectedMonthId(nextActive.id);\n    onSaveMonthlyTariffs(updated, nextActive.id, false);\n  };`;
    c = c.slice(0, start) + handler + c.slice(end);
  }

  // Reuse the delete icon for the active month only; old history cannot be deleted accidentally.
  c = c.replace('{false && tariffs.length > 1 && !month.isCurrentActive && (', '{tariffs.length > 1 && month.isCurrentActive && (');
  c = c.replace('title="حذف هذا الشهر من السجل"', 'title="مسح تسعيرة الشهر الحالي"');

  write(p, c);
}

console.log('Applied desktop reports, numeric month picker, fixed tier names, stable editor, and immediate month ledger activation');
