// lib/security/password.ts

export interface PasswordOptions {
  length: number;
  uppercase: boolean;
  lowercase: boolean;
  numbers: boolean;
  symbols: boolean;
  excludeAmbiguous: boolean;
}

const CHARS = {
  uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  uppercaseClean: 'ABCDEFGHJKLMNPQRSTUVWXYZ',      // no I, O
  lowercase: 'abcdefghijklmnopqrstuvwxyz',
  lowercaseClean: 'abcdefghjkmnpqrstuvwxyz',       // no i, l, o
  numbers: '0123456789',
  numbersClean: '23456789',                          // no 0, 1
  symbols: '!@#$%^&*()_+-=[]{}|;:,.<>?',
};

export function generatePassword(opts: PasswordOptions): string {
  let charset = '';
  const required: string[] = [];

  if (opts.uppercase) {
    const pool = opts.excludeAmbiguous ? CHARS.uppercaseClean : CHARS.uppercase;
    charset += pool;
    required.push(pool[Math.floor(Math.random() * pool.length)]);
  }
  if (opts.lowercase) {
    const pool = opts.excludeAmbiguous ? CHARS.lowercaseClean : CHARS.lowercase;
    charset += pool;
    required.push(pool[Math.floor(Math.random() * pool.length)]);
  }
  if (opts.numbers) {
    const pool = opts.excludeAmbiguous ? CHARS.numbersClean : CHARS.numbers;
    charset += pool;
    required.push(pool[Math.floor(Math.random() * pool.length)]);
  }
  if (opts.symbols) {
    charset += CHARS.symbols;
    required.push(CHARS.symbols[Math.floor(Math.random() * CHARS.symbols.length)]);
  }
  if (!charset) charset = CHARS.lowercase;

  const arr = new Uint8Array(opts.length);
  crypto.getRandomValues(arr);
  const password = Array.from(arr).map((b) => charset[b % charset.length]);

  // Place required characters at random positions
  required.forEach((ch, i) => { password[i % opts.length] = ch; });

  // Shuffle
  for (let i = password.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [password[i], password[j]] = [password[j], password[i]];
  }

  return password.join('');
}

export function estimateStrength(password: string): { score: number; label: string; color: string } {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (password.length >= 16) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 2) return { score, label: 'Weak', color: 'text-red-500' };
  if (score <= 4) return { score, label: 'Fair', color: 'text-yellow-500' };
  if (score <= 5) return { score, label: 'Strong', color: 'text-blue-500' };
  return { score, label: 'Very Strong', color: 'text-green-500' };
}

