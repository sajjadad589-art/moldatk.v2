import fs from 'node:fs';

const appFile = 'src/App.tsx';
if (fs.existsSync(appFile)) {
  let app = fs.readFileSync(appFile, 'utf8');
  if (!app.includes('collectorPermissions={userSession.collectorPermissions}')) {
    app = app.replace(
      "          collectorName={userSession.collectorName || 'جابي ميداني'}\n          collectors={collectors}",
      "          collectorName={userSession.collectorName || 'جابي ميداني'}\n          collectorPermissions={userSession.collectorPermissions}\n          assignedLineId={userSession.assignedLineId}\n          collectors={collectors}"
    );
  }
  fs.writeFileSync(appFile, app);
}

const cloudFile = 'src/lib/useGeneratorCloudSync.ts';
if (fs.existsSync(cloudFile)) {
  let cloud = fs.readFileSync(cloudFile, 'utf8');
  cloud = cloud.replace(
    "        await replaceMissingRows('generator_subscribers', generatorId, subscribers.map(s => s.id));",
    "        if (session?.role === 'generator_admin') await replaceMissingRows('generator_subscribers', generatorId, subscribers.map(s => s.id));"
  );
  cloud = cloud.replace(
    "        await replaceMissingRows('generator_invoices', generatorId, invoices.map(i => i.id));",
    "        if (session?.role === 'generator_admin') await replaceMissingRows('generator_invoices', generatorId, invoices.map(i => i.id));"
  );
  cloud = cloud.replace(
    "          const { error } = await supabase.from('generator_audit_logs').upsert(rows, { onConflict: 'generator_id,id' });",
    "          const { error } = await supabase.from('generator_audit_logs').upsert(rows, { onConflict: 'generator_id,id', ignoreDuplicates: session?.role === 'collector' });"
  );
  fs.writeFileSync(cloudFile, cloud);
}

const posFile = 'src/components/POSQuickView.tsx';
if (fs.existsSync(posFile)) {
  let pos = fs.readFileSync(posFile, 'utf8');

  pos = pos.replace(
    "import { Subscriber, SubscriptionTierPricing, GeneratorSpecs, Collector, SubscriberInvoice } from '../types';",
    "import { Subscriber, SubscriptionTierPricing, GeneratorSpecs, Collector, CollectorPermissions, SubscriberInvoice } from '../types';"
  );

  if (!pos.includes('collectorPermissions?: CollectorPermissions;')) {
    pos = pos.replace(
      "  collectorName: string;\n  collectors?: Collector[];",
      "  collectorName: string;\n  collectorPermissions?: CollectorPermissions;\n  assignedLineId?: string;\n  collectors?: Collector[];"
    );
  }

  if (!pos.includes('collectorPermissions,\n  assignedLineId,')) {
    pos = pos.replace(
      "  collectorName,\n  collectors = [],",
      "  collectorName,\n  collectorPermissions,\n  assignedLineId,\n  collectors = [],"
    );
  }

  if (!pos.includes('const permissions: CollectorPermissions =')) {
    pos = pos.replace(
      "  const effectiveCollectors: Collector[] = collectors.length > 0",
      "  const permissions: CollectorPermissions = {\n    canCollectPayments: true,\n    canCancelPayments: false,\n    canAddSubscribers: false,\n    canEditSubscribers: false,\n    canDeleteSubscribers: false,\n    canApplyFreeExemption: false,\n    canPrintReceipts: true,\n    canViewFinancialReports: false,\n    canAccessSystemSettings: false,\n    ...(collectorPermissions || {}),\n  };\n\n  const effectiveCollectors: Collector[] = collectors.length > 0"
    );
  }

  if (!pos.includes("if (data.method === 'unpaid' && !permissions.canCancelPayments)")) {
    pos = pos.replace(
      "  const handleConfirmPayment = (data: PaymentExecutionData) => {\n    const sub = subscribers.find(s => s.id === data.subscriberId);",
      "  const handleConfirmPayment = (data: PaymentExecutionData) => {\n    if (data.method === 'unpaid' && !permissions.canCancelPayments) return;\n    if (data.method === 'free' && !permissions.canApplyFreeExemption) return;\n    if (data.method !== 'unpaid' && data.method !== 'free' && !permissions.canCollectPayments) return;\n    const sub = subscribers.find(s => s.id === data.subscriberId);"
    );
  }

  if (!pos.includes("const cancellationTime = new Date().toISOString();")) {
    pos = pos.replace(
      /    if \(data\.method === 'unpaid'\) \{[\s\S]*?      setPaymentSubscriber\(null\);\n      return;\n    \}/,
      `    if (data.method === 'unpaid') {\n      const cancellationTime = new Date().toISOString();\n      let cancelledOne = false;\n      const invoicesHistory = (sub.invoicesHistory || []).map(invoice => {\n        if (!cancelledOne && (invoice.status === 'paid' || invoice.status === 'partial' || invoice.status === 'free')) {\n          cancelledOne = true;\n          return {\n            ...invoice,\n            status: 'cancelled' as const,\n            cancellationReason: data.cancellationReason || 'إلغاء التسديد',\n            cancelledAt: cancellationTime,\n            cancelledBy: data.collectorName || collectorName || 'المحاسب',\n          };\n        }\n        return invoice;\n      });\n      const updated: Subscriber = {\n        ...sub,\n        paymentStatus: 'unpaid',\n        amountPaid: 0,\n        amountDue: totalAmount,\n        invoicesHistory,\n      };\n      onSaveSubscriber(updated);\n      onAddAuditLog({\n        category: 'cancellation',\n        title: 'إلغاء تسديد',\n        details: \`إرجاع المشترك "\${sub.fullName}" (\${sub.code || sub.subscriberCode}) إلى غير مسدد\`,\n        entityId: sub.id,\n        entityName: \`\${sub.fullName} (\${sub.code || sub.subscriberCode})\`,\n        actorName: data.collectorName || collectorName || 'المحاسب',\n        cancellationReason: data.cancellationReason || 'إلغاء التسديد',\n      });\n      setPaymentSubscriber(null);\n      return;\n    }`
    );
  }

  pos = pos.replace(
    "    if (data.autoPrintReceipt) {",
    "    if (data.autoPrintReceipt && permissions.canPrintReceipts) {"
  );

  pos = pos.replace(
    "    if (selectedLineFilter !== 'all' && sub.lineId !== selectedLineFilter) return false;",
    "    if (assignedLineId && sub.lineId !== assignedLineId) return false;\n    if (selectedLineFilter !== 'all' && sub.lineId !== selectedLineFilter) return false;"
  );

  pos = pos.replace(
    "            {onOpenNewSubscriberModal && (",
    "            {onOpenNewSubscriberModal && permissions.canAddSubscribers && ("
  );

  pos = pos.replace(
    "                  onClick={() => setPaymentSubscriber(sub)}",
    "                  onClick={() => { if (permissions.canCollectPayments || permissions.canCancelPayments || permissions.canApplyFreeExemption) setPaymentSubscriber(sub); }}"
  );

  pos = pos.replace(
    "                        setPaymentSubscriber(sub);",
    "                        if (permissions.canCollectPayments || permissions.canCancelPayments || permissions.canApplyFreeExemption) setPaymentSubscriber(sub);"
  );

  fs.writeFileSync(posFile, pos);
}

console.log('Launch hardening applied');
