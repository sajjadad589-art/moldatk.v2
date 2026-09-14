import fs from 'node:fs';

const path = 'scripts/apply-onboarding-debt-lump-settlement-final.mjs';
if (!fs.existsSync(path)) throw new Error('Onboarding idempotence patch: finalizer script missing');

let source = fs.readFileSync(path, 'utf8').replaceAll('\r\n', '\n');

const strictCheck = "  must(s.includes(oldSubmit), 'subscriber submit button missing');";
const tolerantCheck = `  const onboardingSubmitAlreadyApplied = s.includes("disabled={!subscriberToEdit && currentTierObj?.type !== 'free' && (!newDebtMode || (newDebtMode === 'prior' && !priorDebtMonthId))}")\n    && s.includes('حالة المديونية عند التسجيل');\n  must(s.includes(oldSubmit) || onboardingSubmitAlreadyApplied, 'subscriber submit button missing');`;

if (source.includes(strictCheck)) {
  source = source.replace(strictCheck, tolerantCheck);
}

const strictReplace = '  s = s.replace(oldSubmit, onboardingUi + newSubmit);';
const tolerantReplace = `  if (s.includes(oldSubmit)) {\n    s = s.replace(oldSubmit, onboardingUi + newSubmit);\n  } else {\n    must(s.includes(newSubmit) && onboardingSubmitAlreadyApplied, 'subscriber onboarding submit state inconsistent');\n  }`;

if (source.includes(strictReplace) && !source.includes(tolerantReplace)) {
  source = source.replace(strictReplace, tolerantReplace);
}

// Earlier executions nested the exact same guard on every lint/build run.
const guardStart = source.indexOf('  if (s.includes(oldSubmit)) {');
const guardEnd = source.indexOf('  // Replace the advanced custom-payment sheet', guardStart);
if (guardStart >= 0 && guardEnd > guardStart) {
  source = source.slice(0, guardStart) + tolerantReplace + '\n\n' + source.slice(guardEnd);
}

if (!source.includes('onboardingSubmitAlreadyApplied')) {
  throw new Error('Onboarding idempotence patch: submit guard was not installed');
}
if (!source.includes('subscriber onboarding submit state inconsistent')) {
  throw new Error('Onboarding idempotence patch: submit replacement guard was not installed');
}

fs.writeFileSync(path, source, 'utf8');
console.log('Onboarding/lump finalizer made idempotent for lint -> build double execution.');
