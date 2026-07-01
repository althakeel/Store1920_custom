export const GOOGLE_ADS_ID =
  process.env.NEXT_PUBLIC_GOOGLE_ADS_ID
  || process.env.GOOGLE_ADS_ID
  || 'AW-18265876413';

export function getGoogleAdsGtagSrc(adsId = GOOGLE_ADS_ID) {
  const id = encodeURIComponent(String(adsId).trim());
  return `https://www.googletagmanager.com/gtag/js?id=${id}`;
}

export function getGoogleAdsGtagInitScript(adsId = GOOGLE_ADS_ID) {
  const id = String(adsId).replace(/'/g, "\\'");
  return `window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${id}');`;
}
