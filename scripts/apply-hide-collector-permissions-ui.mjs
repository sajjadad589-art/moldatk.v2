import fs from 'node:fs';

const path = 'src/components/FolderDetailModal.tsx';
let source = fs.readFileSync(path, 'utf8');
let changed = false;

// Remove the permissions toggle button from each collector header.
const toggleButton = /\n\s*<button\n\s*onClick=\{\(\) =>\n\s*setExpandedPermissions\(prev => \(\{[\s\S]*?<span>\{isPermsOpen \? 'إخفاء الصلاحيات' : 'تعديل الصلاحيات'\}<\/span>\n\s*<\/button>\n/;
if (toggleButton.test(source)) {
  source = source.replace(toggleButton, '\n');
  changed = true;
}

// Remove the entire visible collector permissions panel while keeping the permission
// data/handlers intact in the background for compatibility with existing accounts.
const panelStart = source.indexOf('                      {/* Permissions Panel */}');
if (panelStart >= 0) {
  const panelEndMarker = "\n                    </div>\n                  );\n                })}";
  const panelEnd = source.indexOf(panelEndMarker, panelStart);
  if (panelEnd > panelStart) {
    source = source.slice(0, panelStart) + source.slice(panelEnd);
    changed = true;
  }
}

// These are no longer needed for rendering; keep permission logic itself untouched.
source = source.replace("                  const isPermsOpen = expandedPermissions[c.id] ?? true;\n", '');

if (changed) {
  fs.writeFileSync(path, source);
  console.log('Hidden collector permissions UI; background permissions preserved.');
} else {
  console.log('Collector permissions UI already hidden.');
}
