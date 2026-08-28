import React, { useState } from 'react';
import { ExtractedFile, GitHubUser } from '../types';
import { auditFilesForSecurity, sanitizeSecretsInFiles, SecurityAuditResult } from '../utils/security';
import {
  ShieldCheck,
  ShieldAlert,
  Shield,
  Key,
  Lock,
  Cpu,
  Zap,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Info,
  ChevronDown,
  ChevronUp,
  FileCode,
  Gauge
} from 'lucide-react';

interface GitHubSecurityShieldProps {
  files: ExtractedFile[];
  onFilesUpdate?: (sanitized: ExtractedFile[]) => void;
  user?: GitHubUser | null;
  language: 'ur' | 'en';
  compact?: boolean;
}

export const GitHubSecurityShield: React.FC<GitHubSecurityShieldProps> = ({
  files,
  onFilesUpdate,
  user,
  language,
  compact = false
}) => {
  const isUrdu = language === 'ur';
  const [isExpanded, setIsExpanded] = useState(!compact);
  const [sanitizedMessage, setSanitizedMessage] = useState<string | null>(null);

  const audit: SecurityAuditResult = auditFilesForSecurity(files);

  const handleAutoSanitize = () => {
    const { sanitizedFiles, sanitizedCount } = sanitizeSecretsInFiles(files);
    if (onFilesUpdate) {
      onFilesUpdate(sanitizedFiles);
    }
    setSanitizedMessage(
      isUrdu
        ? `کامیابی! ${sanitizedCount} حساس کیز / ٹوکنز کو خودکار طور پر محفوظ پلیس ہولڈرز سے بدل دیا گیا ہے۔`
        : `Successfully sanitized ${sanitizedCount} secret(s)/key(s) with safe placeholders!`
    );
    setTimeout(() => setSanitizedMessage(null), 5000);
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
    if (score >= 70) return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
    return 'text-rose-400 bg-rose-500/10 border-rose-500/30';
  };

  return (
    <div className="bg-slate-950/80 border border-slate-800 rounded-2xl overflow-hidden shadow-lg transition-all">
      {/* Header Banner */}
      <div className="p-4 bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-3 rtl:space-x-reverse">
          <div className={`p-2.5 rounded-xl border ${audit.isSafe ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-rose-500/10 border-rose-500/30 text-rose-400'}`}>
            {audit.isSafe ? <ShieldCheck className="w-5 h-5" /> : <ShieldAlert className="w-5 h-5 animate-pulse" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs sm:text-sm font-bold text-slate-100 flex items-center gap-1.5">
                <span>{isUrdu ? '🛡️ GitHub اکاؤنٹ سسپنشن پروٹیکشن' : '🛡️ GitHub Account Anti-Suspension Security'}</span>
              </h3>
              <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${getScoreColor(audit.score)}`}>
                {audit.score}% {isUrdu ? 'سیفٹی اسکور' : 'Safe'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {isUrdu
                ? 'اکاؤنٹ بین / فلیگ ہونے سے بچانے کے لیے کوڈ اسکین اور ریٹ لمٹ پروٹیکشن'
                : 'Automated secret redaction, rate-limit protection & safe CI workflows'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {audit.secretsDetected.length > 0 && onFilesUpdate && (
            <button
              type="button"
              onClick={handleAutoSanitize}
              className="px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold transition-all shadow flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{isUrdu ? 'سیکرٹس خودکار ماسک کریں' : 'Auto-Sanitize Secrets'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800"
            title={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {sanitizedMessage && (
        <div className="m-3 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          <span>{sanitizedMessage}</span>
        </div>
      )}

      {/* Expanded Security Insights */}
      {isExpanded && (
        <div className="p-4 space-y-4">
          
          {/* 4 Pillars of Account Safety Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            
            {/* 1. Secret Protection */}
            <div className={`p-3 rounded-xl border ${audit.secretsDetected.length === 0 ? 'bg-slate-900/90 border-slate-800' : 'bg-rose-950/30 border-rose-500/40'}`}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-bold text-slate-200 flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-cyan-400" />
                  <span>{isUrdu ? '1. سیکرٹ و API کیز پروٹیکشن' : '1. Secret & Key Leak Protection'}</span>
                </span>
                {audit.secretsDetected.length === 0 ? (
                  <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-semibold">
                    <CheckCircle2 className="w-3 h-3" /> {isUrdu ? 'محفوظ' : 'Clean'}
                  </span>
                ) : (
                  <span className="text-[10px] text-rose-400 font-bold flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> {audit.secretsDetected.length} {isUrdu ? 'خطرات' : 'Risks'}
                  </span>
                )}
              </div>
              <p className="text-[10.5px] text-slate-400 leading-relaxed">
                {isUrdu
                  ? 'اوپن اے آئی، جیمنائی، سٹرائپ، یا GitHub PAT ٹوکنز کا پبلک ریپو میں جانا اکاؤنٹ سسپنشن کی بڑی وجہ بنتا ہے۔'
                  : 'Scans for hardcoded OpenAI, Gemini, Stripe, AWS & PAT credentials before upload.'}
              </p>
            </div>

            {/* 2. Rate Limit & Anti-Abuse */}
            <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-bold text-slate-200 flex items-center gap-1.5">
                  <Gauge className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{isUrdu ? '2. اینٹی ایبیوز ریٹ لمٹر' : '2. Anti-Abuse Rate Limiter'}</span>
                </span>
                <span className="text-[10px] text-emerald-400 font-mono font-bold">
                  {user?.rateLimit ? `${user.rateLimit.remaining}/${user.rateLimit.limit} API Calls` : 'Paced (80ms Jitter)'}
                </span>
              </div>
              <p className="text-[10.5px] text-slate-400 leading-relaxed">
                {isUrdu
                  ? 'تیز رفتار بوٹ جیسے اپلوڈز GitHub Secondary Rate Limit ایکٹیو کر دیتے ہیں۔ ہمارا سسٹم پرسکون اسپیڈ پر اپلوڈ کرتا ہے۔'
                  : 'Gentle pacing with exponential backoff on HTTP 429 to prevent bot flags.'}
              </p>
            </div>

            {/* 3. Workflow Timeouts */}
            <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-bold text-slate-200 flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-indigo-400" />
                  <span>{isUrdu ? '3. CI/CD ٹائم آؤٹ گارڈ' : '3. CI Timeout & Minutes Guard'}</span>
                </span>
                <span className="text-[10px] text-indigo-300 font-bold">
                  15-Min Hard Cap
                </span>
              </div>
              <p className="text-[10.5px] text-slate-400 leading-relaxed">
                {isUrdu
                  ? 'ورک فلو میں 15 منٹ کا ٹائم آؤٹ اور بیک وقت متعدد بلڈز کی منسوخی کے ذریعے فری منٹس ضائع ہونے سے بچتے ہیں۔'
                  : 'Automated 15-minute job timeout and concurrency cancelation prevents compute quota drain.'}
              </p>
            </div>

            {/* 4. PAT Least Privilege */}
            <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-bold text-slate-200 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-amber-400" />
                  <span>{isUrdu ? '4. کم سے کم اختیارات کا ٹوکن' : '4. Least-Privilege Scope'}</span>
                </span>
                <span className={`text-[10px] font-bold ${user?.isOverprivileged ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {user?.isOverprivileged ? (isUrdu ? 'زیادہ اختیارات' : 'Overprivileged') : (isUrdu ? 'محفوظ اسکوپ' : 'Safe Scopes')}
                </span>
              </div>
              <p className="text-[10.5px] text-slate-400 leading-relaxed">
                {isUrdu
                  ? 'ٹوکن کو صرف "repo" اور "workflow" اجازت دیں، تاکہ ایڈمن یا آرگنائزیشن لیول کے خطرات نہ ہوں۔'
                  : 'Ensures only necessary "repo" and "workflow" scopes are granted, avoiding admin privilege risks.'}
              </p>
            </div>

          </div>

          {/* Detected Leaks / Secrets Warning List */}
          {audit.secretsDetected.length > 0 && (
            <div className="p-3.5 bg-rose-950/40 border border-rose-500/40 rounded-xl space-y-2.5">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-rose-300 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{isUrdu ? 'درج ذیل فائلوں میں حساس معلومات پائی گئی ہیں:' : 'Exposed Credentials Detected:'}</span>
                </h4>
                {onFilesUpdate && (
                  <button
                    type="button"
                    onClick={handleAutoSanitize}
                    className="text-[11px] px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-lg transition-colors shadow"
                  >
                    {isUrdu ? '1-کلک میں سب صاف کریں' : 'Sanitize All'}
                  </button>
                )}
              </div>

              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                {audit.secretsDetected.map((secret, idx) => (
                  <div key={idx} className="p-2 bg-slate-950/80 border border-rose-900/50 rounded-lg text-[11px] flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 truncate">
                      <FileCode className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                      <span className="font-mono text-slate-200 truncate">{secret.filePath}</span>
                      <span className="text-slate-500 text-[10px]">:{secret.line}</span>
                      <span className="text-rose-400/90 text-[10px] font-semibold">({secret.type})</span>
                    </div>
                    <span className="font-mono text-[10px] text-amber-300 bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-800/40 shrink-0">
                      {secret.matchedTextMasked}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* User Token Warning if overprivileged */}
          {user?.isOverprivileged && (
            <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-[11px] text-amber-300 flex items-start gap-2">
              <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">{isUrdu ? 'ٹوکن سیکیورٹی مشورہ: ' : 'Token Security Advice: '}</span>
                <span>
                  {isUrdu
                    ? 'آپ کے ٹوکن میں ایڈمن اختیارات شامل ہیں۔ اکاؤنٹ کی زیادہ حفاظت کے لیے نیا ٹوکن بنائیں جس میں صرف "repo" اور "workflow" اجازتیں منتخب ہوں۔'
                    : 'Your Personal Access Token has administrative permissions. For enhanced account security, use a token limited strictly to "repo" and "workflow".'}
                </span>
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
};
