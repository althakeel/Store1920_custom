import { getMetaPurchaseGuardInlineScript } from '@/lib/metaPurchaseGuard';

export const META_PIXEL_ID =
  process.env.NEXT_PUBLIC_META_PIXEL_ID
  || process.env.META_PIXEL_ID
  || '794381109763677';

export { getMetaPurchaseGuardInlineScript };

export function getMetaPixelBootstrapScript(pixelId = META_PIXEL_ID) {
  const safeId = String(pixelId).replace(/'/g, "\\'");
  return `!function(f,b,e,v,n,t,s){
if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];
t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window,document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
var k='__store1920MetaInited';
if(!window[k]){window.fbq('init','${safeId}',{},{autoConfig:false});window[k]=true;}
window.fbq('set','autoConfig',false,'${safeId}');`;
}

export function getMetaPixelNoscriptSrc(pixelId = META_PIXEL_ID) {
  return `https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1`;
}
