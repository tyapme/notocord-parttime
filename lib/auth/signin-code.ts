import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "crypto";

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 8;
const CODE_EXPIRES_MS = 10 * 60 * 1000;

type SigninChallengePayload = {
  email: string;
  userId: string;
  codeHash: string;
  tempPassword: string;
  expiresAt: number;
};

function getSecretKey(): Buffer {
  const secret =
    process.env.AUTH_CODE_SECRET ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "dev-auth-code-secret";
  return createHash("sha256").update(secret).digest();
}

function toBase64Url(value: Buffer): string {
  return value.toString("base64url");
}

function fromBase64Url(value: string): Buffer {
  return Buffer.from(value, "base64url");
}

function randomCodeRaw(): string {
  const bytes = randomBytes(CODE_LENGTH);
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    code += CODE_CHARS[bytes[i] % CODE_CHARS.length];
  }
  return code;
}

export function generateSigninCode(): string {
  const raw = randomCodeRaw();
  return `${raw.slice(0, 4)}-${raw.slice(4)}`;
}

export function normalizeSigninCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function isSigninCodeFormat(input: string): boolean {
  const normalized = normalizeSigninCode(input);
  if (normalized.length !== CODE_LENGTH) return false;
  return [...normalized].every((ch) => CODE_CHARS.includes(ch));
}

export function hashSigninCode(input: string): string {
  const normalized = normalizeSigninCode(input);
  return createHash("sha256").update(normalized).digest("hex");
}

export function generateTempPassword(): string {
  return randomBytes(24).toString("base64url");
}

export function createSigninChallenge(input: {
  email: string;
  userId: string;
  code: string;
  tempPassword: string;
}): { challenge: string; expiresAt: number } {
  const key = getSecretKey();
  const iv = randomBytes(12);
  const expiresAt = Date.now() + CODE_EXPIRES_MS;
  const payload: SigninChallengePayload = {
    email: input.email,
    userId: input.userId,
    codeHash: hashSigninCode(input.code),
    tempPassword: input.tempPassword,
    expiresAt,
  };
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    challenge: `${toBase64Url(iv)}.${toBase64Url(tag)}.${toBase64Url(encrypted)}`,
    expiresAt,
  };
}

export function parseSigninChallenge(challenge: string): SigninChallengePayload | null {
  try {
    const [ivPart, tagPart, bodyPart] = challenge.split(".");
    if (!ivPart || !tagPart || !bodyPart) return null;
    const key = getSecretKey();
    const decipher = createDecipheriv("aes-256-gcm", key, fromBase64Url(ivPart));
    decipher.setAuthTag(fromBase64Url(tagPart));
    const plaintext = Buffer.concat([
      decipher.update(fromBase64Url(bodyPart)),
      decipher.final(),
    ]).toString("utf8");
    const payload = JSON.parse(plaintext) as SigninChallengePayload;
    if (!payload?.email || !payload?.userId || !payload?.codeHash || !payload?.tempPassword || !payload?.expiresAt) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function verifyCodeHash(inputCode: string, expectedHash: string): boolean {
  const actual = Buffer.from(hashSigninCode(inputCode), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

export function challengeExpired(expiresAt: number): boolean {
  return Date.now() > expiresAt;
}
