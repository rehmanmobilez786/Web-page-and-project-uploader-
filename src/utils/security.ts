import { ExtractedFile } from '../types';

export interface DetectedSecret {
  filePath: string;
  line: number;
  type: string;
  description: string;
  matchedTextMasked: string;
  rawMatchedText: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
}

export interface SecurityAuditResult {
  isSafe: boolean;
  score: number; // 0 to 100
  secretsDetected: DetectedSecret[];
  bloatedFiles: { path: string; size: number; reason: string }[];
  recommendations: string[];
  recommendationsUrdu: string[];
  hasCriticalRisk: boolean;
}

export interface TokenSecurityReport {
  isSafeScope: boolean;
  hasWorkflowScope: boolean;
  hasOverprivilegedScope: boolean;
  scopes: string[];
  warningMessage?: string;
  warningMessageUrdu?: string;
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  resetTime: Date;
  isNearingLimit: boolean;
}

// Common secret patterns that trigger GitHub secret scanning or account flags
const SECRET_PATTERNS: {
  type: string;
  regex: RegExp;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  replacement: string;
}[] = [
  {
    type: 'GitHub Personal Access Token (Classic)',
    regex: /ghp_[a-zA-Z0-9]{36}/g,
    description: 'Exposed GitHub Classic Personal Access Token',
    severity: 'critical',
    replacement: 'ghp_YOUR_GITHUB_PAT_TOKEN_HERE'
  },
  {
    type: 'GitHub Fine-Grained Token',
    regex: /github_pat_[a-zA-Z0-9_]{50,}/g,
    description: 'Exposed GitHub Fine-Grained Personal Access Token',
    severity: 'critical',
    replacement: 'github_pat_YOUR_FINE_GRAINED_PAT_HERE'
  },
  {
    type: 'Google / Gemini API Key',
    regex: /AIzaSy[a-zA-Z0-9_-]{33}/g,
    description: 'Exposed Google AI Studio / Gemini API Key',
    severity: 'critical',
    replacement: 'AIzaSy_YOUR_GOOGLE_AI_API_KEY_HERE'
  },
  {
    type: 'OpenAI API Key',
    regex: /sk-(?:live|proj)?[a-zA-Z0-9]{20,48}/g,
    description: 'Exposed OpenAI / ChatGPT Secret Key',
    severity: 'critical',
    replacement: 'sk-YOUR_OPENAI_API_KEY_HERE'
  },
  {
    type: 'AWS Access Key ID',
    regex: /(?:A3T[A-Z0-9]|AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}/g,
    description: 'Exposed Amazon Web Services (AWS) Access Key ID',
    severity: 'critical',
    replacement: 'AKIA_YOUR_AWS_ACCESS_KEY_HERE'
  },
  {
    type: 'Stripe Secret Key',
    regex: /sk_live_[0-9a-zA-Z]{24,}/g,
    description: 'Exposed Stripe Live Production Secret Key',
    severity: 'critical',
    replacement: 'sk_live_YOUR_STRIPE_SECRET_KEY_HERE'
  },
  {
    type: 'Private SSH / RSA Key',
    regex: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----[\s\S]+?-----END (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/g,
    description: 'Exposed Private SSH / RSA Encryption Key',
    severity: 'critical',
    replacement: '-----BEGIN PRIVATE KEY-----\\nYOUR_PRIVATE_KEY_MASKED\\n-----END PRIVATE KEY-----'
  },
  {
    type: 'Firebase Service Account Key',
    regex: /"private_key":\s*"-----BEGIN PRIVATE KEY[\\n\s\S]+?-----END PRIVATE KEY[\\n\s\S]+?"/g,
    description: 'Exposed Firebase Admin Service Account Private Key',
    severity: 'critical',
    replacement: '"private_key": "-----BEGIN PRIVATE KEY-----\nYOUR_FIREBASE_KEY_HERE\n-----END PRIVATE KEY-----\n"'
  },
  {
    type: 'Generic Hardcoded Password in Config',
    regex: /(?:password|passwd|secret_key|api_secret)\s*[:=]\s*["']([^"'\s]{8,})["']/gi,
    description: 'Potential hardcoded password or secret key string',
    severity: 'high',
    replacement: 'password: "YOUR_SECRET_PLACEHOLDER"'
  }
];

// Helper to mask secret for UI display (e.g. ghp_...12ab)
export function maskSecretText(raw: string): string {
  if (!raw || raw.length <= 8) return '********';
  return `${raw.substring(0, 4)}••••••••${raw.substring(raw.length - 4)}`;
}

// Audit files before upload
export function auditFilesForSecurity(files: ExtractedFile[]): SecurityAuditResult {
  const secretsDetected: DetectedSecret[] = [];
  const bloatedFiles: { path: string; size: number; reason: string }[] = [];
  const recommendations: string[] = [];
  const recommendationsUrdu: string[] = [];

  for (const file of files) {
    if (!file.isSelected) continue;

    // Check for large files (> 25MB could trigger GitHub warnings, > 100MB is rejected)
    if (file.size > 25 * 1024 * 1024) {
      bloatedFiles.push({
        path: file.path,
        size: file.size,
        reason: file.size > 100 * 1024 * 1024 ? 'Exceeds GitHub 100MB Hard Limit' : 'File is large (>25MB)'
      });
    }

    // Check sensitive file names
    const lowerPath = file.path.toLowerCase();
    if (lowerPath.endsWith('.env') || lowerPath.endsWith('.env.local') || lowerPath.endsWith('.env.production')) {
      // Check if it has non-placeholder values
      if (file.content && !file.isBinary) {
        const lines = file.content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          if (line && !line.startsWith('#') && line.includes('=')) {
            const val = line.split('=')[1]?.trim();
            if (val && val.length > 6 && !val.includes('YOUR_') && !val.includes('example') && !val.includes('placeholder')) {
              secretsDetected.push({
                filePath: file.path,
                line: i + 1,
                type: 'Live Environment Secret (.env)',
                description: `Live credential found in ${file.path}: ${line.split('=')[0]}`,
                matchedTextMasked: maskSecretText(val),
                rawMatchedText: val,
                severity: 'high'
              });
            }
          }
        }
      }
    }

    // Scan text files for secret patterns
    if (!file.isBinary && file.content) {
      const content = file.content;
      for (const pattern of SECRET_PATTERNS) {
        // Skip generic password check for example/template files
        if (pattern.type.includes('Password') && (lowerPath.includes('example') || lowerPath.includes('template'))) {
          continue;
        }

        const matches = content.match(pattern.regex);
        if (matches) {
          for (const match of matches) {
            // Find line number
            const beforeMatch = content.substring(0, content.indexOf(match));
            const lineNumber = beforeMatch.split('\n').length;

            secretsDetected.push({
              filePath: file.path,
              line: lineNumber,
              type: pattern.type,
              description: pattern.description,
              matchedTextMasked: maskSecretText(match),
              rawMatchedText: match,
              severity: pattern.severity
            });
          }
        }
      }
    }
  }

  // Calculate Safety Score
  let score = 100;
  if (secretsDetected.some(s => s.severity === 'critical')) {
    score -= 60;
  }
  if (secretsDetected.some(s => s.severity === 'high')) {
    score -= 25;
  }
  if (bloatedFiles.some(b => b.size > 100 * 1024 * 1024)) {
    score -= 40;
  } else if (bloatedFiles.length > 0) {
    score -= 10;
  }

  score = Math.max(0, Math.min(100, score));

  const hasCriticalRisk = secretsDetected.some(s => s.severity === 'critical') || bloatedFiles.some(b => b.size > 100 * 1024 * 1024);

  if (secretsDetected.length > 0) {
    recommendations.push(`Found ${secretsDetected.length} exposed API key(s) or token(s). Sanitize them to avoid GitHub account suspension & automated secret scanning alerts.`);
    recommendationsUrdu.push(`کوڈ میں ${secretsDetected.length} حساس کیز یا ٹوکنز ملے ہیں۔ اکاؤنٹ کی حفاظت کے لیے خودکار طور پر ماسک (Auto-Sanitize) کریں۔`);
  }

  if (bloatedFiles.length > 0) {
    recommendations.push(`Found ${bloatedFiles.length} oversized file(s) that might exceed GitHub repository limits.`);
    recommendationsUrdu.push(`${bloatedFiles.length} فائلیں بہت بڑی ہیں جو GitHub کی حد سے زیادہ ہو سکتی ہیں۔`);
  }

  if (score === 100) {
    recommendations.push('Clean & Safe: No exposed credentials, secrets, or policy violations detected.');
    recommendationsUrdu.push('اکاؤنٹ 100% محفوظ ہے: کوئی بھی پرائیویٹ کی، ٹوکن یا سسپنشن کا خطرہ موجود نہیں۔');
  }

  return {
    isSafe: score >= 80 && !hasCriticalRisk,
    score,
    secretsDetected,
    bloatedFiles,
    recommendations,
    recommendationsUrdu,
    hasCriticalRisk
  };
}

