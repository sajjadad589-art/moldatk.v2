import fs from 'node:fs';

const mobilePath = 'src/components/mobile/MobileSettings.tsx';
let src = fs.readFileSync(mobilePath, 'utf8');

const adBox = String.raw`      {adminAdSlides.length > 0 && (
        <section className="w-full rounded-[28px] overflow-hidden bg-slate-200 dark:bg-[#121b2f] shadow-[0_18px_45px_rgba(15,23,42,0.22)] border border-white/10">
          <div className="relative overflow-hidden rounded-[28px]" style={{ direction: 'ltr' }}>
            <div
              className="flex transition-transform duration-700 ease-out"
              style={{ transform: 'translateX(-' + (adminAdIndex * 100) + '%)' }}
            >
              {adminAdSlides.map((slide) => {
                const hasLink = Boolean(slide.link_url);
                return (
                  <button
                    key={slide.id}
                    type="button"
                    onClick={() => hasLink && window.open(slide.link_url || '', '_blank', 'noopener,noreferrer')}
                    className={(hasLink ? 'cursor-pointer' : 'cursor-default') + ' min-w-full shrink-0 block bg-slate-200 dark:bg-slate-900'}
                    aria-label={slide.title || 'إعلان الإدارة'}
                  >
                    <img
                      src={slide.image_url}
                      alt={slide.title || 'إعلان الإدارة'}
                      className="w-full aspect-[16/6] object-cover block"
                      loading="lazy"
                    />
                  </button>
                );
              })}
            </div>
            {adminAdSlides.length > 1 && (
              <div className="absolute bottom-2 left-0 right-0 flex items-center justify-center gap-1.5">
                {adminAdSlides.map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setAdminAdIndex(idx)}
                    className={(idx === adminAdIndex ? 'w-6 bg-white' : 'w-1.5 bg-white/45') + ' h-1.5 rounded-full shadow transition-all'}
                    aria-label={'إعلان ' + (idx + 1)}
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      )}

`;

src = src.replace(
  /\s*\{adminAdSlides\.length > 0 && \([\s\S]*?\n\s*\)\}\n\n\s*<div className="bg-white dark:bg\[\#111c38\] rounded-2xl p-4 border border-slate-200\/90 dark:border-slate-800 shadow-xs space-y-3">/,
  '\n' + adBox + '      <div className="bg-white dark:bg[#111c38] rounded-2xl p-4 border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-3">'.replace('dark:bg[#111c38]', 'dark:bg-[#111c38]')
);

fs.writeFileSync(mobilePath, src);

const out = fs.readFileSync(mobilePath, 'utf8');
if (!out.includes('aspect-[16/6]') || !out.includes('duration-700') || !out.includes('adminAdSlides.map')) {
  throw new Error('Mobile ad box shape patch failed');
}
console.log('Mobile ad box shape patched.');
