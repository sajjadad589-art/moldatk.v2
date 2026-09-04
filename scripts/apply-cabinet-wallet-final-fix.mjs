import fs from 'node:fs';

const read = (p) => fs.readFileSync(p, 'utf8');
const write = (p, s) => fs.writeFileSync(p, s, 'utf8');
const must = (cond, msg) => { if (!cond) throw new Error(msg); };

const replaceOnce = (src, from, to, label) => {
  const next = src.replace(from, to);
  must(next !== src, `Patch failed: ${label}`);
  return next;
};

// 1) Make cabinet/line add, delete and edit persist immediately.
{
  const path = 'src/components/FolderDetailModal.tsx';
  let s = read(path);

  if (!s.includes('MOLDATK_CABINET_WALLET_FINAL_FIX')) {
    s = replaceOnce(
      s,
      `  // --- Line Handlers ---\n  const handleAddLine = () => {`,
      `  // MOLDATK_CABINET_WALLET_FINAL_FIX\n  const persistLinesImmediately = (nextLines: LineDistribution[]) => {\n    setCurrentLines(nextLines);\n    onUpdateLines(nextLines);\n    setSaved(true);\n    window.setTimeout(() => setSaved(false), 900);\n  };\n\n  // --- Line Handlers ---\n  const handleAddLine = () => {`,
      'inject persistLinesImmediately'
    );

    s = replaceOnce(
      s,
      `    setCurrentLines([...currentLines, newLine]);\n  };`,
      `    persistLinesImmediately([...currentLines, newLine]);\n  };`,
      'persist add line'
    );

    s = replaceOnce(
      s,
      `  const handleDeleteLine = (id: string) => {\n    if (currentLines.length <= 1) return;\n    setCurrentLines(currentLines.filter(l => l.id !== id));\n  };`,
      `  const handleDeleteLine = (id: string) => {\n    const nextLines = currentLines.filter(l => l.id !== id);\n    persistLinesImmediately(nextLines);\n  };`,
      'persist delete line and allow deleting the last cabinet'
    );

    s = replaceOnce(
      s,
      `  const handleUpdateLine = (id: string, updates: Partial<LineDistribution>) => {\n    setCurrentLines(prev =>\n      prev.map(l => (l.id === id ? { ...l, ...updates } : l))\n    );\n  };`,
      `  const handleUpdateLine = (id: string, updates: Partial<LineDistribution>) => {\n    setCurrentLines(prev => {\n      const nextLines = prev.map(l => (l.id === id ? { ...l, ...updates } : l));\n      onUpdateLines(nextLines);\n      setSaved(true);\n      window.setTimeout(() => setSaved(false), 900);\n      return nextLines;\n    });\n  };`,
      'persist update line'
    );
  }

  must(s.includes('persistLinesImmediately'), 'cabinet persistence helper missing');
  must(!s.includes('if (currentLines.length <= 1) return;'), 'old delete guard still exists');
  write(path, s);
}

// 2) Make App line updates save scoped data + broadcast sync in every settings modal path.
{
  const path = 'src/App.tsx';
  let s = read(path);

  const oldBlock = `        onUpdateLines={(newLines) => {\n          setLines(newLines);\n          localStorage.setItem(getStorageKey('moldatk_lines'), JSON.stringify(newLines));\n        }}`;
  const newBlock = `        onUpdateLines={(newLines) => {\n          const fixedLines = newLines.map(line => ({ ...line }));\n          setLines(fixedLines);\n          try {\n            localStorage.setItem(getStorageKey('moldatk_lines'), JSON.stringify(fixedLines));\n            localStorage.setItem(getStorageKey('moldatk_lines_updated_at'), new Date().toISOString());\n            window.dispatchEvent(new Event('moldatk-local-sync'));\n          } catch (e) {}\n        }}`;
  if (s.includes(oldBlock)) s = s.replace(oldBlock, newBlock);

  const oldBlock2 = `              onUpdateLines={newLines => {\n                setLines(newLines);\n                try {\n                  localStorage.setItem(getStorageKey('moldatk_lines'), JSON.stringify(newLines));\n                  window.dispatchEvent(new Event('moldatk-local-sync'));\n                } catch (e) {}\n              }}`;
  const newBlock2 = `              onUpdateLines={newLines => {\n                const fixedLines = newLines.map(line => ({ ...line }));\n                setLines(fixedLines);\n                try {\n                  localStorage.setItem(getStorageKey('moldatk_lines'), JSON.stringify(fixedLines));\n                  localStorage.setItem(getStorageKey('moldatk_lines_updated_at'), new Date().toISOString());\n                  window.dispatchEvent(new Event('moldatk-local-sync'));\n                } catch (e) {}\n              }}`;
  if (s.includes(oldBlock2)) s = s.replace(oldBlock2, newBlock2);

  must(s.includes('moldatk_lines_updated_at'), 'App line update timestamp missing');
  write(path, s);
}