// 1-Click Auto Sanitize Secrets in all extracted files
export function sanitizeSecretsInFiles(files: ExtractedFile[]): {
  sanitizedFiles: ExtractedFile[];
  sanitizedCount: number;
} {
  let sanitizedCount = 0;

  const sanitizedFiles = files.map((file) => {
    if (file.isBinary || !file.content) return file;

    let modifiedContent = file.content;
    let fileWasChanged = false;

    // Check .env files
    const lowerPath = file.path.toLowerCase();
    if (lowerPath.endsWith('.env') || lowerPath.endsWith('.env.local') || lowerPath.endsWith('.env.production')) {
      const lines = modifiedContent.split('\n');
      const newLines = lines.map((line) => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
          const [k, ...vParts] = trimmed.split('=');
          const v = vParts.join('=').trim();
          if (v && v.length > 6 && !v.includes('YOUR_') && !v.includes('placeholder')) {
            sanitizedCount++;
            fileWasChanged = true;
            return `${k}=YOUR_${k.toUpperCase()}_HERE`;
          }
        }
        return line;
      });
      modifiedContent = newLines.join('\n');
    }

    // Replace known secret patterns
    for (const pattern of SECRET_PATTERNS) {
      if (pattern.type.includes('Password') && (lowerPath.includes('example') || lowerPath.includes('template'))) {
        continue;
      }
      if (pattern.regex.test(modifiedContent)) {
        const matches = modifiedContent.match(pattern.regex) || [];
        sanitizedCount += matches.length;
        modifiedContent = modifiedContent.replace(pattern.regex, pattern.replacement);
        fileWasChanged = true;
      }
    }

    if (fileWasChanged) {
      return {
        ...file,
        content: modifiedContent,
        size: modifiedContent.length,
        lineCount: modifiedContent.split('\n').length
      };
    }

    return file;
  });

  return { sanitizedFiles, sanitizedCount };
}

