/**
 * @fountain/podpay - Local Implementation
 * JavaScript/TypeScript library for Podcasting 2.0 payments and splits
 * 
 * This is a local implementation since the JSR package isn't available yet.
 * It provides the core functionality for handling V4V payments and splits.
 */

/**
 * PodPay class for handling Podcasting 2.0 payments and splits
 */
export class PodPay {
  constructor() {
    this.supportedPaymentMethods = ['lightning', 'keysend', 'lnurl'];
    this.supportedSplitTypes = ['percentage', 'fixed', 'proportional'];
  }

  /**
   * Parse value blocks from RSS feed XML
   * @param {Document} xmlDoc - Parsed XML document
   * @returns {Array} Array of parsed value blocks
   */
  parseValueBlocks(xmlDoc) {
    const valueBlocks = [];
    const items = xmlDoc.querySelectorAll('item');
    
    items.forEach((item, index) => {
      const valueBlock = item.querySelector('podcast\\:value, podcast:value');
      if (valueBlock) {
        const parsed = this.parseValueBlock(valueBlock, item, index);
        if (parsed) {
          valueBlocks.push(parsed);
        }
      }
    });
    
    return valueBlocks;
  }

  /**
   * Parse individual value block
   * @param {Element} valueBlock - Value block element
   * @param {Element} item - RSS item element
   * @param {number} index - Item index
   * @returns {Object} Parsed value block
   */
  parseValueBlock(valueBlock, item, index) {
    try {
      const type = valueBlock.getAttribute('type') || 'lightning';
      const suggested = valueBlock.getAttribute('suggested') || '0';
      
      const recipients = [];
      const recipientElements = valueBlock.querySelectorAll('podcast\\:valueRecipient, podcast:valueRecipient');
      
      recipientElements.forEach(recipient => {
        const name = recipient.getAttribute('name') || 'Unknown';
        const address = recipient.getAttribute('address') || '';
        const type = recipient.getAttribute('type') || 'lightning';
        const split = recipient.getAttribute('split') || '0';
        const fee = recipient.getAttribute('fee') || '0';
        
        recipients.push({
          name,
          address,
          type,
          split: parseInt(split) || 0,
          fee: parseInt(fee) || 0
        });
      });

      const title = item.querySelector('title')?.textContent || `Episode ${index + 1}`;
      const description = item.querySelector('description')?.textContent || '';
      const guid = item.querySelector('guid')?.textContent || '';
      
      return {
        type,
        suggested: parseInt(suggested) || 0,
        recipients,
        title,
        description,
        guid,
        index
      };
    } catch (error) {
      console.error('Error parsing value block:', error);
      return null;
    }
  }

  /**
   * Calculate payment splits based on recipient configuration
   * @param {number} amount - Payment amount in sats
   * @param {Array} recipients - Array of recipients
   * @returns {Array} Calculated splits
   */
  calculateSplits(amount, recipients) {
    const totalSplit = recipients.reduce((sum, r) => sum + r.split, 0);
    
    if (totalSplit === 0) {
      // Equal split if no specific splits defined
      const equalAmount = Math.floor(amount / recipients.length);
      return recipients.map(r => ({
        ...r,
        calculatedAmount: equalAmount,
        remaining: 0
      }));
    }
    
    let remaining = amount;
    const calculated = recipients.map(recipient => {
      const calculatedAmount = Math.floor((amount * recipient.split) / totalSplit);
      remaining -= calculatedAmount;
      
      return {
        ...recipient,
        calculatedAmount,
        remaining: 0
      };
    });
    
    // Distribute remaining sats to first recipient
    if (remaining > 0 && calculated.length > 0) {
      calculated[0].calculatedAmount += remaining;
      calculated[0].remaining = remaining;
    }
    
    return calculated;
  }

