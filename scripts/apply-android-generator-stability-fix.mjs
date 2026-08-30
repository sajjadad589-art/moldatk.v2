import fs from 'node:fs';

const file = 'src/App.tsx';
let src = fs.readFileSync(file, 'utf8');

if (!src.includes("const ENABLE_NATIVE_PUSH = import.meta.env.VITE_ENABLE_NATIVE_PUSH === 'true';")) {
  src = src.replace(
    "import { FolderDetailModal } from './components/FolderDetailModal';\n",
    "import { FolderDetailModal } from './components/FolderDetailModal';\n\nconst ENABLE_NATIVE_PUSH = import.meta.env.VITE_ENABLE_NATIVE_PUSH === 'true';\n"
  );
}

src = src.replace(
  "if (userSession?.role !== 'generator_admin' || !Capacitor.isNativePlatform()) return;",
  "if (userSession?.role !== 'generator_admin' || !Capacitor.isNativePlatform() || !ENABLE_NATIVE_PUSH) return;"
);

fs.writeFileSync(file, src);
console.log('Android generator stability fix applied: native push disabled unless explicitly enabled');
