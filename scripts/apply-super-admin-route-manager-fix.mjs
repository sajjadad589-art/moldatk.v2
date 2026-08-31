import fs from 'node:fs';

const file = 'src/App.tsx';
let text = fs.readFileSync(file, 'utf8');

text = text.replace(
  "if (forceSuperAdmin && parsed.role !== 'super_admin') return null;",
  "if (forceSuperAdmin && parsed.role !== 'super_admin' && parsed.role !== 'super_admin_manager') return null;"
);

text = text.replace(
  "if (forceSuperAdmin && userSession.role !== 'super_admin') {",
  "if (forceSuperAdmin && userSession.role !== 'super_admin' && userSession.role !== 'super_admin_manager') {"
);

text = text.replace(
  "if (userSession.role === 'super_admin') {\n    return <SuperAdminDashboard onLogout={handleLogout} />;\n  }",
  "if (userSession.role === 'super_admin' || userSession.role === 'super_admin_manager') {\n    return <SuperAdminDashboard onLogout={handleLogout} />;\n  }"
);

fs.writeFileSync(file, text);
console.log('Super admin manager route access enabled.');
