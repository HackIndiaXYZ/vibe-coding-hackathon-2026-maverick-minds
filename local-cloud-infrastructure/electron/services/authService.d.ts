export interface AuthResult {
    success: boolean;
    token?: string;
    error?: string;
}
export declare function createSession(pin: string): Promise<AuthResult>;
export declare function validatePin(_pin: string): boolean;
export declare function isValidSession(token: string): boolean;
export declare function setPinHash(newPinHash: string): void;
