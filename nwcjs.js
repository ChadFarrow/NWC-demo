// dependencies: noble-secp256k1 and bech32
// https://bundle.run/noble-secp256k1@1.2.14
// https://bundle.run/bech32@2.0.0
var nwcjs = {
    nwc_infos: [],
    response: [],
    hexToBytes: hex => Uint8Array.from( hex.match( /.{1,2}/g ).map( byte => parseInt( byte, 16 ) ) ),
    bytesToHex: bytes => bytes.reduce( ( str, byte ) => str + byte.toString( 16 ).padStart( 2, "0" ), "" ),
    hexToBase64: hex => btoa( hex.match( /\w{2}/g ).map( a => String.fromCharCode( parseInt( a, 16 ) ) ).join( "" ) ),
    base64ToHex: str => {
        var raw = atob( str );
        var result = '';
        var i; for ( i=0; i<raw.length; i++ ) {
            var hex = raw.charCodeAt( i ).toString( 16 );
            result += hex.length % 2 ? '0' + hex : hex;
        }
        return result.toLowerCase();
    },
    base64ToBytes: str => {
        var raw = atob( str );
        var result = [];
        var i; for ( i=0; i<raw.length; i++ ) result.push( raw.charCodeAt( i ) );
        return new Uint8Array( result );
    },
    sha256: async text_or_bytes => {
        if ( typeof text_or_bytes === "string" ) text_or_bytes = ( new TextEncoder().encode( text_or_bytes ) );
        var hash = await nobleSecp256k1.utils.sha256( text_or_bytes );
        return nwcjs.bytesToHex( hash );
    },
    processNWCstring: string => {
        try {
            if ( !string.startsWith( "nostr+walletconnect://" ) ) {
                alert( `Your pairing string was invalid, try one that starts with this: nostr+walletconnect://` );
                return null;
            }
            
            string = string.substring( 22 );
            var arr = string.split( "&" );
            arr.splice( 0, 1, ...arr[ 0 ].split( "?" ) );
            arr[ 0 ] = "wallet_pubkey=" + arr[ 0 ];
            var arr2 = [];
            var obj = {}
            arr.forEach( item => arr2.push( ...item.split( "=" ) ) );
            arr2.forEach( ( item, index ) => {if ( item === "secret" ) arr2[ index ] = "app_privkey";});
            arr2.forEach( ( item, index ) => {if ( index % 2 ) {obj[ arr2[ index - 1 ] ] = item;}});
            
            // Validate that we have the required fields
            if (!obj.app_privkey) {
                alert('Invalid NWC string: missing app_privkey (secret)');
                console.error('❌ Missing app_privkey in NWC string:', obj);
                return null;
            }
            
            if (!obj.wallet_pubkey) {
                alert('Invalid NWC string: missing wallet_pubkey');
                console.error('❌ Missing wallet_pubkey in NWC string:', obj);
                return null;
            }
            
            if (!obj.relay) {
                alert('Invalid NWC string: missing relay');
                console.error('❌ Missing relay in NWC string:', obj);
                return null;
            }
            
            // Validate private key format and generate public key
            try {
                console.log('🔑 Processing private key:', obj.app_privkey.substring(0, 10) + '...');
                obj[ "app_pubkey" ] = nobleSecp256k1.getPublicKey( obj[ "app_privkey" ], true ).substring( 2 );
                console.log('✅ Generated public key:', obj.app_pubkey.substring(0, 10) + '...');
            } catch (keyError) {
                console.error('❌ Private key validation failed:', keyError);
                alert(`Private key validation failed: ${keyError.message}\n\nPlease check your NWC connection string.`);
                return null;
            }
            
            obj[ "relay" ] = obj[ "relay" ].replaceAll( "%3A", ":" ).replaceAll( "%2F", "/" );
            console.log('🔗 Relay URL:', obj.relay);
            
            nwcjs.nwc_infos.push( obj );
            return obj;
        } catch (error) {
            console.error('❌ Error processing NWC string:', error);
            alert(`Failed to process NWC string: ${error.message}`);
            return null;
        }
    },
    
    // Helper function to validate NWC connection string format
    validateNWCString: string => {
        if (!string) {
            return { valid: false, error: 'No connection string provided' };
        }
        
        if (!string.startsWith('nostr+walletconnect://')) {
            return { 
                valid: false, 
                error: 'Connection string must start with "nostr+walletconnect://"' 
            };
        }
        
        // Check for required components
        const requiredParams = ['secret', 'relay'];
        const missingParams = [];
        
        requiredParams.forEach(param => {
            if (!string.includes(param + '=')) {
                missingParams.push(param);
            }
        });
        
        if (missingParams.length > 0) {
            return { 
                valid: false, 
                error: `Missing required parameters: ${missingParams.join(', ')}` 
            };
        }
        
        return { valid: true };
    },
    
    getSignedEvent: async ( event, privateKey ) => {
        var eventData = JSON.stringify([
            0,
            event['pubkey'],
            event['created_at'],
            event['kind'],
            event['tags'],
            event['content']
        ]);
        event.id  = await nwcjs.sha256( ( new TextEncoder().encode( eventData ) ) );
        event.sig = await nobleSecp256k1.schnorr.sign( event.id, privateKey );
        return event;
    },
    sendEvent: ( event, relay ) => {
        var socket = new WebSocket( relay );
        socket.addEventListener( 'open', async () => {
            socket.send( JSON.stringify( [ "EVENT", event ] ) );
            setTimeout( () => {socket.close();}, 1000 );
        });
        return event.id;
    },
    getEvents: async ( relay, ids, kinds, until, since, limit, etags, ptags, seconds_of_delay_tolerable = 3, debug ) => {
        var socket = new WebSocket( relay );
        var events = [];
        socket.addEventListener( 'message', async function( message ) {
            var [ type, subId, event ] = JSON.parse( message.data );
            var { kind, content } = event || {}
            if ( !event || event === true ) return;
            events.push( event );
        });
        socket.addEventListener( 'open', async function( e ) {
            var subId   = nwcjs.bytesToHex( nobleSecp256k1.utils.randomPrivateKey() ).substring( 0, 16 );
            var filter  = {}
            if ( ids ) filter.ids = ids;
            if ( kinds ) filter.kinds = kinds;
            if ( until ) filter.until = until;
            if ( since ) filter.since = since;
            if ( limit ) filter.limit = limit;
            if ( etags ) filter[ "#e" ] = etags;
            if ( ptags ) filter[ "#p" ] = ptags;
            var subscription = [ "REQ", subId, filter ];
            socket.send( JSON.stringify( subscription ) );
        });
        var num_of_seconds_waited = 0;
        var loop = async () => {
            await nwcjs.waitSomeSeconds( 1 );
            num_of_seconds_waited = num_of_seconds_waited + 1;
            var time_is_up = num_of_seconds_waited >= seconds_of_delay_tolerable;
            if ( debug ) console.log( `num_of_seconds_waited:`, num_of_seconds_waited, `out of`, seconds_of_delay_tolerable );
            if ( time_is_up ) {
                socket.close();
                return events;
            }
            if ( events.length > 0 ) {
                socket.close();
                return events;
            }
            if ( !time_is_up ) return await loop();
        }
        return await loop();
    },
    getResponse: async ( nwc_info, event_id, result_type, seconds_of_delay_tolerable = 3 ) => {
        var relay = nwc_info[ "relay" ];
        var ids = null;
        var kinds = [ 23195 ];
        var until = null;
        var since = null;
        var limit = 1;
        var etags = [ event_id ];
        var ptags = [ nwc_info[ "app_pubkey" ] ];
        var events = await nwcjs.getEvents( relay, ids, kinds, until, since, limit, etags, ptags, seconds_of_delay_tolerable );
        if ( !events.length ) {
            nwcjs.response.push({
                result_type,
                error: "timed out",
            })
            return;
        }
        var dmsg = await nwcjs.decrypt( nwc_info[ "app_privkey" ], events[ 0 ].pubkey, events[ 0 ].content );
        nwcjs.response.push( JSON.parse( dmsg ) );
    },
    getInfo: async ( nwc_info, seconds_of_delay_tolerable = 3 ) => {
        var msg = JSON.stringify({
            method: "get_info",
            params: {}
        });
        var emsg = await nwcjs.encrypt( nwc_info[ "app_privkey" ], nwc_info[ "wallet_pubkey" ], msg );
        var obj = {
            kind: 23194,
            content: emsg,
            tags: [ [ "p", nwc_info[ "wallet_pubkey" ] ] ],
            created_at: Math.floor( Date.now() / 1000 ),
            pubkey: nwc_info[ "app_pubkey" ],
        }
        var event = await nwcjs.getSignedEvent( obj, nwc_info[ "app_privkey" ] );
        var id = event.id;
        nwcjs.getResponse( nwc_info, id, "get_info", seconds_of_delay_tolerable );
        await nwcjs.waitSomeSeconds( 1 );
        var relay = nwc_info[ "relay" ];
        nwcjs.sendEvent( event, relay );
        var loop = async () => {
            await nwcjs.waitSomeSeconds( 1 );
            if ( !nwcjs.response.length ) return await loop();
            var one_i_want = null;
            nwcjs.response.every( ( item, index ) => {
                if ( item[ "result_type" ] === "get_info" ) {
                    one_i_want = item;
                    nwcjs.response.splice( index, 1 );
                    return;
                }
                return true;
            });
            if ( one_i_want ) return one_i_want;
            return await loop();
        }
        return await loop();
    },
    makeInvoice: async ( nwc_info, amt, desc, seconds_of_delay_tolerable = 3 ) => {
        var msg = JSON.stringify({
            method: "make_invoice",
            params: {
                amount: amt * 1000,
                description: desc,
            }
        });
        var emsg = await nwcjs.encrypt( nwc_info[ "app_privkey" ], nwc_info[ "wallet_pubkey" ], msg );
        var obj = {
            kind: 23194,
            content: emsg,
            tags: [ [ "p", nwc_info[ "wallet_pubkey" ] ] ],
            created_at: Math.floor( Date.now() / 1000 ),
            pubkey: nwc_info[ "app_pubkey" ],
        }
        var event = await nwcjs.getSignedEvent( obj, nwc_info[ "app_privkey" ] );
        var id = event.id;
        nwcjs.getResponse( nwc_info, id, "make_invoice", seconds_of_delay_tolerable );
        await nwcjs.waitSomeSeconds( 1 );
        var relay = nwc_info[ "relay" ];
        nwcjs.sendEvent( event, relay );
        var loop = async () => {
            await nwcjs.waitSomeSeconds( 1 );
            if ( !nwcjs.response.length ) return await loop();
            var one_i_want = null;
            nwcjs.response.every( ( item, index ) => {
                if ( item[ "result_type" ] === "make_invoice" ) {
                    one_i_want = item;
                    nwcjs.response.splice( index, 1 );
                    return;
                }
                return true;
            });
            if ( one_i_want ) return one_i_want;
            return await loop();
        }
        return await loop();
    },
    makeHodlInvoice: async ( nwc_info, amt, payment_hash, expiry, desc, desc_hash, seconds_of_delay_tolerable = 3 ) => {
        var msg = {
            method: "make_hodl_invoice",
            params: {
                amount: amt * 1000,
            }
        }
        if ( payment_hash ) msg.params.payment_hash = payment_hash;
        if ( expiry ) msg.params.expiry = expiry;
        if ( desc ) msg.params.description = desc;
        if ( desc_hash ) msg.params.desc_hash = desc_hash;
        msg = JSON.stringify( msg );
        var emsg = await nwcjs.encrypt( nwc_info[ "app_privkey" ], nwc_info[ "wallet_pubkey" ], msg );
        var obj = {
            kind: 23194,
            content: emsg,
            tags: [ [ "p", nwc_info[ "wallet_pubkey" ] ] ],
            created_at: Math.floor( Date.now() / 1000 ),
            pubkey: nwc_info[ "app_pubkey" ],
        }
        var event = await nwcjs.getSignedEvent( obj, nwc_info[ "app_privkey" ] );
        var id = event.id;
        nwcjs.getResponse( nwc_info, id, "make_hodl_invoice", seconds_of_delay_tolerable );
        await nwcjs.waitSomeSeconds( 1 );
        var relay = nwc_info[ "relay" ];
        nwcjs.sendEvent( event, relay );
        var loop = async () => {
            await nwcjs.waitSomeSeconds( 1 );
            if ( !nwcjs.response.length ) return await loop();
            var one_i_want = null;
            nwcjs.response.every( ( item, index ) => {
                if ( item[ "result_type" ] === "make_hodl_invoice" ) {
                    one_i_want = item;
                    nwcjs.response.splice( index, 1 );
                    return;
                }
                return true;
            });
            if ( one_i_want ) return one_i_want;
            return await loop();
        }
        return await loop();
    },
    settleHodlInvoice: async ( nwc_info, preimage, seconds_of_delay_tolerable = 3 ) => {
        var msg = JSON.stringify({
            method: "settle_hodl_invoice",
            params: {
                preimage,
            }
        });
        var emsg = await nwcjs.encrypt( nwc_info[ "app_privkey" ], nwc_info[ "wallet_pubkey" ], msg );
        var obj = {
            kind: 23194,
            content: emsg,
            tags: [ [ "p", nwc_info[ "wallet_pubkey" ] ] ],
            created_at: Math.floor( Date.now() / 1000 ),
            pubkey: nwc_info[ "app_pubkey" ],
        }
        var event = await nwcjs.getSignedEvent( obj, nwc_info[ "app_privkey" ] );
        var id = event.id;
        nwcjs.getResponse( nwc_info, id, "settle_hodl_invoice", seconds_of_delay_tolerable );
        await nwcjs.waitSomeSeconds( 1 );
        var relay = nwc_info[ "relay" ];
        nwcjs.sendEvent( event, relay );
        var loop = async () => {
            await nwcjs.waitSomeSeconds( 1 );
            if ( !nwcjs.response.length ) return await loop();
            var one_i_want = null;
            nwcjs.response.every( ( item, index ) => {
                if ( item[ "result_type" ] === "settle_hodl_invoice" ) {
                    one_i_want = item;
                    nwcjs.response.splice( index, 1 );
                    return;
                }
                return true;
            });
            if ( one_i_want ) return one_i_want;
            return await loop();
        }
        return await loop();
    },
    cancelHodlInvoice: async ( nwc_info, payment_hash, seconds_of_delay_tolerable = 3 ) => {
        var msg = JSON.stringify({
            method: "cancel_hodl_invoice",
            params: {
                payment_hash,
            }
        });
        var emsg = await nwcjs.encrypt( nwc_info[ "app_privkey" ], nwc_info[ "wallet_pubkey" ], msg );
        var obj = {
            kind: 23194,
            content: emsg,
            tags: [ [ "p", nwc_info[ "wallet_pubkey" ] ] ],
            created_at: Math.floor( Date.now() / 1000 ),
            pubkey: nwc_info[ "app_pubkey" ],
        }
        var event = await nwcjs.getSignedEvent( obj, nwc_info[ "app_privkey" ] );
        var id = event.id;
        nwcjs.getResponse( nwc_info, id, "cancel_hodl_invoice", seconds_of_delay_tolerable );
        await nwcjs.waitSomeSeconds( 1 );
        var relay = nwc_info[ "relay" ];
        nwcjs.sendEvent( event, relay );
        var loop = async () => {
            await nwcjs.waitSomeSeconds( 1 );
            if ( !nwcjs.response.length ) return await loop();
            var one_i_want = null;
            nwcjs.response.every( ( item, index ) => {
                if ( item[ "result_type" ] === "cancel_hodl_invoice" ) {
                    one_i_want = item;
                    nwcjs.response.splice( index, 1 );
                    return;
                }
                return true;
            });
            if ( one_i_want ) return one_i_want;
            return await loop();
        }
        return await loop();
    },
    checkInvoice: async ( nwc_info, invoice, seconds_of_delay_tolerable = 3 ) => {
        var msg = JSON.stringify({
            method: "lookup_invoice",
            params: {
                invoice,
                bolt11: invoice,
            }
        });
        var emsg = await nwcjs.encrypt( nwc_info[ "app_privkey" ], nwc_info[ "wallet_pubkey" ], msg );
        var obj = {
            kind: 23194,
            content: emsg,
            tags: [ [ "p", nwc_info[ "wallet_pubkey" ] ] ],
            created_at: Math.floor( Date.now() / 1000 ),
            pubkey: nwc_info[ "app_pubkey" ],
        }
        var event = await nwcjs.getSignedEvent( obj, nwc_info[ "app_privkey" ] );
        var id = event.id;
        nwcjs.getResponse( nwc_info, id, "lookup_invoice", seconds_of_delay_tolerable );
        await nwcjs.waitSomeSeconds( 1 );
        var relay = nwc_info[ "relay" ];
        nwcjs.sendEvent( event, relay );
        var loop = async () => {
            await nwcjs.waitSomeSeconds( 1 );
            if ( !nwcjs.response.length ) return await loop();
            var one_i_want = null;
            nwcjs.response.every( ( item, index ) => {
                if ( item[ "result_type" ] === "lookup_invoice" ) {
                    one_i_want = item;
                    nwcjs.response.splice( index, 1 );
                    return;
                }
                return true;
            });
            if ( one_i_want ) return one_i_want;
            return await loop();
        }
        return await loop();
        // an error looks like this:
        // {error: {code: "INTERNAL", message: "Something went wrong while looking up invoice: "}, result_type: "lookup_invoice"}
    },
    didPaymentSucceed: async ( nwc_info, invoice, seconds_of_delay_tolerable = 3 ) => {
        var invoice_info = await nwcjs.checkInvoice( nwc_info, invoice, seconds_of_delay_tolerable );
        if ( invoice_info && "result" in invoice_info && "preimage" in invoice_info[ "result" ] && invoice_info[ "result" ][ "preimage" ] )
            return invoice_info[ "result" ][ "preimage" ];
        return false;
    },
    tryToPayInvoice: async ( nwc_info, invoice, amnt ) => {
        var msg = {
            method: "pay_invoice",
            params: {
                invoice,
            }
        }
        if ( amnt ) msg[ "params" ][ "amount" ] = amnt;
        msg = JSON.stringify( msg );
        var emsg = await nwcjs.encrypt( nwc_info[ "app_privkey" ], nwc_info[ "wallet_pubkey" ], msg );
        var obj = {
            kind: 23194,
            content: emsg,
            tags: [ [ "p", nwc_info[ "wallet_pubkey" ] ] ],
            created_at: Math.floor( Date.now() / 1000 ),
            pubkey: nwc_info[ "app_pubkey" ],
        }
        var event = await nwcjs.getSignedEvent( obj, nwc_info[ "app_privkey" ] );
        var id = event.id;
        var relay = nwc_info[ "relay" ];
        nwcjs.sendEvent( event, relay );
    },
    getBalance: async ( nwc_info, seconds_of_delay_tolerable = 3 ) => {
        var msg = {
            method: "get_balance",
            params: {}
        }
        msg = JSON.stringify( msg );
        var emsg = await nwcjs.encrypt( nwc_info[ "app_privkey" ], nwc_info[ "wallet_pubkey" ], msg );
        var obj = {
            kind: 23194,
            content: emsg,
            tags: [ [ "p", nwc_info[ "wallet_pubkey" ] ] ],
            created_at: Math.floor( Date.now() / 1000 ),
            pubkey: nwc_info[ "app_pubkey" ],
        }
        var event = await nwcjs.getSignedEvent( obj, nwc_info[ "app_privkey" ] );
        var id = event.id;
        nwcjs.getResponse( nwc_info, id, "get_balance", seconds_of_delay_tolerable );
        await nwcjs.waitSomeSeconds( 1 );
        var relay = nwc_info[ "relay" ];
        nwcjs.sendEvent( event, relay );
        var loop = async () => {
            await nwcjs.waitSomeSeconds( 1 );
            if ( !nwcjs.response.length ) return await loop();
            var one_i_want = null;
            nwcjs.response.every( ( item, index ) => {
                if ( item[ "result_type" ] === "get_balance" ) {
                    one_i_want = item;
                    nwcjs.response.splice( index, 1 );
                    return;
                }
                return true;
            });
            if ( one_i_want ) return one_i_want;
            return await loop();
        }
        return await loop();
    },
    listTransactions: async ( nwc_info, from = null, until = null, limit = null, offset = null, unpaid = null, type = undefined, seconds_of_delay_tolerable = 3 ) => {
        var msg = {
            method: "list_transactions",
            params: {}
        }
        if ( from ) msg.params.from = from;
        if ( until ) msg.params.until = until;
        if ( limit ) msg.params.limit = limit;
        if ( offset ) msg.params.offset = offset;
        if ( unpaid ) msg.params.unpaid = unpaid;
        if ( type ) msg.params.type = type;
        msg = JSON.stringify( msg );
        var emsg = await nwcjs.encrypt( nwc_info[ "app_privkey" ], nwc_info[ "wallet_pubkey" ], msg );
        var obj = {
            kind: 23194,
            content: emsg,
            tags: [ [ "p", nwc_info[ "wallet_pubkey" ] ] ],
            created_at: Math.floor( Date.now() / 1000 ),
            pubkey: nwc_info[ "app_pubkey" ],
        }
        var event = await nwcjs.getSignedEvent( obj, nwc_info[ "app_privkey" ] );
        var id = event.id;
        nwcjs.getResponse( nwc_info, id, "list_transactions", seconds_of_delay_tolerable );
        await nwcjs.waitSomeSeconds( 1 );
        var relay = nwc_info[ "relay" ];
        nwcjs.sendEvent( event, relay );
        var loop = async () => {
            await nwcjs.waitSomeSeconds( 1 );
            if ( !nwcjs.response.length ) return await loop();
            var one_i_want = null;
            nwcjs.response.every( ( item, index ) => {
                if ( item[ "result_type" ] === "list_transactions" ) {
                    one_i_want = item;
                    nwcjs.response.splice( index, 1 );
                    return;
                }
                return true;
            });
            if ( one_i_want ) return one_i_want;
            return await loop();
        }
        return await loop();
    },
    encrypt: async ( privkey, pubkey, text ) => {
        var msg = ( new TextEncoder() ).encode( text );
        var iv = window.crypto.getRandomValues( new Uint8Array( 16 ) );
        var key_raw = nwcjs.hexToBytes( nobleSecp256k1.getSharedSecret( privkey, '02' + pubkey, true ).substring( 2 ) );
        var key = await window.crypto.subtle.importKey(
            "raw",
            key_raw,
            "AES-CBC",
            false,
            [ "encrypt", "decrypt" ],
        );
        var emsg = await window.crypto.subtle.encrypt(
            {
                name: "AES-CBC",
                iv,
            },
            key,
            msg,
        )
        emsg = new Uint8Array( emsg );
        var arr = emsg;
        emsg = nwcjs.hexToBase64( nwcjs.bytesToHex( emsg ) ) + "?iv=" + btoa( String.fromCharCode.apply( null, iv ) );
        return emsg;
    },
    decrypt: async ( privkey, pubkey, ciphertext ) => {
        var [ emsg, iv ] = ciphertext.split( "?iv=" );
        var key_raw = nwcjs.hexToBytes( nobleSecp256k1.getSharedSecret( privkey, '02' + pubkey, true ).substring( 2 ) );
        var key = await window.crypto.subtle.importKey(
            "raw",
            key_raw,
            "AES-CBC",
            false,
            [ "encrypt", "decrypt" ],
        );
        var decrypted = await window.crypto.subtle.decrypt(
            {
                name: "AES-CBC",
                iv: nwcjs.base64ToBytes( iv ),
            },
            key,
            nwcjs.base64ToBytes( emsg ),
        );
        var msg = ( new TextDecoder() ).decode( decrypted );
        return msg;
    },
    waitSomeSeconds: num => {
        var num = num.toString() + "000";
        num = Number( num );
        return new Promise( resolve => setTimeout( resolve, num ) );
    },
    getZapRequest: async ( lnaddy, amount, relays = ["wss://nostrue.com"] ) => {
        amount = amount * 1000;
        var endpoint = lnaddy.split( "@" );
        var url = "https://" + endpoint[ 1 ] + "/.well-known/lnurlp/" + endpoint[ 0 ];
        var url_bytes = new TextEncoder().encode( url );
        var lnurl = bech32.bech32.encode( "lnurl", bech32.bech32.toWords( url_bytes ), 100_000 );
        var data = await fetch( url );
        data = await data.json();
        var serverpub = data[ "nostrPubkey" ];
        var privkey = nwcjs.bytesToHex( nobleSecp256k1.utils.randomPrivateKey() );
        var pubkey = nobleSecp256k1.getPublicKey( privkey, true ).substring( 2 );
        var obj = {
            kind: 9734,
            content: "",
            tags: [
              [ "relays", ...relays ],
              [ "amount", `${amount}` ],
              [ "p", serverpub ],
              [ "e", pubkey ],
              [ "lnurl", lnurl ],
            ],
            created_at: Math.floor( Date.now() / 1000 ),
            pubkey: pubkey,
        }
        var event = await nwcjs.getSignedEvent( obj, privkey );
        var id = event.id;
        var encoded = encodeURI( JSON.stringify( event ) );
        var callback = data[ "callback" ] + "?amount=" + amount + "&nostr=" + encoded + "&lnurl=" + lnurl;
        var invoice_data = await fetch( callback );
        var {pr: invoice} = await invoice_data.json();
        var checking_id = pubkey;
        return [ invoice, checking_id ];
    },
    checkZapStatus: async ( invoice, checking_id, relays = ["wss://nostrue.com"] ) => {
        var bolt11;
        var events = await nwcjs.getEvents( relays[ 0 ], null, [ 9735 ], null, null, 1, [ checking_id ], null, 3 );
        if ( !events.length ) return "not paid yet";
        var receipt = events[ 0 ];
        receipt.tags.every( item => {
            if ( item[ 0 ] !== "bolt11" ) return true;
            bolt11 = item[ 1 ];
            return;
        });
        if ( bolt11 != invoice ) return "not paid yet";
        return events[ 0 ];
    },
    payKeysend: async ( nwc_info, destination, amount, message = '', seconds_of_delay_tolerable = 15 ) => {
        console.log('🔧 Using nwcjs.payKeysend method - FIXED VERSION');
        console.log('Input destination:', destination, 'Length:', destination?.length);
        
        // Validate and normalize pubkey
        if (!destination || typeof destination !== 'string') {
            throw new Error('Invalid destination: must be a non-empty string');
        }
        
        // Remove any whitespace and convert to lowercase
        destination = destination.trim().toLowerCase();
        
        // Check if it's a valid hex string
        if (!/^[0-9a-f]+$/.test(destination)) {
            throw new Error('Invalid destination: must be a hex string');
        }
        
        // Ensure proper length (33 bytes = 66 hex chars for compressed pubkey)
        if (destination.length !== 66) {
            if (destination.length === 64) {
                // Add compression prefix if missing
                destination = '02' + destination;
                console.log('Added compression prefix, new destination:', destination);
            } else {
                throw new Error(`Invalid pubkey length: ${destination.length} (expected 66 characters for compressed pubkey)`);
            }
        }
        
        // Validate compression prefix
        const prefix = destination.substring(0, 2);
        if (prefix !== '02' && prefix !== '03') {
            console.warn(`Unusual pubkey prefix: ${prefix} (expected 02 or 03)`);
        }
        
        console.log('Using validated pubkey:', destination);
        
        // Use multi_pay_keysend which works better with Alby
        console.log('Switching to multiPayKeysend for better compatibility...');
        
        const keysendArray = [{
            pubkey: destination,
            amount: amount * 1000, // Convert sats to msat
            tlv_records: message ? [{
                type: 34349334,
                value: nwcjs.bytesToHex(new TextEncoder().encode(message))
            }] : []
        }];
        
        console.log('Calling multiPayKeysend with:', keysendArray);
        
        try {
            // Use payKeysend_OLD for single payments instead of multiPayKeysend
            console.log('🔄 Using payKeysend_OLD for single payment...');
            const result = await nwcjs.payKeysend_OLD(nwc_info, destination, amount, message, seconds_of_delay_tolerable);
            console.log('payKeysend_OLD result:', result);
            
            if (result && result.result) {
                console.log('✅ Keysend successful');
                return result;
            } else if (result && result.error) {
                throw new Error(`Keysend failed: ${JSON.stringify(result.error)}`);
            } else {
                throw new Error('Keysend failed: No result or error returned');
            }
        } catch (error) {
            console.error('❌ Keysend error:', error);
            throw error;
        }
    },
    payInvoice: async ( nwc_info, invoice, seconds_of_delay_tolerable = 15 ) => {
        console.log('🔧 Using nwcjs.payInvoice method');
        
        var msg = JSON.stringify({
            method: "pay_invoice",
            params: {
                invoice: invoice
            }
        });
        
        var emsg = await nwcjs.encrypt( nwc_info[ "app_privkey" ], nwc_info[ "wallet_pubkey" ], msg );
        var obj = {
            kind: 23194,
            content: emsg,
            tags: [ [ "p", nwc_info[ "wallet_pubkey" ] ] ],
            created_at: Math.floor( Date.now() / 1000 ),
            pubkey: nwc_info[ "app_pubkey" ],
        }
        var event = await nwcjs.getSignedEvent( obj, nwc_info[ "app_privkey" ] );
        var id = event.id;
        nwcjs.getResponse( nwc_info, id, "pay_invoice", seconds_of_delay_tolerable );
        await nwcjs.waitSomeSeconds( 1 );
        var relay = nwc_info[ "relay" ];
        nwcjs.sendEvent( event, relay );
        
        var loop = async () => {
            await nwcjs.waitSomeSeconds( 1 );
            if ( !nwcjs.response.length ) return await loop();
            var one_i_want = null;
            nwcjs.response.every( ( item, index ) => {
                if ( item[ "result_type" ] === "pay_invoice" ) {
                    one_i_want = item;
                    nwcjs.response.splice( index, 1 );
                    return;
                }
                return true;
            });
            if ( one_i_want ) {
                console.log(`pay_invoice response:`, one_i_want);
                return one_i_want;
            }
            return await loop();
        }
        
        return await loop();
    },
    // Remember successful format for future payments
    lastWorkingKeysendFormat: null,
    
    payKeysend_OLD: async ( nwc_info, destination, amount, message = '', seconds_of_delay_tolerable = 15 ) => {
        console.log('🔧 Using nwcjs.payKeysend_OLD method');
        
        // Validate destination before creating formats
        if (!destination || destination.length === 0) {
            throw new Error('Invalid destination: empty or null destination provided');
        }
        
        // Create all possible destination formats
        var allFormats = [
            { name: 'pubkey', value: destination, params: { pubkey: destination } },
            { name: 'node_id', value: destination, params: { node_id: destination } },
            { name: 'compressed_pubkey', value: destination.length === 66 ? destination : '02' + destination, params: { pubkey: destination.length === 66 ? destination : '02' + destination } },
            { name: 'original', value: destination, params: { destination: destination } },
            { name: 'raw_hex', value: destination.length === 66 ? destination.slice(2) : destination, params: { destination: destination.length === 66 ? destination.slice(2) : destination } },
            { name: 'uncompressed_pubkey', value: destination.length === 64 ? '02' + destination : destination, params: { destination: destination.length === 64 ? '02' + destination : destination } }
        ];
        
        // If we know a format that worked before, try it first
        var destinationFormats = [];
        if (nwcjs.lastWorkingKeysendFormat) {
            const workingFormat = allFormats.find(f => f.name === nwcjs.lastWorkingKeysendFormat);
            if (workingFormat) {
                console.log(`🎯 Trying last working format first: ${nwcjs.lastWorkingKeysendFormat}`);
                destinationFormats.push(workingFormat);
                // Add remaining formats
                destinationFormats.push(...allFormats.filter(f => f.name !== nwcjs.lastWorkingKeysendFormat));
            } else {
                destinationFormats = allFormats;
            }
        } else {
            destinationFormats = allFormats;
        }
        
        // Validate all formats have non-empty destinations
        destinationFormats = destinationFormats.filter(format => {
            if (!format.value || format.value.length === 0) {
                console.warn(`❌ Skipping ${format.name} format: empty destination`);
                return false;
            }
            return true;
        });
        
        console.log('Trying keysend with destination formats:', {
            original_length: destinationFormats[0].value.length,
            raw_hex_length: destinationFormats[1].value.length,
            sample: destination.substring(0, 16) + '...',
            total_formats: destinationFormats.length
        });
        
        // Try each format until one works
        var formatErrors = [];
        for (let i = 0; i < destinationFormats.length; i++) {
            const format = destinationFormats[i];
            console.log(`Trying format ${i + 1}/${destinationFormats.length}: ${format.name}`);
            
            try {
                var msg = JSON.stringify({
                    method: "pay_keysend",
                    params: {
                        ...format.params,
                        amount: amount * 1000, // Convert sats to msat
                        message: message || ""
                    }
                });
                
                console.log(`📤 Sending ${format.name} format:`, {
                    method: "pay_keysend",
                    params: format.params,
                    amount_msat: amount * 1000,
                    message: message || ""
                });
                
                var emsg = await nwcjs.encrypt( nwc_info[ "app_privkey" ], nwc_info[ "wallet_pubkey" ], msg );
                var obj = {
                    kind: 23194,
                    content: emsg,
                    tags: [ [ "p", nwc_info[ "wallet_pubkey" ] ] ],
                    created_at: Math.floor( Date.now() / 1000 ),
                    pubkey: nwc_info[ "app_pubkey" ],
                }
                var event = await nwcjs.getSignedEvent( obj, nwc_info[ "app_privkey" ] );
                var id = event.id;
                nwcjs.getResponse( nwc_info, id, "pay_keysend", seconds_of_delay_tolerable );
                await nwcjs.waitSomeSeconds( 1 );
                var relay = nwc_info[ "relay" ];
                nwcjs.sendEvent( event, relay );
                
                var loop = async () => {
                    await nwcjs.waitSomeSeconds( 1 );
                    if ( !nwcjs.response.length ) return await loop();
                    var one_i_want = null;
                    nwcjs.response.every( ( item, index ) => {
                        if ( item[ "result_type" ] === "pay_keysend" ) {
                            one_i_want = item;
                            nwcjs.response.splice( index, 1 );
                            return;
                        }
                        return true;
                    });
                    if ( one_i_want ) {
                        console.log(`payKeysend response found with format ${format.name}:`, one_i_want);
                        if (one_i_want.error) {
                            console.log(`🔍 Error details for format ${format.name}:`, {
                                error: one_i_want.error,
                                error_type: typeof one_i_want.error,
                                error_keys: one_i_want.error ? Object.keys(one_i_want.error) : 'no keys',
                                format_used: format.name,
                                destination_value: format.value,
                                destination_length: format.value.length
                            });
                        }
                        return one_i_want;
                    }
                    return await loop();
                }
                
                const result = await loop();
                if (result && result.error) {
                    const errorMsg = `Format ${format.name}: ${JSON.stringify(result.error)}`;
                    console.log(`❌ ${errorMsg}`);
                    formatErrors.push(errorMsg);
                    // Continue to next format if this one failed
                    continue;
                } else if (result && result.result) {
                    console.log(`✅ Keysend successful with format: ${format.name}`);
                    // Remember this format for future payments
                    nwcjs.lastWorkingKeysendFormat = format.name;
                    console.log(`💾 Saved working format: ${format.name}`);
                    return result;
                } else {
                    const errorMsg = `Format ${format.name}: Unexpected response format - ${JSON.stringify(result)}`;
                    console.log(`❌ ${errorMsg}`);
                    formatErrors.push(errorMsg);
                    // Continue to next format if this one failed
                    continue;
                }
            } catch (error) {
                const errorMsg = `Format ${format.name}: ${error.message}`;
                console.log(`❌ ${errorMsg}`);
                formatErrors.push(errorMsg);
                // Continue to next format if this one errored
                continue;
            }
        }
        
        // If all formats failed, provide detailed error information
        const detailedError = formatErrors.length > 0 
            ? `All keysend destination formats failed:\n${formatErrors.join('\n')}`
            : 'All keysend destination formats failed - no specific error details available';
        throw new Error(detailedError);
    }
}
