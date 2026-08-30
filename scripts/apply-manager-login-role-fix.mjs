import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const loginPath = path.join(root, 'src/components/LoginView.tsx');
const typesPath = path.join(root, 'src/types.ts');
let changed = false;

let login = fs.readFileSync(loginPath, 'utf8');
let types = fs.readFileSync(typesPath, 'utf8');

const oldRoleCheck = "profile.role !== 'super_admin' && profile.role !== 'generator_admin'";
const newRoleCheck = "profile.role !== 'super_admin' && profile.role !== 'super_admin_manager' && profile.role !== 'generator_admin'";
if (login.includes(oldRoleCheck) && !login.includes("profile.role !== 'super_admin_manager'")) {
  login = login.replace(oldRoleCheck, newRoleCheck);
  changed = true;
  console.log('patched: allow super_admin_manager login');
}

const oldRoleType = "export type UserRole = 'super_admin' | 'generator_admin' | 'admin' | 'collector';";
const newRoleType = "export type UserRole = 'super_admin' | 'super_admin_manager' | 'generator_admin' | 'admin' | 'collector';";
if (types.includes(oldRoleType)) {
  types = types.replace(oldRoleType, newRoleType);
  changed = true;
  console.log('patched: UserRole includes super_admin_manager');
}

if (changed) {
  fs.writeFileSync(loginPath, login, 'utf8');
  fs.writeFileSync(typesPath, types, 'utf8');
}
console.log('Manager login role fix applied.');
