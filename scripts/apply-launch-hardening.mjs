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

  pos = pos.replace(
    "          collectors={effectiveCollectors}\n          currency={generatorSpecs.currency || 'د.ع'}",
    "          collectors={effectiveCollectors}\n          currency={generatorSpecs.currency || 'د.ع'}"
  );

  fs.writeFileSync(posFile, pos);
}

console.log('Launch hardening applied');
