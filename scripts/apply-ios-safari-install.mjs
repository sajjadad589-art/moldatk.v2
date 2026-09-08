import fs from 'node:fs';

const installerPath = 'public/ios-install.js';
const indexPath = 'index.html';

if (!fs.existsSync(installerPath)) {
  throw new Error('iOS Safari installer: public/ios-install.js missing');
}
if (!fs.existsSync(indexPath)) {
  throw new Error('iOS Safari installer: index.html missing');
}

let html = fs.readFileSync(indexPath, 'utf8');

// Preserve the existing Apple/PWA metadata and add only the lightweight iPhone
// installation assistant. iOS does not expose a programmatic Add-to-Home-Screen API,
// so the assistant guides the user through Safari's native Share -> Add to Home Screen
// flow while keeping the web app itself untouched.
if (!html.includes('/ios-install.js?v=1')) {
  const tag = '    <script defer src="/ios-install.js?v=1"></script>\n';
  if (html.includes('</head>')) html = html.replace('</head>', `${tag}  </head>`);
  else throw new Error('iOS Safari installer: </head> not found');
}

// Defensive Apple web-app metadata. Existing values are preserved when already present.
if (!html.includes('apple-mobile-web-app-capable')) {
  html = html.replace('</head>', '    <meta name="apple-mobile-web-app-capable" content="yes" />\n  </head>');
}
if (!html.includes('apple-mobile-web-app-title')) {
  html = html.replace('</head>', '    <meta name="apple-mobile-web-app-title" content="مولدتك" />\n  </head>');
}

fs.writeFileSync(indexPath, html, 'utf8');

const finalHtml = fs.readFileSync(indexPath, 'utf8');
if (!finalHtml.includes('/ios-install.js?v=1')) {
  throw new Error('iOS Safari installer: installer script tag was not preserved');
}
if (!finalHtml.includes('apple-mobile-web-app-capable')) {
  throw new Error('iOS Safari installer: Apple standalone metadata missing');
}

console.log('iPhone Safari install assistant enabled without changing app/payment/sync behavior.');
