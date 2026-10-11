export const publicNames: string[];
export function publicConfig(env: Record<string, string | undefined>): Record<string, string>;
export function verifyRuntime(env: Record<string, string | undefined>, built: Record<string, string>): void;
