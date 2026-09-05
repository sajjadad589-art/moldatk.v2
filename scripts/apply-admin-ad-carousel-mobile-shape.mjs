import fs from 'node:fs';

const sliderPath = 'src/components/mobile/MobileAdSlider.tsx';
const sliderSource = String.raw`import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

type MobileAdSlide = {
  id: string;
  title: string | null;
  image_url: string;
  link_url: string | null;
  sort_order: number;
  updated_at: string;
};

const normalizeUrl = (url?: string | null) => {
  const clean = (url || '').trim();
  if (!clean) return null;
  if (/^https?:\/\//i.test(clean)) return clean;
  return ` + '`https://${clean}`' + `;
};

export const MobileAdSlider: React.FC<{ className?: string }> = ({ className = '' }) => {
  const [slides, setSlides] = useState<MobileAdSlide[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);

  const loadSlides = async () => {
    const { data, error } = await supabase
      .from('app_ad_slides')
      .select('id,title,image_url,link_url,sort_order,updated_at')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('updated_at', { ascending: false });

    if (error) {
      console.warn('[MobileAdSlider] failed to load slides', error.message);
      setSlides([]);
      return;
    }

    const cleanSlides = (data || [])
      .filter((item: any) => typeof item.image_url === 'string' && item.image_url.trim().length > 0)
      .map((item: any) => ({
        id: item.id,
        title: item.title || null,
        image_url: item.image_url,
        link_url: item.link_url || null,
        sort_order: Number(item.sort_order || 0),
        updated_at: item.updated_at || '',
      }));

    setSlides(cleanSlides);
    setActiveIndex(0);
  };

  useEffect(() => {
    void loadSlides();

    const refresh = () => void loadSlides();
    window.addEventListener('online', refresh);
    document.addEventListener('visibilitychange', refresh);

    const polling = window.setInterval(refresh, 60000);

    return () => {
      window.removeEventListener('online', refresh);
      document.removeEventListener('visibilitychange', refresh);
      window.clearInterval(polling);
    };
  }, []);

  useEffect(() => {
    if (slides.length <= 1) return;
    const timer = window.setInterval(() => {
      setActiveIndex(current => (current + 1) % slides.length);
    }, 3500);
    return () => window.clearInterval(timer);
  }, [slides.length]);

  if (!slides.length) return null;

  return (
    <section className={` + '`w-full ${className}`' + `} aria-label="إعلانات الإدارة">
      <div className="relative overflow-hidden rounded-[28px] bg-[#101b35] border border-slate-800/60 shadow-xl shadow-black/10" dir="ltr">
        <div
          className="flex transition-transform duration-700 ease-out will-change-transform"
          style={{ transform: ` + '`translateX(-${activeIndex * 100}%)`' + ` }}
        >
          {slides.map(slide => {
            const href = normalizeUrl(slide.link_url);
            const image = (
              <img
                src={slide.image_url}
                alt={slide.title || 'إعلان الإدارة'}
                loading="lazy"
                className="block w-full h-full object-cover bg-[#101b35]"
              />
            );

            return (
              <div key={slide.id} className="min-w-full w-full aspect-[16/6.4] bg-[#101b35]">
                {href ? (
                  <a href={href} target="_blank" rel="noreferrer" className="block w-full h-full" aria-label={slide.title || 'فتح إعلان الإدارة'}>
                    {image}
                  </a>
                ) : (
                  <div className="w-full h-full">{image}</div>
                )}
              </div>
            );
          })}
        </div>

        {slides.length > 1 && (
          <div className="absolute bottom-2 left-0 right-0 flex items-center justify-center gap-1.5" dir="ltr">
            {slides.map((slide, index) => (
              <button
                key={` + '`dot-${slide.id}`' + `}
                type="button"
                onClick={() => setActiveIndex(index)}
                className={` + '`h-1.5 rounded-full transition-all ${index === activeIndex ? \'w-5 bg-white\' : \'w-1.5 bg-white/45\'}`' + `}
                aria-label={` + '`عرض الإعلان ${index + 1}`' + `}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
};
`;

fs.writeFileSync(sliderPath, sliderSource);

const ensureImport = (filePath) => {
  let src = fs.readFileSync(filePath, 'utf8');
  if (!src.includes("import { MobileAdSlider } from './MobileAdSlider';")) {
    src = src.replace("import React", "import { MobileAdSlider } from './MobileAdSlider';\nimport React");
  }
  fs.writeFileSync(filePath, src);
};

const ensurePlacement = (filePath, marker, block) => {
  let src = fs.readFileSync(filePath, 'utf8');
  src = src.replace(/\n\s*<MobileAdSlider className="[^"]*" \/>\n/g, '\n');
  if (!src.includes(block.trim())) {
    src = src.replace(marker, `${block}\n${marker}`);
  }
  fs.writeFileSync(filePath, src);
};

const dashboardPath = 'src/components/mobile/MobileDashboard.tsx';
ensureImport(dashboardPath);
ensurePlacement(
  dashboardPath,
  '      {/* 2. Paid / Unpaid collection wheels - keep the approved ring design unchanged. */}',
  '      <MobileAdSlider className="mt-1" />'
);

const reportsPath = 'src/components/mobile/MobileMonthlyReports.tsx';
ensureImport(reportsPath);
ensurePlacement(
  reportsPath,
  '      <div className="grid grid-cols-2 gap-2.5">',
  '      <MobileAdSlider className="my-1" />'
);

// Remove the old settings-based ad/theme fragments if any older script brings them back.
const settingsPath = 'src/components/mobile/MobileSettings.tsx';
if (fs.existsSync(settingsPath)) {
  let settings = fs.readFileSync(settingsPath, 'utf8');
  settings = settings.replace(/\s*\{adminAdSlides\.length > 0 && \([\s\S]*?<\/section>\s*\)\}/g, '');
  settings = settings.replace(/\s*\/\*\s*Admin ad slider[\s\S]*?\*\/\s*/g, '\n');
  fs.writeFileSync(settingsPath, settings);
}

const dashboardOut = fs.readFileSync(dashboardPath, 'utf8');
const reportsOut = fs.readFileSync(reportsPath, 'utf8');
const sliderOut = fs.readFileSync(sliderPath, 'utf8');
const settingsOut = fs.existsSync(settingsPath) ? fs.readFileSync(settingsPath, 'utf8') : '';

if (!dashboardOut.includes('<MobileAdSlider className="mt-1" />')) throw new Error('Mobile dashboard ad slider missing');
if (!reportsOut.includes('<MobileAdSlider className="my-1" />')) throw new Error('Mobile reports ad slider missing');
if (!sliderOut.includes('app_ad_slides')) throw new Error('Mobile ad slider is not connected to app_ad_slides');
if (!sliderOut.includes('3500')) throw new Error('Mobile ad auto slide interval missing');
if (!sliderOut.includes('aspect-[16/6.4]')) throw new Error('Mobile ad banner ratio was not applied');
if (settingsOut.includes('المظهر والثيم') || settingsOut.includes('بحري هادئ') || settingsOut.includes('ذهبي فاتح')) {
  throw new Error('Theme UI returned to MobileSettings');
}

console.log('Mobile ad slider finalized on dashboard and reports.');
