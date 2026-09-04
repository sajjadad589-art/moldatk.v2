import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const write = (path, content) => fs.writeFileSync(path, content);

// Final safe fallback: use local theme variables so partial prop injection cannot break TypeScript.
{
  const path = 'src/components/mobile/MobileLayout.tsx';
  if (fs.existsSync(path)) {
    let c = read(path);
    if ((c.includes('data-moldatk-theme={mobileTheme}') || c.includes('mobileTheme={mobileTheme}') || c.includes('onChangeMobileTheme={onChangeMobileTheme}')) && !c.includes('WORKMODE_MOBILELAYOUT_THEME_FALLBACK')) {
      c = c.replace(/data-moldatk-theme=\{mobileTheme\}/g, 'data-moldatk-theme={__moldatkTheme}');
      c = c.replace(/mobileTheme=\{mobileTheme\}/g, 'mobileTheme={__moldatkTheme}');
      c = c.replace(/onChangeMobileTheme=\{onChangeMobileTheme\}/g, 'onChangeMobileTheme={__setMoldatkTheme}');
      const block = `  // WORKMODE_MOBILELAYOUT_THEME_FALLBACK
  const __moldatkTheme = (() => { try { return localStorage.getItem('moldatk_mobile_theme') || 'ocean-calm'; } catch (e) { return 'ocean-calm'; } })();
  const __setMoldatkTheme = (theme: string) => { try { localStorage.setItem('moldatk_mobile_theme', theme); document.documentElement.setAttribute('data-moldatk-theme', theme); } catch (e) {} };
  const monthlyTariffs = [] as any[];
`;
      c = c.replace(/(\}\) => \{\n)(\s*return \()/, `$1${block}$2`);
      write(path, c);
      console.log('repair3 applied MobileLayout local theme fallback');
    }
  }
}

{
  const path = 'src/components/mobile/MobileSettings.tsx';
  if (fs.existsSync(path)) {
    let c = read(path);
    if ((c.includes('mobileTheme') || c.includes('onChangeMobileTheme')) && !c.includes('WORKMODE_MOBILESETTINGS_THEME_FALLBACK')) {
      const block = `  // WORKMODE_MOBILESETTINGS_THEME_FALLBACK
  const [mobileTheme, onChangeMobileTheme] = React.useState<string>(() => { try { return localStorage.getItem('moldatk_mobile_theme') || 'ocean-calm'; } catch (e) { return 'ocean-calm'; } });
`;
      c = c.replace(/(\}\) => \{\n)/, `$1${block}`);
      write(path, c);
      console.log('repair3 applied MobileSettings local theme fallback');
    }
  }
}

console.log('Workmode final bundle repair3 applied.');
