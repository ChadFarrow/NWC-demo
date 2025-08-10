import { nip04, getPublicKey, getEventHash } from 'nostr-tools';
import * as nostrToolsAll from 'nostr-tools';
import { PodPay, PodPayUtils } from './podpay.js';

console.log('nostr-tools exports:', nostrToolsAll);

// Expose to window for use in script.js
window.nip04 = nip04;
window.getPublicKey = getPublicKey;
window.nostrTools = { getEventHash, finalizeEvent: nostrToolsAll.finalizeEvent };

// Expose PodPay functionality
window.PodPay = PodPay;
window.PodPayUtils = PodPayUtils;
window.podpay = new PodPay(); 