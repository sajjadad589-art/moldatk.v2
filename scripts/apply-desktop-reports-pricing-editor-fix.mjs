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

// Pricing editor: keep unsaved edits stable, fixed tier names, safe current-month deletion.
{
  const p = 'src/components/PricingModal.tsx';
  let c = read(p);

  // Do not overwrite an open editor when realtime/local sync refreshes parent props.
  c = c.replace('  }, [isOpen, monthlyTariffs, pricingTiers]);', '  }, [isOpen]);');

  if (!c.includes('const fixedTierName =')) {
    const marker = "  useEffect(() => {";
    const helper = `  const fixedTierName = (type: string) => {\n    switch (type) {\n      case 'golden': return 'ذهبي';\n      case 'commercial': return 'محلات';\n      case 'free': return 'مجاني';\n      case 'normal':\n      default: return 'نهاري';\n    }\n  };\n\n  const normalizeTierNames = (tiers: SubscriptionTierPricing[]) =>\n    tiers.map(t => ({ ...t, nameAr: fixedTierName(t.type) }));\n\n`;
    c = c.replace(marker, helper + marker);
  }

  c = c.replace(
    '        setTariffs(monthlyTariffs);',
    '        setTariffs(monthlyTariffs.map(month => ({ ...month, tiers: normalizeTierNames(month.tiers || []) })));'
  );
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

  // Fixed category names: owner only enters the monthly amount.
  c = c.replace('disabled={!isEditable}\n                          value={tier.nameAr}\n                          onChange={e => handleNameChange(tier.id, e.target.value)}',
                'disabled={true}\n                          value={fixedTierName(tier.type)}\n                          readOnly');
  c = c.replace('{isEditable && (\n                <button\n                  onClick={handleAddNewTier}', '{false && isEditable && (\n                <button\n                  onClick={handleAddNewTier}');
  c = c.replace('{isEditable && currentTiers.length > 1 && (', '{false && isEditable && currentTiers.length > 1 && (');

  // Safe deletion of the active tariff only. Accounting invoices/debts are intentionally untouched.
  const start = c.indexOf('  const handleDeleteMonth = (monthId: string) => {');
  const end = start >= 0 ? c.indexOf('\n\n  const handleSave =', start) : -1;
  if (start >= 0 && end > start) {
    const handler = `  const handleDeleteMonth = (monthId: string) => {\n    if (tariffs.length <= 1) {\n      window.alert('لا يمكن حذف آخر تسعيرة موجودة. أضف شهراً آخر أولاً.');\n      return;\n    }\n    const target = tariffs.find(m => m.id === monthId);\n    if (!target?.isCurrentActive) return;\n    if (!window.confirm('هل تريد مسح تسعيرة الشهر الحالي؟ لن يتم حذف ديون أو إيصالات المشتركين المحفوظة.')) return;\n\n    const remaining = tariffs.filter(m => m.id !== monthId);\n    const nextActive = [...remaining].sort((a, b) => b.id.localeCompare(a.id))[0];\n    const updated = remaining.map(m => ({ ...m, isCurrentActive: m.id === nextActive.id }));\n    setTariffs(updated);\n    setSelectedMonthId(nextActive.id);\n    onSaveMonthlyTariffs(updated, nextActive.id, false);\n  };`;
    c = c.slice(0, start) + handler + c.slice(end);
  }

  // The prior ledger patch intentionally hid historical deletion. Reuse that slot for active-month deletion.
  c = c.replace('{false && tariffs.length > 1 && !month.isCurrentActive && (', '{tariffs.length > 1 && month.isCurrentActive && (');
  c = c.replace('title="حذف هذا الشهر من السجل"', 'title="مسح تسعيرة الشهر الحالي"');

  write(p, c);
}

console.log('Applied desktop reports, stable pricing editor, fixed tier names, and current tariff deletion');
