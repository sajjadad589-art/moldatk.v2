import fs from 'node:fs';

const file = 'src/App.tsx';
let src = fs.readFileSync(file, 'utf8');

const desktopDelete = `              onDeleteSubscriber={isAdmin ? (subId) => {\n                setSubscribers(prev => {\n                  const updated = prev.filter(s => s.id !== subId);\n                  try { localStorage.setItem(getStorageKey('moldatk_subscribers'), JSON.stringify(updated)); } catch (e) {}\n                  window.dispatchEvent(new Event('moldatk-local-sync'));\n                  return updated;\n                });\n                showToast('تم حذف المشترك بنجاح');\n              } : undefined}`;

if (src.includes(desktopDelete)) {
  src = src.replace(desktopDelete, `              onDeleteSubscriber={isAdmin ? handleDeleteSubscriber : undefined}`);
}

const modalDelete = `        onDeleteSubscriber={(subId) => {\n          setSubscribers(prev => {\n            const updated = prev.filter(s => s.id !== subId);\n            try { localStorage.setItem(getStorageKey('moldatk_subscribers'), JSON.stringify(updated)); } catch (e) {}\n            return updated;\n          });\n          setIsSubscriberModalOpen(false);\n        }}`;

while (src.includes(modalDelete)) {
  src = src.replace(modalDelete, `        onDeleteSubscriber={(subId) => { handleDeleteSubscriber(subId); setIsSubscriberModalOpen(false); }}`);
}

fs.writeFileSync(file, src);
console.log('Shared subscriber delete wiring applied');
