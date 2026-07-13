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

function getAuthorizedPurchaseIds() {
  if (typeof window === 'undefined') return null;
  const set = window[AUTHORIZED_IDS_KEY];
  return set && typeof set.has === 'function' ? set : null;
}

function readPurchaseEventIdFromObject(value) {
  if (!value || typeof value !== 'object') return '';
  return String(value.eventID || value.event_id || value.order_id || '').trim();
}

function resolvePurchaseEventId(args = []) {
  const cmd = args[0];
  if (cmd === 'trackSingle' && args[2] === 'Purchase') {
    const fromOptions = readPurchaseEventIdFromObject(args[4]);
    if (fromOptions) return fromOptions;
    return readPurchaseEventIdFromObject(args[3]);
  }
  if (cmd === 'track' && args[1] === 'Purchase') {
    const fromOptions = readPurchaseEventIdFromObject(args[3]);
    if (fromOptions) return fromOptions;
    return readPurchaseEventIdFromObject(args[2]);
  }
  return '';
}

function invokeFbqCall(original, args) {
  const rooted = original?.__purchaseGuardOriginal || original;
  if (!rooted) return undefined;

  const realCallMethod = rooted.__realCallMethod || rooted.callMethod;
  if (
    typeof realCallMethod === 'function'
    && realCallMethod !== rooted.__guardedCallMethod
  ) {
    return realCallMethod.apply(rooted, args);
  }

  if (typeof rooted.apply === 'function') {
    return rooted.apply(rooted, args);
  }

  return undefined;
}

function isAuthorizedPurchaseCall(args = []) {
  const eventId = resolvePurchaseEventId(args);
  if (!eventId) return false;
  const authorized = getAuthorizedPurchaseIds();
  return Boolean(authorized?.has(eventId));
}

function isPurchaseFbqCall(args = []) {
  const cmd = args[0];
  if (cmd === 'track' && args[1] === 'Purchase') return true;
  if (cmd === 'trackSingle' && args[2] === 'Purchase') return true;
  if (cmd === 'trackCustom' && args[1] === 'Purchase') return true;
  return false;
}

function shouldAllowPurchaseCall(args) {
  if (!isPurchaseFbqCall(args)) return true;
  // Only our explicit trackSingle on this pixel — block GTM fbq('track','Purchase') duplicates.
  if (args[0] !== 'trackSingle' || String(args[1]) !== META_PIXEL_ID) return false;
  return isAuthorizedPurchaseCall(args);
}

function runGuardedFbqCall(original, args) {
  if (!shouldAllowPurchaseCall(args)) {
    return false;
  }
  const result = invokeFbqCall(original, args);
  if (isPurchaseFbqCall(args) && result !== false) {
    const eventId = resolvePurchaseEventId(args);
    if (eventId) getAuthorizedPurchaseIds()?.delete(eventId);
  }
  return result;
}

function wrapFbqInstance(fbq) {
  if (!fbq || fbq.__purchaseGuardWrapped) return fbq;

  const original = fbq;

  const guardedInvoke = (args) => runGuardedFbqCall(original, args);

  const guardedCallMethod = (...callArgs) => runGuardedFbqCall(original, callArgs);

  const wrapped = function purchaseGuardedFbq(...args) {
    return guardedInvoke(args);
  };

  Object.assign(wrapped, original);
  wrapped.push = (...args) => guardedInvoke(args);
  wrapped.callMethod = guardedCallMethod;
  wrapped.__purchaseGuardWrapped = true;
  wrapped.__purchaseGuardOriginal = original;
  wrapped.__guardedCallMethod = guardedCallMethod;
  original.__guardedCallMethod = guardedCallMethod;

  return wrapped;
}

export function installMetaPurchaseGuard() {
  if (typeof window === 'undefined') return;

  window[AUTHORIZED_IDS_KEY] = window[AUTHORIZED_IDS_KEY] || new Set();

  const apply = () => {
    if (!window.fbq) return;

    if (window.fbq.__purchaseGuardWrapped) {
      const original = window.fbq.__purchaseGuardOriginal;
      const guarded = window.fbq.__guardedCallMethod;
      const liveMethod = window.fbq.callMethod;
      if (original && liveMethod && guarded && liveMethod !== guarded) {
        original.__realCallMethod = liveMethod;
        window.fbq.callMethod = guarded;
      }
      return;
    }

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
        window.setInterval(apply, 2000);
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
function readId(o){
  if(!o||typeof o!=='object')return '';
  return String(o.eventID||o.event_id||o.order_id||'').trim();
}
function purchaseEventId(args){
  if(args[0]==='trackSingle'&&args[2]==='Purchase'){
    var fromOpts=readId(args[4]);
    if(fromOpts)return fromOpts;
    return readId(args[3]);
  }
  if(args[0]==='track'&&args[1]==='Purchase'){
    var fromTrackOpts=readId(args[3]);
    if(fromTrackOpts)return fromTrackOpts;
    return readId(args[2]);
  }
  return '';
}
function invokeFbq(orig,args){
  var rooted=orig&&orig.__purchaseGuardOriginal?orig.__purchaseGuardOriginal:orig;
  if(!rooted)return;
  var real=rooted.__realCallMethod||rooted.callMethod;
  if(typeof real==='function'&&real!==rooted.__guardedCallMethod)return real.apply(rooted,args);
  if(typeof rooted.apply==='function')return rooted.apply(rooted,args);
}
function isPurchase(args){
  return (args[0]==='track'&&args[1]==='Purchase')
    ||(args[0]==='trackSingle'&&args[2]==='Purchase')
    ||(args[0]==='trackCustom'&&args[1]==='Purchase');
}
function allow(args){
  if(!isPurchase(args))return true;
  if(args[0]!=='trackSingle'||String(args[1])!==pixelId)return false;
  var eid=purchaseEventId(args);
  return !!(eid&&window[k]&&window[k].has(eid));
}
function wrap(fbq){
  if(!fbq||fbq.__purchaseGuardWrapped)return fbq;
  var orig=fbq;
  function invoke(args){
    if(!allow(args))return false;
    var result=invokeFbq(orig,args);
    if(isPurchase(args)&&result!==false){
      var eid=purchaseEventId(args);
      if(eid&&window[k])window[k].delete(eid);
    }
    return result;
  }
  var guardedCallMethod=function(){return invoke(Array.prototype.slice.call(arguments));};
  var w=function(){return invoke(Array.prototype.slice.call(arguments));};
  for(var p in orig){try{w[p]=orig[p];}catch(e){}}
  w.push=function(){return invoke(Array.prototype.slice.call(arguments));};
  w.callMethod=guardedCallMethod;
  w.__purchaseGuardWrapped=true;
  w.__purchaseGuardOriginal=orig;
  w.__guardedCallMethod=guardedCallMethod;
  orig.__guardedCallMethod=guardedCallMethod;
  return w;
}
function apply(){
  if(!window.fbq)return;
  if(window.fbq.__purchaseGuardWrapped){
    var orig=window.fbq.__purchaseGuardOriginal;
    var guarded=window.fbq.__guardedCallMethod;
    var live=window.fbq.callMethod;
    if(orig&&live&&guarded&&live!==guarded){
      orig.__realCallMethod=live;
      window.fbq.callMethod=guarded;
    }
    return;
  }
  if(!window.fbq.__purchaseGuardWrapped)window.fbq=wrap(window.fbq);
}
if(!window[g]){
  window[g]=true;
  apply();
  var n=0,t=setInterval(function(){apply();if(++n>=240){clearInterval(t);setInterval(apply,2000);}},50);
}else{apply();}
})('${id}');`;
}
