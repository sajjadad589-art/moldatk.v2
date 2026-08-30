import fs from 'node:fs';

const file = 'src/LandingPage.tsx';
let src = fs.readFileSync(file, 'utf8');

if (!src.includes('MessageCircle,')) {
  src = src.replace('  Globe2,\n} from \'lucide-react\';', '  Globe2,\n  MessageCircle,\n} from \'lucide-react\';');
}

if (!src.includes('const whatsappUrl')) {
  src = src.replace(
    '  const appUrl = `${window.location.origin}/`;\n',
    '  const appUrl = `${window.location.origin}/`;\n  const whatsappUrl = `https://wa.me/9647766334555?text=${encodeURIComponent(\'مرحبا، أرغب بطلب تطبيق مولدتك\')}`;\n'
  );
}

const heroAnchor = `              <a href="#release" className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-white/10 border border-white/15 text-white font-black hover:bg-white/15 transition-all">\n                <Download className="w-5 h-5" /> نسخة Android\n              </a>`;
const heroWhatsapp = `${heroAnchor}\n              <a href={whatsappUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-[#25D366] text-white font-black hover:bg-[#20bd5a] transition-all shadow-lg shadow-emerald-950/20">\n                <MessageCircle className="w-5 h-5" /> لطلب التطبيق تواصل عن طريق الواتساب\n              </a>`;
if (!src.includes('للطلب عبر الواتساب') && !src.includes('لطلب التطبيق تواصل عن طريق الواتساب')) {
  src = src.replace(heroAnchor, heroWhatsapp);
}

const releaseAnchor = `                <button disabled className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-blue-600/50 text-white/70 font-black cursor-not-allowed">\n                  <Download className="w-5 h-5" /> التحميل العام قريباً\n                </button>`;
const releaseWhatsapp = `<a href={whatsappUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-[#25D366] text-white font-black hover:bg-[#20bd5a] transition-all">\n                  <MessageCircle className="w-5 h-5" /> لطلب التطبيق تواصل عن طريق الواتساب\n                </a>`;
if (src.includes(releaseAnchor)) {
  src = src.replace(releaseAnchor, releaseWhatsapp);
}

const footerAnchor = `<span>Android • iPhone • Web</span>`;
const footerWhatsapp = `<a href={whatsappUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-emerald-400 hover:text-emerald-300 font-bold"><MessageCircle className="w-4 h-4" /> 07766334555</a>`;
if (src.includes(footerAnchor)) {
  src = src.replace(footerAnchor, footerWhatsapp);
}

fs.writeFileSync(file, src);
console.log('WhatsApp CTA applied to landing page');
