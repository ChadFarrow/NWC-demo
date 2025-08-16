// Clean version marker - this should load without errors
console.log('✅ nwcjs loading...');

var nwcjs = {
    nwc_infos: [],
    response: [],
    bytesToHex: bytes => Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join(''),
    hexToBytes: hex => {
        var result = new Uint8Array(hex.length / 2);
        for (let i = 0; i < hex.length; i += 2) {
            result[i / 2] = parseInt(hex.substr(i, 2), 16);
        }
        return result;
    },
    base64ToBytes: base64 => {
        var binary = atob(base64);
        var result = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            result[i] = binary.charCodeAt(i);
        }
        return result;
    },
    hexToBase64: hex => btoa(String.fromCharCode(...nwcjs.hexToBytes(hex))),
    base64ToHex: base64 => nwcjs.bytesToHex(nwcjs.base64ToBytes(base64)),
    stringToHex: str => nwcjs.bytesToHex(new TextEncoder().encode(str)),
    hexToString: hex => new TextDecoder().decode(nwcjs.hexToBytes(hex)),
    sha256: async text_or_bytes => {
        if (typeof text_or_bytes === "string") text_or_bytes = new TextEncoder().encode(text_or_bytes);
        var hash = await nobleSecp256k1.utils.sha256(text_or_bytes);
        return nwcjs.bytesToHex(hash);
    },
    processNWCstring: string => {
        if (!string.startsWith("nostr+walletconnect://")) return alert("Your pairing string was invalid, try one that starts with this: nostr+walletconnect://");
        string = string.substring(22);
        var arr = string.split("&");
        arr.splice(0, 1, ...arr[0].split("?"));
        arr[0] = "wallet_pubkey=" + arr[0];
        var arr2 = [];
        var obj = {};
        arr.forEach(item => arr2.push(...item.split("=")));
        arr2.forEach((item, index) => { if (item === "secret") arr2[index] = "app_privkey"; });
        arr2.forEach((item, index) => { if (index % 2) { obj[arr2[index - 1]] = item; } });
        obj["app_pubkey"] = nobleSecp256k1.getPublicKey(obj["app_privkey"], true).substring(2);
        obj["relay"] = obj["relay"].replaceAll("%3A", ":").replaceAll("%2F", "/");
        nwcjs.nwc_infos.push(obj);
        return obj;
    },
    payKeysend_OLD: async (nwc_info, destination, amount, message = '', seconds_of_delay_tolerable = 15) => {
        console.log('🔧 Using simplified payKeysend method');
        
        var msg = JSON.stringify({
            method: "pay_keysend",
            params: {
                destination: destination,
                amount: amount * 1000,
                message: message || ""
            }
        });
        
        var emsg = await nwcjs.encrypt(nwc_info["app_privkey"], nwc_info["wallet_pubkey"], msg);
        var obj = {
            kind: 23194,
            content: emsg,
            tags: [["p", nwc_info["wallet_pubkey"]]],
            created_at: Math.floor(Date.now() / 1000),
            pubkey: nwc_info["app_pubkey"],
        };
        
        var signed_event = await nwcjs.getSignedEvent(obj, nwc_info["app_privkey"]);
        var socket = new WebSocket(nwc_info["relay"]);
        
        socket.onopen = () => {
            socket.send(JSON.stringify(["EVENT", signed_event]));
        };
        
        socket.onmessage = async (message) => {
            var data = JSON.parse(message.data);
            if (data[0] === "EVENT") {
                var decrypted = await nwcjs.decrypt(nwc_info["app_privkey"], nwc_info["wallet_pubkey"], data[2].content);
                var parsed = JSON.parse(decrypted);
                nwcjs.response.push(parsed);
                socket.close();
            }
        };
        
        async function loop() {
            await nwcjs.waitSomeSeconds(0.1);
            var one_i_want;
            nwcjs.response.forEach((item, index) => {
                if (item["result_type"] === "pay_keysend") {
                    one_i_want = item;
                    nwcjs.response.splice(index, 1);
                    return;
                }
                return true;
            });
            if (one_i_want) return one_i_want;
            return await loop();
        }
        
        return await loop();
    },
    encrypt: async (privkey, pubkey, text) => {
        var key_raw = nwcjs.hexToBytes(nobleSecp256k1.getSharedSecret(privkey, '02' + pubkey, true).substring(2));
        var key = await window.crypto.subtle.importKey("raw", key_raw, "AES-CBC", false, ["encrypt", "decrypt"]);
        var iv = window.crypto.getRandomValues(new Uint8Array(16));
        var emsg = await window.crypto.subtle.encrypt({ name: "AES-CBC", iv: iv }, key, new TextEncoder().encode(text));
        emsg = nwcjs.hexToBase64(nwcjs.bytesToHex(emsg)) + "?iv=" + btoa(String.fromCharCode.apply(null, iv));
        return emsg;
    },
    decrypt: async (privkey, pubkey, ciphertext) => {
        var [emsg, iv] = ciphertext.split("?iv=");
        var key_raw = nwcjs.hexToBytes(nobleSecp256k1.getSharedSecret(privkey, '02' + pubkey, true).substring(2));
        var key = await window.crypto.subtle.importKey("raw", key_raw, "AES-CBC", false, ["encrypt", "decrypt"]);
        var decrypted = await window.crypto.subtle.decrypt({ name: "AES-CBC", iv: nwcjs.base64ToBytes(iv) }, key, nwcjs.base64ToBytes(emsg));
        return new TextDecoder().decode(decrypted);
    },
    waitSomeSeconds: num => new Promise(resolve => setTimeout(resolve, num * 1000)),
    getSignedEvent: async (event, privateKey) => {
        var eventData = JSON.stringify([0, event['pubkey'], event['created_at'], event['kind'], event['tags'], event['content']]);
        var eventHash = await nwcjs.sha256(eventData);
        var signature = nobleSecp256k1.schnorr.sign(eventHash, privateKey);
        event.id = eventHash;
        event.sig = signature;
        return event;
    }
};

console.log('✅ nwcjs loaded successfully');