import { META_PIXEL_ID } from '@/lib/metaPixelConfig';

const AUTHORIZED_IDS_KEY = '__metaAuthorizedPurchaseIds';
const GUARD_FLAG = '__metaPurchaseGuardInstalled';

export function authorizeMetaPurchase(eventId) {
  if (typeof window === 'undefined' || !eventId) return;
  const id = String(eventId).trim();
  if (!id) return;

  window[AUTHORIZED_IDS_KEY] = window[AUTHORIZED_IDS_KEY] || new Set();
  window[AUTHORIZED_IDS_KEY].add(id);
}

function shouldAllowPurchaseCall(args) {
  const cmd = args[0];
  // Block GTM duplicate Purchase tags (fbq('track', 'Purchase', …)).
  // App code uses trackSingle on /order-success — always allow that.
  if (cmd === 'track' && args[1] === 'Purchase') {
    return false;
  }
  return true;
}

function wrapFbqInstance(fbq) {
  if (!fbq || fbq.__purchaseGuardWrapped) return fbq;

  const original = fbq;

  const guardedInvoke = (args) => {
    if (!shouldAllowPurchaseCall(args)) {
      return;
    }
    if (typeof original.callMethod === 'function') {
      return original.callMethod.apply(original, args);
    }
    return original.apply(original, args);
  };

  const wrapped = function purchaseGuardedFbq(...args) {
    return guardedInvoke(args);
  };

  Object.assign(wrapped, original);
  wrapped.push = (...args) => guardedInvoke(args);
  wrapped.callMethod = (...args) => guardedInvoke(args);
  wrapped.__purchaseGuardWrapped = true;
  wrapped.__purchaseGuardOriginal = original;

  return wrapped;
}

export function installMetaPurchaseGuard() {
  if (typeof window === 'undefined') return;

  window[AUTHORIZED_IDS_KEY] = window[AUTHORIZED_IDS_KEY] || new Set();

  const apply = () => {
    if (!window.fbq || window.fbq.__purchaseGuardWrapped) return;
    window.fbq = wrapFbqInstance(window.fbq);
  };

  if (!window[GUARD_FLAG]) {
    window[GUARD_FLAG] = true;
    apply();

    let attempts = 0;
    const timer = window.setInterval(() => {
      apply();
      attempts += 1;
      if (attempts >= 240) {
        window.clearInterval(timer);
      }
    }, 50);
  } else {
    apply();
  }
}

/** Inline script for layout bootstrap — must stay in sync with installMetaPurchaseGuard. */
export function getMetaPurchaseGuardInlineScript(pixelId = META_PIXEL_ID) {
  const id = String(pixelId).replace(/'/g, "\\'");
  return `(function(pixelId){
var k='${AUTHORIZED_IDS_KEY}',g='${GUARD_FLAG}';
window[k]=window[k]||new Set();
function allow(args){
  var cmd=args[0];
  if(cmd==='track'&&args[1]==='Purchase')return false;
  return true;
}
function wrap(fbq){
  if(!fbq||fbq.__purchaseGuardWrapped)return fbq;
  var orig=fbq;
  function invoke(args){
    if(!allow(args))return;
    if(typeof orig.callMethod==='function')return orig.callMethod.apply(orig,args);
    return orig.apply(orig,args);
  }
  var w=function(){return invoke(Array.prototype.slice.call(arguments));};
  for(var p in orig){try{w[p]=orig[p];}catch(e){}}
  w.push=function(){return invoke(Array.prototype.slice.call(arguments));};
  w.callMethod=function(){return invoke(Array.prototype.slice.call(arguments));};
  w.__purchaseGuardWrapped=true;
  w.__purchaseGuardOriginal=orig;
  return w;
}
function apply(){if(window.fbq&&!window.fbq.__purchaseGuardWrapped)window.fbq=wrap(window.fbq);}
if(!window[g]){
  window[g]=true;
  apply();
  var n=0,t=setInterval(function(){apply();if(++n>=240)clearInterval(t);},50);
}else{apply();}
})('${id}');`;
}