  /**
   * Generate Lightning invoice for payment
   * @param {string} address - Lightning address
   * @param {number} amount - Amount in sats
   * @param {string} description - Payment description
   * @returns {Promise<Object>} Invoice details
   */
  async generateInvoice(address, amount, description) {
    // This would integrate with Lightning services
    // For now, return a mock structure
    return {
      address,
      amount,
      description,
      invoice: `mock_invoice_${Date.now()}`,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Send keysend payment
   * @param {string} destination - Destination pubkey
   * @param {number} amount - Amount in sats
   * @param {string} message - Payment message
   * @returns {Promise<Object>} Payment result
   */
  async sendKeysend(destination, amount, message) {
    // This would integrate with Lightning wallet
    return {
      success: true,
      destination,
      amount,
      message,
      timestamp: new Date().toISOString(),
      preimage: `mock_preimage_${Date.now()}`
    };
  }

  /**
   * Validate Lightning address format
   * @param {string} address - Lightning address to validate
   * @returns {boolean} Is valid
   */
  validateLightningAddress(address) {
    if (!address) return false;
    
    // Basic Lightning address validation
    const pattern = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return pattern.test(address);
  }

  /**
   * Validate node pubkey format
   * @param {string} pubkey - Node pubkey to validate
   * @returns {boolean} Is valid
   */
  validateNodePubkey(pubkey) {
    if (!pubkey) return false;
    
    // Bitcoin pubkey validation (66 characters, starts with 02, 03, or 04)
    const pattern = /^[0-9a-fA-F]{66}$/;
    return pattern.test(pubkey) && /^[0234]/.test(pubkey);
  }

  /**
   * Generate metaBoost metadata
   * @param {Object} payment - Payment details
   * @param {Array} splits - Payment splits
   * @returns {Object} metaBoost metadata
   */
  generateMetaBoost(payment, splits) {
    return {
      action: 'boost',
      app: 'v4v-lightning-tester',
      boostID: `boost_${Date.now()}`,
      podcast: payment.podcast || 'unknown',
      episode: payment.episode || 'unknown',
      ts: Math.floor(Date.now() / 1000),
      value: {
        amount: payment.amount,
        currency: 'sats',
        type: 'lightning'
      },
      valueTimeSplits: splits.map(split => ({
        name: split.name,
        address: split.address,
        type: split.type,
        split: split.split,
        amount: split.calculatedAmount
      })),
      message: payment.message || ''
    };
  }

  /**
   * Generate TLV records for Lightning payments (Podcastindex style)
   * @param {Object} metadata - Payment metadata
   * @returns {Array} TLV records
   */
  generateTLVRecords(metadata) {
    const records = [];
    
    // Standard TLV record types used by Podcastindex
    const TLV_TYPES = {
      PODCAST_NAME: 7629169,
      PODCAST_EPISODE: 7629170,
      PODCAST_FEED_URL: 7629171,
      PODCAST_ITEM_GUID: 7629172,
      PODCAST_TS: 7629173,
      PODCAST_ACTION: 7629174,
      PODCAST_MESSAGE: 7629175,
      PODCAST_SENDER_NAME: 7629176,
      PODCAST_SENDER_ID: 7629177,
      PODCAST_APP: 7629178,
      PODCAST_EPISODE_URL: 7629179,
      PODCAST_PODCAST_URL: 7629180,
      PODCAST_EPISODE_TITLE: 7629181,
      PODCAST_PODCAST_TITLE: 7629182,
      PODCAST_EPISODE_ART: 7629183,
      PODCAST_PODCAST_ART: 7629184,
      PODCAST_EPISODE_DESCRIPTION: 7629185,
      PODCAST_PODCAST_DESCRIPTION: 7629186
    };

    // Add podcast name
    if (metadata.podcast) {
      records.push({
        type: TLV_TYPES.PODCAST_NAME,
        value: this.stringToBytes(metadata.podcast)
      });
    }

    // Add episode title
    if (metadata.episode) {
      records.push({
        type: TLV_TYPES.PODCAST_EPISODE_TITLE,
        value: this.stringToBytes(metadata.episode)
      });
    }

    // Add message
    if (metadata.message) {
      records.push({
        type: TLV_TYPES.PODCAST_MESSAGE,
        value: this.stringToBytes(metadata.message)
      });
    }

    // Add action
    if (metadata.action) {
      records.push({
        type: TLV_TYPES.PODCAST_ACTION,
        value: this.stringToBytes(metadata.action)
      });
    }

    // Add app name
    if (metadata.app) {
      records.push({
        type: TLV_TYPES.PODCAST_APP,
        value: this.stringToBytes(metadata.app)
      });
    }

    // Add timestamp
    if (metadata.ts) {
      records.push({
        type: TLV_TYPES.PODCAST_TS,
        value: this.intToBytes(metadata.ts)
      });
    }

    // Add feed URL if available
    if (metadata.feedUrl) {
      records.push({
        type: TLV_TYPES.PODCAST_FEED_URL,
        value: this.stringToBytes(metadata.feedUrl)
      });
    }

    // Add episode GUID if available
    if (metadata.episodeGuid) {
      records.push({
        type: TLV_TYPES.PODCAST_ITEM_GUID,
        value: this.stringToBytes(metadata.episodeGuid)
      });
    }

    return records;
  }

  /**
   * Convert string to bytes for TLV records
   * @param {string} str - String to convert
   * @returns {Uint8Array} Byte array
   */
  stringToBytes(str) {
    return new TextEncoder().encode(str);
  }

  /**
   * Convert integer to bytes for TLV records
   * @param {number} num - Number to convert
   * @returns {Uint8Array} Byte array
   */
  intToBytes(num) {
    const buffer = new ArrayBuffer(4);
    const view = new DataView(buffer);
    view.setUint32(0, num, false); // big-endian
    return new Uint8Array(buffer);
  }

  /**
   * Generate LNURL for Lightning address
   * @param {string} lightningAddress - Lightning address (e.g., chadf@getalby.com)
   * @returns {string} LNURL
   */
  generateLNURL(lightningAddress) {
    if (!this.validateLightningAddress(lightningAddress)) {
      throw new Error('Invalid Lightning address format');
    }
    
    const [username, domain] = lightningAddress.split('@');
    return `https://${domain}/.well-known/lnurlp/${username}`;
  }

  /**
   * Generate LNURL-pay invoice with TLV records
   * @param {string} lightningAddress - Lightning address
   * @param {number} amount - Amount in sats
   * @param {Object} metadata - Payment metadata for TLV records
   * @returns {Promise<Object>} LNURL-pay invoice with TLV data
   */
  async generateLNURLPayInvoice(lightningAddress, amount, metadata) {
    try {
      const lnurl = this.generateLNURL(lightningAddress);
      const tlvRecords = this.generateTLVRecords(metadata);
      
      // For now, return the structure - in a real implementation,
      // you'd make an HTTP request to the LNURL endpoint
      return {
        lnurl,
        lightningAddress,
        amount,
        metadata,
        tlvRecords,
        invoice: `mock_invoice_${Date.now()}`,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      throw new Error(`Failed to generate LNURL-pay invoice: ${error.message}`);
    }
  }

  /**
   * Generate keysend payment with TLV records
   * @param {string} destination - Destination pubkey
   * @param {number} amount - Amount in sats
   * @param {Object} metadata - Payment metadata for TLV records
   * @returns {Promise<Object>} Keysend payment with TLV data
   */
  async generateKeysendWithTLV(destination, amount, metadata) {
    try {
      const tlvRecords = this.generateTLVRecords(metadata);
      
      return {
        destination,
        amount,
        metadata,
        tlvRecords,
        timestamp: new Date().toISOString(),
        preimage: `mock_preimage_${Date.now()}`
      };
    } catch (error) {
      throw new Error(`Failed to generate keysend with TLV: ${error.message}`);
    }
  }

  /**
   * Parse TLV records from payment data
   * @param {Array} tlvRecords - TLV records to parse
   * @returns {Object} Parsed metadata
   */
  parseTLVRecords(tlvRecords) {
    const metadata = {};
    
    const TLV_TYPES = {
      PODCAST_NAME: 7629169,
      PODCAST_EPISODE: 7629170,
      PODCAST_FEED_URL: 7629171,
      PODCAST_ITEM_GUID: 7629172,
      PODCAST_TS: 7629173,
      PODCAST_ACTION: 7629174,
      PODCAST_MESSAGE: 7629175,
      PODCAST_SENDER_NAME: 7629176,
      PODCAST_SENDER_ID: 7629177,
      PODCAST_APP: 7629178,
      PODCAST_EPISODE_URL: 7629179,
      PODCAST_PODCAST_URL: 7629180,
      PODCAST_EPISODE_TITLE: 7629181,
      PODCAST_PODCAST_TITLE: 7629182,
      PODCAST_EPISODE_ART: 7629183,
      PODCAST_PODCAST_ART: 7629184,
      PODCAST_EPISODE_DESCRIPTION: 7629185,
      PODCAST_PODCAST_DESCRIPTION: 7629186
    };

    // Reverse lookup for TLV type names
    const typeNames = Object.fromEntries(
      Object.entries(TLV_TYPES).map(([name, value]) => [value, name])
    );

    tlvRecords.forEach(record => {
      const typeName = typeNames[record.type];
      if (typeName) {
        if (record.type === TLV_TYPES.PODCAST_TS) {
          // Parse timestamp as integer
          metadata[typeName] = this.bytesToInt(record.value);
        } else {
          // Parse as string
          metadata[typeName] = this.bytesToString(record.value);
        }
      }
    });

    return metadata;
  }

  /**
   * Convert bytes to string for TLV record parsing
   * @param {Uint8Array} bytes - Byte array to convert
   * @returns {string} String
   */
  bytesToString(bytes) {
    return new TextDecoder().decode(bytes);
  }

  /**
   * Convert bytes to integer for TLV record parsing
   * @param {Uint8Array} bytes - Byte array to convert
   * @returns {number} Integer
   */
  bytesToInt(bytes) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return view.getUint32(0, false); // big-endian
  }
}

/**
 * Utility functions for common operations
 */
export const PodPayUtils = {
  /**
   * Convert sats to BTC
   * @param {number} sats - Amount in sats
   * @returns {number} Amount in BTC
   */
  satsToBTC: (sats) => sats / 100000000,
  
  /**
   * Convert BTC to sats
   * @param {number} btc - Amount in BTC
   * @returns {number} Amount in sats
   */
  btcToSats: (btc) => Math.floor(btc * 100000000),
  
  /**
   * Format amount with currency
   * @param {number} amount - Amount
   * @param {string} currency - Currency (sats, BTC, USD)
   * @returns {string} Formatted amount
   */
  formatAmount: (amount, currency = 'sats') => {
    if (currency === 'sats') {
      return `${amount} sats`;
    } else if (currency === 'BTC') {
      return `${(amount / 100000000).toFixed(8)} BTC`;
    }
    return `${amount} ${currency}`;
  }
};

// Export default instance
export default new PodPay();