// 3) Payment cancellation must subtract from wallet and mention subscriber in operation title.
{
  const path = 'src/components/POSQuickView.tsx';
  let s = read(path);

  if (!s.includes('MOLDATK_WALLET_CANCELLATION_AMOUNT_FIX')) {
    s = replaceOnce(
      s,
      `    if (data.method === 'unpaid') {\n      const updated: Subscriber = {\n        ...sub,\n        paymentStatus: 'unpaid',\n        amountPaid: 0,\n        amountDue: totalAmount,\n      };`,
      `    if (data.method === 'unpaid') {\n      // MOLDATK_WALLET_CANCELLATION_AMOUNT_FIX\n      const lastPaidInvoice = (sub.invoicesHistory || []).find(inv =>\n        inv.status === 'paid' || inv.status === 'partial'\n      );\n      const cancelledAmount = Number(lastPaidInvoice?.paidAmount || sub.amountPaid || data.amountPaid || 0);\n      let didCancelOneInvoice = false;\n      const nextInvoices = (sub.invoicesHistory || []).map(inv => {\n        if (!didCancelOneInvoice && (inv.status === 'paid' || inv.status === 'partial')) {\n          didCancelOneInvoice = true;\n          return {\n            ...inv,\n            status: 'cancelled' as const,\n            cancellationReason: data.cancellationReason || 'إلغاء تسديد',\n            cancelledAt: new Date().toISOString(),\n            cancelledBy: data.collectorName || collectorName || 'المحاسب',\n          };\n        }\n        return inv;\n      });\n      const updated: Subscriber = {\n        ...sub,\n        paymentStatus: 'unpaid',\n        amountPaid: 0,\n        amountDue: Math.max(totalAmount, Number(sub.amountDue || 0), cancelledAmount),\n        lastPaymentDate: undefined,\n        invoicesHistory: nextInvoices,\n      };`,
      'cancellation amount and invoice cancellation'
    );

    s = replaceOnce(
      s,
      `      onAddAuditLog({\n        category: 'cancellation',\n        title: 'إلغاء تسديد',\n        details: \`إرجاع المشترك "\${sub.fullName}" (\${sub.code || sub.subscriberCode}) إلى غير مسدد\`,\n        entityId: sub.id,\n        entityName: \`\${sub.fullName} (\${sub.code || sub.subscriberCode})\`,\n        actorName: data.collectorName || collectorName || 'المحاسب',\n        cancellationReason: data.cancellationReason,\n      });`,
      `      onAddAuditLog({\n        category: 'cancellation',\n        title: \`إلغاء تسديد - \${sub.fullName}\`,\n        details: \`تم إلغاء تسديد المشترك "\${sub.fullName}" (\${sub.code || sub.subscriberCode}) بمبلغ \${cancelledAmount.toLocaleString('en-US')} \${generatorSpecs.currency || 'د.ع'} وإرجاعه إلى غير مسدد\`,\n        entityId: sub.id,\n        entityName: \`\${sub.fullName} (\${sub.code || sub.subscriberCode})\`,\n        actorName: data.collectorName || collectorName || 'المحاسب',\n        cancellationReason: data.cancellationReason,\n        amount: cancelledAmount,\n      });`,
      'cancellation audit amount and subscriber name'
    );

    s = replaceOnce(
      s,
      `      title: status === 'paid' ? 'تسديد كامل' : status === 'partial' ? 'تسديد جزئي' : 'إعفاء مجاني',`,
      `      title: status === 'paid' ? \`تسديد كامل - \${sub.fullName}\` : status === 'partial' ? \`تسديد جزئي - \${sub.fullName}\` : \`إعفاء مجاني - \${sub.fullName}\`,`,
      'payment title includes subscriber name'
    );
  }

  must(s.includes('cancelledAmount'), 'cancellation amount missing');
  must(s.includes('إلغاء تسديد - ${sub.fullName}') || s.includes('إلغاء تسديد -'), 'cancellation title not patched');
  write(path, s);
}

