import fs from 'node:fs';

const file = 'src/LandingPage.tsx';
let src = fs.readFileSync(file, 'utf8');

src = src.replace(/\n\s*Apple,/, '');

if (!src.includes('const AppleBrandIcon =')) {
  const anchor = "const features = [";
  src = src.replace(anchor, `const AppleBrandIcon = ({ className = '' }: { className?: string }) => (\n  <span className={\`inline-flex items-center justify-center \${className}\`} aria-label=\"Apple\">\n    <span\n      className=\"block h-full w-full bg-current\"\n      style={{\n        WebkitMask: \"url('/brand/apple-logo.svg') center / contain no-repeat\",\n        mask: \"url('/brand/apple-logo.svg') center / contain no-repeat\",\n      }}\n    />\n  </span>\n);\n\n${anchor}`);
}

src = src.replace(/\['iPhone',\s*Apple\]/g, "['iPhone', AppleBrandIcon]");
src = src.replace(/<Apple className=/g, '<AppleBrandIcon className=');

fs.writeFileSync(file, src);
console.log('Apple brand icon applied');
