const INTERNAL_AUTH_DOMAIN = 'goodminton.invalid';

/**
 * Login accounts are case-insensitive and may contain Unicode. The visible
 * account stays in profiles.username; only this normalized value is hashed
 * into the synthetic email required by Supabase Email/Password Auth.
 */
export const normalizeAuthAccount = (account: string): string =>
  account.trim().normalize('NFKC').toLowerCase();

export const accountToInternalAuthEmail = async (account: string): Promise<string> => {
  const normalized = normalizeAuthAccount(account);
  if (!normalized) throw new Error('帳號不能空白。');
  if (!globalThis.crypto?.subtle) throw new Error('目前瀏覽器不支援安全帳號轉換，請改用最新版瀏覽器。');

  const digest = await globalThis.crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(normalized),
  );
  const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `u_${hash}@${INTERNAL_AUTH_DOMAIN}`;
};

export const looksLikeLegacyEmail = (account: string): boolean => /^\S+@\S+\.\S+$/.test(account.trim());
