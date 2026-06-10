export declare function encrypt(plaintext: Buffer): Buffer;
export declare function decrypt(ciphertext: Buffer): Buffer;
export declare function encryptWithPassword(plaintext: Buffer, password: string): Buffer;
export declare function decryptWithPassword(ciphertext: Buffer, password: string): Buffer;
export declare function hashVaultPassword(password: string): string;
export declare function verifyVaultPassword(password: string, stored: string): boolean;
export declare function generateKey(): string;
export declare function safeEquals(a: Buffer, b: Buffer): boolean;
