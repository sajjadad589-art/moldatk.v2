import React, { useEffect, useState } from 'react';
import { ExternalLink, Sparkles } from 'lucide-react';
import { supabase } from '../lib/supabase';

type SeasonalCampaign = {
  id: string;
  name: string;
  starts_at: string;
  ends_at: string;
  is_active: boolean;
  priority: number;
  theme_key: string;
  accent_color: string | null;
  accent_soft_color: string | null;
  icon_url: string | null;
  logo_url: string | null;
  banner_url: string | null;
  offer_title: string | null;
  offer_body: string | null;
  cta_label: string | null;
  cta_url: string | null;
};

const DEFAULT_ACCENT = '#0f766e';
const DEFAULT_SOFT = '#ccfbf1';

export const SeasonalCampaignRuntime: React.FC = () => {
  const [campaign, setCampaign] = useState<SeasonalCampaign | null>(null);

  useEffect(() => {
    let mounted = true;
    let originalIconHref: string | null = null;
    let originalThemeColor: string | null = null;

    const loadCampaign = async () => {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('seasonal_campaigns')
        .select('id,name,starts_at,ends_at,is_active,priority,theme_key,accent_color,accent_soft_color,icon_url,logo_url,banner_url,offer_title,offer_body,cta_label,cta_url')
        .eq('is_active', true)
        .lte('starts_at', now)
        .gt('ends_at', now)
        .order('priority', { ascending: false })
        .order('starts_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!mounted) return;
      if (error) {
        console.warn('Seasonal campaign load failed:', error.message);
        setCampaign(null);
        return;
      }
      setCampaign((data || null) as SeasonalCampaign | null);
    };

    const onRefresh = () => void loadCampaign();
    void loadCampaign();
    window.addEventListener('moldatk-seasonal-refresh', onRefresh);
    window.addEventListener('moldatk-local-sync', onRefresh);
    document.addEventListener('visibilitychange', onRefresh);
    const timer = window.setInterval(loadCampaign, 60000);

    const iconLink = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (iconLink) originalIconHref = iconLink.href;
    const themeMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (themeMeta) originalThemeColor = themeMeta.content;

    return () => {
      mounted = false;
      window.clearInterval(timer);
      window.removeEventListener('moldatk-seasonal-refresh', onRefresh);
      window.removeEventListener('moldatk-local-sync', onRefresh);
      document.removeEventListener('visibilitychange', onRefresh);
      document.documentElement.removeAttribute('data-seasonal-theme');
      document.documentElement.style.removeProperty('--seasonal-accent');
      document.documentElement.style.removeProperty('--seasonal-accent-soft');
      if (iconLink && originalIconHref) iconLink.href = originalIconHref;
      if (themeMeta && originalThemeColor) themeMeta.content = originalThemeColor;
    };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const accent = campaign?.accent_color || DEFAULT_ACCENT;
    const soft = campaign?.accent_soft_color || DEFAULT_SOFT;
    const iconLink = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    const themeMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');

    if (!campaign) {
      root.removeAttribute('data-seasonal-theme');
      root.style.removeProperty('--seasonal-accent');
      root.style.removeProperty('--seasonal-accent-soft');
      return;
    }

    root.setAttribute('data-seasonal-theme', campaign.theme_key || 'custom');
    root.style.setProperty('--seasonal-accent', accent);
    root.style.setProperty('--seasonal-accent-soft', soft);
    if (campaign.icon_url && iconLink) iconLink.href = campaign.icon_url;
    if (themeMeta) themeMeta.content = accent;

    window.dispatchEvent(new CustomEvent('moldatk-seasonal-campaign', { detail: campaign }));
  }, [campaign]);

  if (!campaign || window.location.pathname === '/super-admin') return null;
  if (!campaign.banner_url && !campaign.offer_title && !campaign.offer_body) return null;

  const accent = campaign.accent_color || DEFAULT_ACCENT;
  const soft = campaign.accent_soft_color || DEFAULT_SOFT;

  return (
    <div dir="rtl" className="w-full border-b" style={{ backgroundColor: soft, borderColor: accent }}>
      <div className="max-w-[1700px] mx-auto px-3 py-2.5 flex items-center gap-3">
        {campaign.logo_url || campaign.icon_url ? (
          <img src={campaign.logo_url || campaign.icon_url || ''} alt="هوية الموسم" className="w-10 h-10 object-contain rounded-xl bg-white/80 border shrink-0" />
        ) : (
          <div className="w-10 h-10 rounded-xl bg-white/70 flex items-center justify-center shrink-0"><Sparkles className="w-5 h-5" style={{ color: accent }} /></div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-black truncate" style={{ color: accent }}>{campaign.name}</p>
          {campaign.offer_title && <p className="text-sm font-black text-slate-900 truncate">{campaign.offer_title}</p>}
          {campaign.offer_body && <p className="text-xs text-slate-700 line-clamp-2">{campaign.offer_body}</p>}
        </div>
        {campaign.cta_url && (
          <a href={campaign.cta_url} target="_blank" rel="noreferrer" className="shrink-0 px-3 py-2 rounded-xl text-xs font-black text-white flex items-center gap-1.5" style={{ backgroundColor: accent }}>
            {campaign.cta_label || 'شاهد العرض'} <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
      </div>
      {campaign.banner_url && <img src={campaign.banner_url} alt={campaign.offer_title || campaign.name} className="w-full max-h-56 object-cover" />}
    </div>
  );
};
