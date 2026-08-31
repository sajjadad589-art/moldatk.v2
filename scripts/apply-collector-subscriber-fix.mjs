import fs from 'node:fs';

// 1) الجابي الجديد يحصل افتراضياً على صلاحية إضافة المشتركين، مع بقاء إمكانية إلغائها من إعدادات الصلاحيات.
const folderFile = 'src/components/FolderDetailModal.tsx';
if (fs.existsSync(folderFile)) {
  let folder = fs.readFileSync(folderFile, 'utf8');
  folder = folder.replace(
    "        canCancelPayments: false,\n        canAddSubscribers: false,\n        canEditSubscribers: false,",
    "        canCancelPayments: false,\n        canAddSubscribers: true,\n        canEditSubscribers: false,"
  );
  fs.writeFileSync(folderFile, folder);
}

// 2) نموذج المشترك يحفظ الكابينة فعلياً بالـ id والاسم، ويحتفظ أيضاً بالعنوان ورقم الجوزة/الصندوق.
const subscriberFile = 'src/components/SubscriberModal.tsx';
if (fs.existsSync(subscriberFile)) {
  let modal = fs.readFileSync(subscriberFile, 'utf8');

  if (!modal.includes("const [address, setAddress]")) {
    modal = modal.replace(
      "  const [line, setLine] = useState<string>('');",
      "  const [line, setLine] = useState<string>('');\n  const [address, setAddress] = useState('');\n  const [boxNumber, setBoxNumber] = useState('');"
    );
  }

  modal = modal.replace(
    "      setLine(subscriberToEdit.lineName || lines[0]?.name || '');\n      setCustomAmount",
    "      setLine(subscriberToEdit.lineName || subscriberToEdit.line || lines[0]?.name || '');\n      setAddress(subscriberToEdit.address || '');\n      setBoxNumber(subscriberToEdit.boxNumber || '');\n      setCustomAmount"
  );
  modal = modal.replace(
    "      setLine(lines[0]?.name || '');\n      setCustomAmount",
    "      setLine(lines[0]?.name || '');\n      setAddress('');\n      setBoxNumber('');\n      setCustomAmount"
  );

  if (!modal.includes("const selectedLine = lines.find")) {
    modal = modal.replace(
      "    const updatedSubscriber: Subscriber = {",
      "    const selectedLine = lines.find(l => l.name === line) || lines[0];\n\n    const updatedSubscriber: Subscriber = {"
    );
  }

  modal = modal.replace(
    "      tier: tier as any,\n      lineName: line || lines[0]?.name || 'الخط الرئيسي',\n      notes:",
    "      tier: tier as any,\n      lineId: selectedLine?.id || subscriberToEdit?.lineId,\n      lineName: selectedLine?.name || line || 'الخط الرئيسي',\n      line: selectedLine?.name || line || 'الخط الرئيسي',\n      address: address.trim() || undefined,\n      boxNumber: boxNumber.trim() || undefined,\n      notes:"
  );

  if (!modal.includes('عنوان المشترك / المنطقة')) {
    const tierGrid = `            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">\n              <div className="space-y-1.5">\n                <label className="text-xs font-bold text-slate-600 dark:text-slate-300">فئة الاشتراك</label>`;
    const addressGrid = `            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">\n              <div className="space-y-1.5">\n                <label className="text-xs font-bold text-slate-600 dark:text-slate-300">عنوان المشترك / المنطقة</label>\n                <input\n                  type="text"\n                  disabled={!isEditing}\n                  value={address}\n                  onChange={e => setAddress(e.target.value)}\n                  placeholder="المنطقة، الشارع، أقرب نقطة دالة"\n                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-3 text-xs font-bold text-slate-900 dark:text-white disabled:opacity-70 focus:outline-none focus:border-blue-500"\n                />\n              </div>\n              <div className="space-y-1.5">\n                <label className="text-xs font-bold text-slate-600 dark:text-slate-300">رقم الجوزة / الصندوق</label>\n                <input\n                  type="text"\n                  disabled={!isEditing}\n                  value={boxNumber}\n                  onChange={e => setBoxNumber(e.target.value)}\n                  placeholder="مثال: 24"\n                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-3 text-xs font-bold text-slate-900 dark:text-white disabled:opacity-70 focus:outline-none focus:border-blue-500"\n                />\n              </div>\n            </div>\n\n${tierGrid}`;
    modal = modal.replace(tierGrid, addressGrid);
  }

  fs.writeFileSync(subscriberFile, modal);
}

// 3) إذا الجابي مربوط بكابينة/خط محدد، نموذج إضافة المشترك يعرض هذا الخط فقط.
const appFile = 'src/App.tsx';
if (fs.existsSync(appFile)) {
  let app = fs.readFileSync(appFile, 'utf8');
  app = app.replace(
    "          pricingTiers={pricingTiers}\n          lines={lines}\n          onSaveSubscriber={handleSaveSubscriber}\n          isReadOnlyAmperes={false}",
    "          pricingTiers={pricingTiers}\n          lines={userSession.assignedLineId ? lines.filter(l => l.id === userSession.assignedLineId) : lines}\n          onSaveSubscriber={handleSaveSubscriber}\n          isReadOnlyAmperes={false}"
  );
  fs.writeFileSync(appFile, app);
}

console.log('Collector add-subscriber workflow restored and linked to cabin/tier/details');