// 4) Dashboard wallet must subtract cancellation logs.
{
  const path = 'src/components/DashboardView.tsx';
  let s = read(path);

  s = s.replace(
    `  // القاصة تقرأ حصراً من سجل العمليات المالية الجديدة مع حماية ضد القيم الفارغة أو غير الرقمية\n  const totalCollectedRevenue = auditLogs\n    .filter(log => {\n      if (log.category !== 'payment') return false;\n      if (resetTimeMs > 0) {\n        const logTime = log.timestamp ? new Date(log.timestamp).getTime() : 0;\n        if (logTime > 0 && logTime < resetTimeMs) return false;\n      }\n      return true;\n    })\n    .reduce((acc, log) => acc + (Number(log.amount) || 0), 0);`,
    `  // القاصة تقرأ من سجل العمليات: التسديد يزيد، والإلغاء ينقص حتى تبقى مطابقة للداخل.\n  const totalCollectedRevenue = auditLogs\n    .filter(log => {\n      if (log.category !== 'payment' && log.category !== 'cancellation') return false;\n      if (resetTimeMs > 0) {\n        const logTime = log.timestamp ? new Date(log.timestamp).getTime() : 0;\n        if (logTime > 0 && logTime < resetTimeMs) return false;\n      }\n      return true;\n    })\n    .reduce((acc, log) => {\n      const amount = Math.abs(Number(log.amount) || 0);\n      return log.category === 'cancellation' ? acc - amount : acc + amount;\n    }, 0);`
  );

  must(s.includes("log.category !== 'payment' && log.category !== 'cancellation'"), 'Dashboard cancellation subtraction missing');
  write(path, s);
}

// 5) Wallet page must subtract cancellations and show negative cancelled operations even with positive amount stored.
{
  const path = 'src/components/WalletView.tsx';
  let s = read(path);

  s = s.replace(
    `  const totalCollected = financialLogs\n    .filter(log => log.category === 'payment')\n    .reduce((acc, log) => acc + (Number(log.amount) || 0), 0);`,
    `  const totalCollected = financialLogs\n    .filter(log => log.category === 'payment' || log.category === 'cancellation')\n    .reduce((acc, log) => {\n      const amount = Math.abs(Number(log.amount) || 0);\n      return log.category === 'cancellation' ? acc - amount : acc + amount;\n    }, 0);`
  );

  s = s.replace(
    `                  {log.amount !== undefined && log.amount > 0 && (\n                    <span className={\`text-sm font-black tabular-nums \${isPayment ? 'text-emerald-500' : 'text-rose-500'}\`} dir="ltr">\n                      {isPayment ? '+' : '-'}{log.amount.toLocaleString()} {currency}\n                    </span>\n                  )}`,
    `                  {log.amount !== undefined && Math.abs(Number(log.amount) || 0) > 0 && (\n                    <span className={\`text-sm font-black tabular-nums \${isPayment ? 'text-emerald-500' : 'text-rose-500'}\`} dir="ltr">\n                      {isPayment ? '+' : '-'}{Math.abs(Number(log.amount) || 0).toLocaleString()} {currency}\n                    </span>\n                  )}`
  );

  must(s.includes("log.category === 'payment' || log.category === 'cancellation'"), 'Wallet cancellation subtraction missing');
  must(s.includes('Math.abs(Number(log.amount) || 0).toLocaleString()'), 'Wallet cancellation display missing');
  write(path, s);
}

console.log('MOLDATK_CABINET_WALLET_FINAL_FIX applied');
