export interface SurveillanceFile {
    id: string;
    name: string;
    size: number;
    createdAt: number;
}
/** Returns true if a vault password has been set. */
export declare function hasVaultPassword(): boolean;
/**
 * Set or change the vault password.
 * If one already exists, `currentPassword` must be provided and correct.
 */
export declare function setVaultPassword(newPassword: string, currentPassword?: string): {
    success: boolean;
    error?: string;
};
/**
 * Verify a vault password.
 * Returns `{ valid: true }` on success or `{ valid: false, error }` on failure.
 */
export declare function checkVaultPassword(password: string): {
    valid: boolean;
    error?: string;
};
/** List all encrypted footage files in the surveillance directory. */
export declare function listSurveillanceFiles(): SurveillanceFile[];
/**
 * Save an encrypted footage file to the surveillance directory.
 * The `encryptedBuffer` must have been produced by `encryptWithPassword()`.
 */
export declare function saveSurveillanceFile(fileName: string, encryptedBuffer: Buffer): {
    success: boolean;
    id?: string;
    error?: string;
};
/**
 * Decrypt a surveillance file and return its raw bytes.
 * Throws if the password is wrong (GCM auth tag mismatch).
 */
export declare function decryptSurveillanceFile(id: string, password: string): Buffer;
/**
 * Delete a surveillance file permanently.
 */
export declare function deleteSurveillanceFile(id: string): {
    success: boolean;
    error?: string;
};
