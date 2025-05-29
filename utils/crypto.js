const crypto = require('crypto');
const CryptoJS = require('crypto-js');

class CryptoUtils {
  
  // Generate key pair for wallet
  static generateKeyPair() {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem'
      }
    });

    return { publicKey, privateKey };
  }

  // Generate wallet address from public key
  static generateAddress(publicKey) {
    return crypto
      .createHash('sha256')
      .update(publicKey)
      .digest('hex')
      .substring(0, 40);
  }

  // Create digital signature
  static signData(data, privateKey) {
    const sign = crypto.createSign('SHA256');
    sign.update(data);
    sign.end();
    return sign.sign(privateKey, 'hex');
  }

  // Verify digital signature
  static verifySignature(data, signature, publicKey) {
    try {
      const verify = crypto.createVerify('SHA256');
      verify.update(data);
      verify.end();
      return verify.verify(publicKey, signature, 'hex');
    } catch (error) {
      return false;
    }
  }

  // Calculate hash of data
  static calculateHash(data) {
    return crypto
      .createHash('sha256')
      .update(JSON.stringify(data))
      .digest('hex');
  }

  // Calculate merkle root from array of hashes
  static calculateMerkleRoot(hashes) {
    if (hashes.length === 0) {
      return crypto.createHash('sha256').update('').digest('hex');
    }
    
    if (hashes.length === 1) {
      return hashes[0];
    }

    const newHashes = [];
    
    for (let i = 0; i < hashes.length; i += 2) {
      const left = hashes[i];
      const right = hashes[i + 1] || left; // If odd number, duplicate last hash
      const combined = left + right;
      newHashes.push(crypto.createHash('sha256').update(combined).digest('hex'));
    }

    return this.calculateMerkleRoot(newHashes);
  }

  // Calculate block hash with nonce
  static calculateBlockHash(index, previousHash, timestamp, merkleRoot, nonce) {
    const data = `${index}${previousHash}${timestamp}${merkleRoot}${nonce}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  // Mine block (Proof of Work)
  static mineBlock(index, previousHash, timestamp, merkleRoot, difficulty) {
    const target = '0'.repeat(difficulty);
    let nonce = 0;
    let hash;

    do {
      nonce++;
      hash = this.calculateBlockHash(index, previousHash, timestamp, merkleRoot, nonce);
    } while (!hash.startsWith(target));

    return { hash, nonce };
  }

  // Create transaction hash
  static createTransactionHash(fromWallet, toWallet, amount, timestamp, nonce = 0) {
    const data = `${fromWallet}${toWallet}${amount}${timestamp}${nonce}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  // Generate random transaction nonce
  static generateNonce() {
    return Math.floor(Math.random() * 1000000);
  }

  // Encrypt private key for storage
  static encryptPrivateKey(privateKey, password) {
    return CryptoJS.AES.encrypt(privateKey, password).toString();
  }

  // Decrypt private key
  static decryptPrivateKey(encryptedKey, password) {
    try {
      const bytes = CryptoJS.AES.decrypt(encryptedKey, password);
      return bytes.toString(CryptoJS.enc.Utf8);
    } catch (error) {
      throw new Error('Failed to decrypt private key');
    }
  }

  // Validate hash format
  static isValidHash(hash) {
    return /^[a-fA-F0-9]{64}$/.test(hash);
  }

  // Validate address format
  static isValidAddress(address) {
    return /^[a-fA-F0-9]{40}$/.test(address);
  }
}

module.exports = CryptoUtils; 