// Filters out dangerous or junk files that could trigger policy or storage flags
export function filterSafeFilesForUpload(files: ExtractedFile[]): ExtractedFile[] {
  const BLACKLISTED_PATTERNS = [
    /^\.git\//i,
    /(^|\/)\.DS_Store$/i,
    /(^|\/)Thumbs\.db$/i,
    /(^|\/)\.idea\//i,
    /(^|\/)\.vscode\//i,
    /(^|\/)node_modules\//i,
    /(^|\/)\.gradle\//i,
    /(^|\/)build\/intermediates\//i,
    /(^|\/)npm-debug\.log/i,
    /(^|\/)yarn-error\.log/i,
    /(^|\/)\.env\.local$/i
  ];

  return files.filter((f) => {
    const p = f.path.replace(/\\/g, '/');
    return !BLACKLISTED_PATTERNS.some((pattern) => pattern.test(p));
  });
}

// Token scopes check
export function checkTokenSecurityScopes(oauthScopesHeader: string | null): TokenSecurityReport {
  if (!oauthScopesHeader) {
    return {
      isSafeScope: true,
      hasWorkflowScope: true,
      hasOverprivilegedScope: false,
      scopes: []
    };
  }

  const scopes = oauthScopesHeader.split(',').map((s) => s.trim().toLowerCase());
  const hasWorkflowScope = scopes.includes('workflow') || scopes.includes('repo');
  
  // Scopes that are dangerously overprivileged for a standard uploader
  const overprivilegedScopes = ['admin:org', 'admin:enterprise', 'delete_repo', 'admin:gpg_key'];
  const hasOverprivilegedScope = scopes.some((s) => overprivilegedScopes.includes(s));

  let warningMessage: string | undefined;
  let warningMessageUrdu: string | undefined;

  if (hasOverprivilegedScope) {
    warningMessage = 'Your Personal Access Token has high administrative privileges (e.g., admin:org / delete_repo). For optimal security, generate a fine-grained token with only "repo" and "workflow" scopes.';
    warningMessageUrdu = 'آپ کے ٹوکن میں غیر ضروری ایڈمن اختیارات شامل ہیں۔ اکاؤنٹ کی مکمل حفاظت کے لیے صرف "repo" اور "workflow" اجازتیں منتخب کریں۔';
  } else if (!hasWorkflowScope) {
    warningMessage = 'Token is missing the "workflow" scope. GitHub Actions workflows cannot be pushed without this scope.';
    warningMessageUrdu = 'ٹوکن میں "workflow" کی اجازت نہیں ہے، جس کی وجہ سے GitHub Actions خودکار اپلوڈ نہیں ہو سکے گا۔';
  }

  return {
    isSafeScope: !hasOverprivilegedScope,
    hasWorkflowScope,
    hasOverprivilegedScope,
    scopes,
    warningMessage,
    warningMessageUrdu
  };
}

// Sleep helper with jitter to prevent robotic rate-limiting bursts
export function safeRateDelay(ms: number = 80): Promise<void> {
  const jitter = Math.floor(Math.random() * 40); // 0-40ms random jitter
  return new Promise((resolve) => setTimeout(resolve, ms + jitter));
}
