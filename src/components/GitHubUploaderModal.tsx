import React, { useState, useEffect } from 'react';
import { ExtractedFile, GitHubUser, GitHubRepo, UploadState } from '../types';
import {
  getGitHubUser,
  getGitHubRepos,
  createGitHubRepo,
  uploadProjectToGitHub
} from '../utils/github';
import { getAndroidWorkflowFile, getWebsiteWorkflowFile, patchFilesForGitHubPages, downloadWorkflowZip } from '../utils/zip';
import { sanitizeSecretsInFiles } from '../utils/security';
import { GitHubSecurityShield } from './GitHubSecurityShield';
import {
  Github,
  Key,
  FolderPlus,
  GitBranch,
  Send,
  AlertCircle,
  ExternalLink,
  Lock,
  Globe,
  Sparkles,
  X,
  CheckCircle2,
  RefreshCw,
  Info,
  Cpu,
  Smartphone,
  ShieldCheck,
  Download,
  ShieldAlert
} from 'lucide-react';

interface GitHubUploaderModalProps {
  isOpen: boolean;
  onClose: () => void;
  files: ExtractedFile[];
  projectName: string;
  projectType?: 'android' | 'website';
  language: 'ur' | 'en';
  onFilesUpdate?: (sanitized: ExtractedFile[]) => void;
}

export const GitHubUploaderModal: React.FC<GitHubUploaderModalProps> = ({
  isOpen,
  onClose,
  files,
  projectName,
  projectType = 'android',
  language,
  onFilesUpdate
}) => {
  if (!isOpen) return null;

  const isUrdu = language === 'ur';
  const isAndroid = projectType === 'android';

  // PAT and user state
  const [token, setToken] = useState<string>(() => localStorage.getItem('gh_pat_token') || '');
  const [saveToken, setSaveToken] = useState<boolean>(true);
  const [user, setUser] = useState<GitHubUser | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Repo target state
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [isRepoListLoading, setIsRepoListLoading] = useState<boolean>(false);
  const [mode, setMode] = useState<'existing' | 'new'>('new');
  const [selectedRepo, setSelectedRepo] = useState<string>('');
  const [newRepoName, setNewRepoName] = useState<string>(
    projectName ? projectName.toLowerCase().replace(/[^a-z0-9_-]/g, '-') : 'my-app'
  );
  const [isPrivate, setIsPrivate] = useState<boolean>(false);
  const [branch, setBranch] = useState<string>('main');
  const [commitMessage, setCommitMessage] = useState<string>(
    isAndroid
      ? 'Upload Android Studio project via Safe Uploader'
      : 'Deploy website & components via Safe Uploader'
  );
  const [autoWorkflow, setAutoWorkflow] = useState<boolean>(true);
  const [autoSanitizeSecrets, setAutoSanitizeSecrets] = useState<boolean>(true);

  // Upload progress state
  const [uploadState, setUploadState] = useState<UploadState>({
    status: 'idle',
    progress: 0
  });

  // Auto-verify if token already exists in localStorage on open
  useEffect(() => {
    const saved = localStorage.getItem('gh_pat_token');
    if (saved && !user && !isAuthLoading) {
      setToken(saved);
      verifyToken(saved);
    }
  }, []);

  const verifyToken = async (pat: string) => {
    if (!pat.trim()) {
      setAuthError(isUrdu ? 'برائے مہربانی اپنا GitHub PAT ٹوکن درج کریں۔' : 'Please enter your GitHub PAT token');
      return;
    }

    setIsAuthLoading(true);
    setAuthError(null);

    try {
      const userData = await getGitHubUser(pat);
      setUser(userData);
      if (saveToken) {
        localStorage.setItem('gh_pat_token', pat.trim());
      }

      // Fetch user repos
      setIsRepoListLoading(true);
      const userRepos = await getGitHubRepos(pat);
      setRepos(userRepos);
      if (userRepos.length > 0 && !selectedRepo) {
        setSelectedRepo(userRepos[0].name);
      }
    } catch (err: any) {
      setAuthError(err.message || 'Token verification failed');
      setUser(null);
    } finally {
      setIsAuthLoading(false);
      setIsRepoListLoading(false);
    }
  };

  const handleVerifyToken = () => {
    verifyToken(token);
  };

  const handleClearToken = () => {
    localStorage.removeItem('gh_pat_token');
    setToken('');
    setUser(null);
    setRepos([]);
    setAuthError(null);
  };

  const handleStartUpload = async () => {
    if (!token || !user) {
      setAuthError(isUrdu ? 'پہلے GitHub ٹوکن کی تصدیق کریں۔' : 'Please verify your GitHub token first');
      return;
    }

    let targetRepoName = mode === 'new' ? newRepoName.trim() : selectedRepo.trim();
    let targetRepoOwner = user.login;

    if (!targetRepoName) {
      setAuthError(isUrdu ? 'ریپوزٹری کا نام درج کریں۔' : 'Please provide a repository name');
      return;
    }

    setUploadState({
      status: 'connecting',
      progress: 2,
      detailMessage: isUrdu ? 'ریپوزٹری تیار کی جا رہی ہے...' : 'Preparing repository...'
    });

    try {
      // Step 1: If creating new repo
      if (mode === 'new') {
        const existing = repos.find((r) => r.name.toLowerCase() === targetRepoName.toLowerCase());
        if (!existing) {
          setUploadState({
            status: 'creating_repo',
            progress: 8,
            detailMessage: isUrdu ? `نئی ریپوزٹری "${targetRepoName}" بنائی جا رہی ہے...` : `Creating repository "${targetRepoName}"...`
          });
          const created = await createGitHubRepo(token, targetRepoName, isPrivate);
          targetRepoName = created.name;
        }
      }

      // Prepare files payload with anti-suspension security sanitization
      let filesToUpload = [...files];

      // Auto sanitize secrets before pushing to prevent account ban
      if (autoSanitizeSecrets) {
        const { sanitizedFiles, sanitizedCount } = sanitizeSecretsInFiles(filesToUpload);
        filesToUpload = sanitizedFiles;
        if (sanitizedCount > 0 && onFilesUpdate) {
          onFilesUpdate(sanitizedFiles);
        }
      }

      if (!isAndroid) {
        // Auto-patch website files for Vercel and GitHub Pages compatibility to prevent white screen
        filesToUpload = patchFilesForGitHubPages(filesToUpload);
      } else if (autoWorkflow) {
        const hasWorkflow = filesToUpload.some(
          (f) => f.path.includes('.github/workflows/') && f.path.endsWith('.yml')
        );
        if (!hasWorkflow) {
          filesToUpload.push(getAndroidWorkflowFile());
        }
      }

      await uploadProjectToGitHub(
        token,
        targetRepoOwner,
        targetRepoName,
        branch,
        commitMessage,
        filesToUpload,
        (progressState) => setUploadState(progressState)
      );
    } catch (err: any) {
      setUploadState({
        status: 'error',
        progress: 0,
        error: err.message || 'Upload failed'
      });
    }
  };

  const selectedFilesCount = files.filter((f) => f.isSelected).length;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center space-x-3 rtl:space-x-reverse">
            <div className="p-2.5 bg-slate-800 text-slate-100 rounded-xl border border-slate-700 shadow-sm">
              <Github className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <span>{isUrdu ? 'محفوظ GitHub اپلوڈر و سیکیورٹی شیڈو' : 'Safe GitHub Direct Uploader'}</span>
                <span className="text-[10px] bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-semibold">
                  {isAndroid ? 'Android Code' : 'Website Code'}
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                {isUrdu
                  ? `${selectedFilesCount} فائلیں اینٹی سسپنشن پروٹیکشن کے ساتھ اپلوڈ ہوں گی`
                  : `${selectedFilesCount} files protected with Anti-Suspension safeguards`}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-700/60"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">

          {/* Dedicated Anti-Suspension Security Shield Banner */}
          <GitHubSecurityShield
            files={files}
            onFilesUpdate={onFilesUpdate}
            user={user}
            language={language}
            compact={false}
          />
          
          {/* Step 1: Token Auth */}
          <div className="space-y-3 bg-slate-950/60 p-4 rounded-xl border border-slate-800">
            <label className="block text-xs font-bold text-slate-200 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-cyan-400" />
                1. GitHub Personal Access Token (PAT)
              </span>
              {user && (
                <button
                  type="button"
                  onClick={handleClearToken}
                  className="text-[11px] text-slate-400 hover:text-red-400 underline"
                >
                  {isUrdu ? 'ٹوکن تبدیل کریں' : 'Change Token'}
                </button>
              )}
            </label>

            {!user ? (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder="ghp_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={handleVerifyToken}
                    disabled={isAuthLoading}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-colors shrink-0 flex items-center gap-1.5"
                  >
                    {isAuthLoading ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    )}
                    <span>{isUrdu ? 'تصدیق کریں' : 'Verify Token'}</span>
                  </button>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <label className="flex items-center space-x-1.5 rtl:space-x-reverse cursor-pointer">
                    <input
                      type="checkbox"
                      checked={saveToken}
                      onChange={(e) => setSaveToken(e.target.checked)}
                      className="rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-0"
                    />
                    <span>{isUrdu ? 'براؤزر میں ٹوکن محفوظ رکھیں' : 'Remember token in browser'}</span>
                  </label>

                  <a
                    href="https://github.com/settings/tokens/new?scopes=repo,workflow&description=Safe+GitHub+Uploader"
                    target="_blank"
                    rel="noreferrer"
                    className="text-cyan-400 hover:underline flex items-center gap-1"
                  >
                    <span>{isUrdu ? 'نیا PAT ٹوکن حاصل کریں' : 'Generate Safe PAT Token'}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl">
                <div className="flex items-center space-x-3 rtl:space-x-reverse">
                  <img
                    src={user.avatar_url}
                    alt={user.login}
                    className="w-8 h-8 rounded-full border border-emerald-500/40"
                  />
                  <div>
                    <h4 className="text-xs font-bold text-slate-100">{user.name || user.login}</h4>
                    <p className="text-[11px] text-emerald-400">@{user.login} (Authenticated)</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {user.rateLimit && (
                    <span className="text-[10px] font-mono bg-slate-900 px-2 py-1 rounded-md border border-slate-800 text-slate-300">
                      Rate Limit: <strong className="text-emerald-400">{user.rateLimit.remaining}</strong>/{user.rateLimit.limit}
                    </span>
                  )}
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                </div>
              </div>
            )}

            {authError && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{authError}</span>
              </div>
            )}
          </div>

          {/* Step 2: Repository Selection & Options */}
          {user && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-200">
                  2. {isUrdu ? 'ریپوزٹری کا انتخاب (Repository)' : 'Target Repository'}
                </label>

                <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
                  <button
                    type="button"
                    onClick={() => setMode('new')}
                    className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                      mode === 'new' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {isUrdu ? '+ نئی ریپو بنائیں' : '+ Create New'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('existing')}
                    className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                      mode === 'existing' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {isUrdu ? 'موجودہ ریپو منتخب کریں' : 'Existing Repo'}
                  </button>
                </div>
              </div>

              {mode === 'new' ? (
                <div className="space-y-3 bg-slate-950/40 p-4 rounded-xl border border-slate-800">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      {isUrdu ? 'ریپوزٹری کا نام (Repository Name):' : 'Repository Name:'}
                    </label>
                    <div className="flex items-center bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs focus-within:border-emerald-500">
                      <span className="text-slate-500 font-mono select-none">{user.login} /</span>
                      <input
                        type="text"
                        value={newRepoName}
                        onChange={(e) => setNewRepoName(e.target.value)}
                        placeholder="my-awesome-app"
                        className="flex-1 bg-transparent text-slate-200 ms-1.5 focus:outline-none font-mono"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <label className="flex items-center space-x-2 rtl:space-x-reverse cursor-pointer text-xs text-slate-300">
                      <input
                        type="checkbox"
                        checked={isPrivate}
                        onChange={(e) => setIsPrivate(e.target.checked)}
                        className="rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-0"
                      />
                      <span className="flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5 text-amber-400" />
                        {isUrdu ? 'پرائیویٹ ریپوزٹری (Private Repository)' : 'Private Repository'}
                      </span>
                    </label>
                    <span className="text-[11px] text-slate-500">
                      {isPrivate ? (isUrdu ? 'صرف آپ کو نظر آئے گی' : 'Visible only to you') : (isUrdu ? 'سب کے لیے پبلک ہوگی' : 'Public to everyone')}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800">
                  <label className="block text-[11px] text-slate-400 mb-1">
                    {isUrdu ? 'موجودہ ریپوزٹری منتخب کریں:' : 'Select existing repository:'}
                  </label>
                  {isRepoListLoading ? (
                    <div className="p-3 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>{isUrdu ? 'ریپوزٹریز لوڈ ہو رہی ہیں...' : 'Loading repositories...'}</span>
                    </div>
                  ) : repos.length === 0 ? (
                    <p className="text-xs text-amber-400 py-2">
                      {isUrdu ? 'کوئی ریپوزٹری نہیں ملی۔ نئی ریپو بنائیں۔' : 'No repositories found. Please create a new repo.'}
                    </p>
                  ) : (
                    <select
                      value={selectedRepo}
                      onChange={(e) => setSelectedRepo(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 font-mono"
                    >
                      {repos.map((r) => (
                        <option key={r.full_name} value={r.name}>
                          {r.name} {r.private ? '🔒 (Private)' : '🌐 (Public)'}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {/* Branch and Commit Message */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1 flex items-center gap-1">
                    <GitBranch className="w-3 h-3 text-cyan-400" />
                    <span>{isUrdu ? 'برانچ (Branch):' : 'Branch:'}</span>
                  </label>
                  <input
                    type="text"
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[11px] text-slate-400 mb-1">
                    {isUrdu ? 'کمیٹ میسج (Commit Message):' : 'Commit Message:'}
                  </label>
                  <input
                    type="text"
                    value={commitMessage}
                    onChange={(e) => setCommitMessage(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Auto Sanitize & Anti-Suspend Checkbox */}
              <div className="p-3 bg-slate-950/60 border border-emerald-500/30 rounded-xl flex items-start space-x-2.5 rtl:space-x-reverse">
                <input
                  type="checkbox"
                  id="autoSanitizeSecrets"
                  checked={autoSanitizeSecrets}
                  onChange={(e) => setAutoSanitizeSecrets(e.target.checked)}
                  className="mt-0.5 rounded border-emerald-600 bg-slate-900 text-emerald-500 focus:ring-0"
                />
                <label htmlFor="autoSanitizeSecrets" className="text-xs space-y-0.5 cursor-pointer">
                  <span className="font-bold text-emerald-300 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{isUrdu ? 'اکاؤنٹ سسپنشن سے بچاؤ: سیکرٹس و کیز کو خودکار ماسک کریں' : 'Anti-Suspension: Auto-Sanitize Secrets & API Keys'}</span>
                  </span>
                  <p className="text-[11px] text-slate-300 leading-snug">
                    {isUrdu
                      ? 'کوڈ میں موجود حساس OpenAI, Gemini, Stripe یا PAT ٹوکنز کو اپلوڈ سے پہلے خودکار طور پر محفوظ پلیس ہولڈرز سے بدل دیا جائے گا تاکہ اکاؤنٹ فلیگ نہ ہو۔'
                      : 'Automatically masks hardcoded API keys and tokens with safe environment placeholders before pushing.'}
                  </p>
                </label>
              </div>

              {/* Auto CI/CD Workflow */}
              <div className="p-3 bg-slate-950/60 border border-emerald-500/30 rounded-xl space-y-2">
                <div className="flex items-start space-x-2.5 rtl:space-x-reverse">
                  <input
                    type="checkbox"
                    id="autoWorkflow"
                    checked={autoWorkflow}
                    onChange={(e) => setAutoWorkflow(e.target.checked)}
                    className="mt-0.5 rounded border-emerald-600 bg-slate-900 text-emerald-500 focus:ring-0"
                  />
                  <label htmlFor="autoWorkflow" className="text-xs space-y-1 cursor-pointer">
                    <span className="font-bold text-emerald-300 flex items-center gap-1.5">
                      {isAndroid ? <Cpu className="w-3.5 h-3.5 text-cyan-400" /> : <Globe className="w-3.5 h-3.5 text-cyan-400" />}
                      {isAndroid
                        ? (isUrdu ? 'خودکار APK بلڈ شامل کریں (GitHub Actions CI/CD Workflow)' : 'Include Auto APK Build Workflow (.github/workflows/android.yml)')
                        : (isUrdu ? 'GitHub Pages لائیو ڈیپلائمنٹ ورک فلو شامل کریں (.github/workflows/static.yml)' : 'Include GitHub Pages Auto Deploy Workflow (.github/workflows/static.yml)')}
                    </span>
                    <p className="text-[11px] text-slate-300 leading-snug">
                      {isAndroid
                        ? (isUrdu
                            ? 'GitHub پر اپلوڈ ہوتے ہی GitHub Actions خودکار طور پر Gradle کے ذریعے APK بلڈ کرے گا، جسے آپ "Actions" ٹیب سے ڈاؤنلوڈ کر سکتے ہیں۔'
                            : 'Automatically compiles debug APK on GitHub servers on every commit! Downloadable under "Actions" tab.')
                        : (isUrdu
                            ? 'یہ سکرپٹ اپلوڈ ہوتے ہی GitHub Pages پر آپ کی ویب سائٹ کو خودکار طور پر لائیو پبلش کر دے گا۔'
                            : 'Automatically deploys your website to GitHub Pages so your page goes live instantly!')}
                    </p>
                  </label>
                </div>

                {autoWorkflow && user?.hasWorkflowScope === false && (
                  <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-lg text-[11px] text-amber-300 space-y-1 mt-2">
                    <p className="font-semibold flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                      {isUrdu ? 'اہم نوٹ: GitHub Token میں "workflow" کی اجازت لازمی ہے' : 'Important: PAT requires "workflow" scope'}
                    </p>
                    <p className="text-amber-200/90 leading-relaxed text-[10.5px]">
                      {isUrdu
                        ? 'اگر آپ کے GitHub PAT ٹوکن میں workflow scope نشان زد (check) نہیں ہے، تو GitHub اس فائل کو مسترد کر سکتا ہے۔ Token Settings میں جا کر "workflow" باکس کو ٹک کریں۔'
                        : 'If your Personal Access Token lacks the "workflow" scope, GitHub may block workflow files. Enable "workflow" scope in PAT settings.'}
                    </p>
                  </div>
                )}

                <div className="pt-2 border-t border-emerald-800/40 flex flex-wrap items-center justify-between gap-2 mt-2">
                  <p className="text-[11px] text-emerald-200/90 font-medium">
                    {isUrdu ? 'ورک فلو کا الگ زپ پاتھ کے ساتھ ڈاؤنلوڈ کریں (.github/workflows):' : 'Download Workflow ZIP with directory path:'}
                  </p>
                  <button
                    type="button"
                    onClick={() => downloadWorkflowZip(isAndroid ? 'android' : 'website', true)}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition-colors shadow"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>{isUrdu ? '📦 Workflow ZIP ڈاؤنلوڈ کریں' : '📦 Download Workflow ZIP'}</span>
                  </button>
                </div>
              </div>

            </div>
          )}

          {/* Progress / Upload Status */}
          {uploadState.status !== 'idle' && (
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-3">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-200">
                <span className="flex items-center gap-2">
                  {uploadState.status === 'completed' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : uploadState.status === 'error' ? (
                    <AlertCircle className="w-4 h-4 text-red-400" />
                  ) : (
                    <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
                  )}
                  {uploadState.detailMessage || 'Uploading...'}
                </span>
                <span className="text-cyan-400">{uploadState.progress}%</span>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-gradient-to-r from-emerald-500 to-cyan-500 h-full transition-all duration-300"
                  style={{ width: `${uploadState.progress}%` }}
                />
              </div>

              {uploadState.error && (
                <p className="text-xs text-red-400 font-medium pt-1">
                  {uploadState.error}
                </p>
              )}

              {uploadState.repoUrl && (() => {
                let livePagesUrl = '';
                if (uploadState.repoUrl && uploadState.repoUrl.includes('github.com/')) {
                  const parts = uploadState.repoUrl.replace('https://github.com/', '').split('/');
                  if (parts.length >= 2) {
                    const owner = parts[0];
                    const repo = parts[1];
                    if (repo.toLowerCase() === `${owner.toLowerCase()}.github.io`) {
                      livePagesUrl = `https://${owner}.github.io/`;
                    } else {
                      livePagesUrl = `https://${owner}.github.io/${repo}/`;
                    }
                  }
                }

                return (
                  <div className="pt-2 space-y-3">
                    {!isAndroid && (
                      <div className="p-3.5 bg-slate-900 border border-cyan-500/40 rounded-xl space-y-2 text-left rtl:text-right">
                        <div className="flex items-center space-x-2 rtl:space-x-reverse text-cyan-300 text-xs font-bold">
                          <Sparkles className="w-4 h-4 text-cyan-400 shrink-0" />
                          <span>{isUrdu ? 'لائیو لنک (Live Site Link) حاصل کرنے کا حتمی طریقہ:' : 'How to generate and view your Live Site Link:'}</span>
                        </div>
                        
                        <div className="space-y-2.5 text-[11px] text-slate-300 leading-relaxed">
                          {/* Notice for Blank Screen Fix */}
                          <div className="p-2.5 bg-rose-950/60 border border-rose-500/50 rounded-lg text-rose-200 space-y-1">
                            <p className="font-bold flex items-center gap-1.5 text-[11.5px] text-rose-300">
                              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                              <span>{isUrdu ? '⚠️ وائٹ پیج / Blank Page ختم کرنے کی ضروری سیٹنگ:' : '⚠️ Fix Blank White Screen on GitHub Pages:'}</span>
                            </p>
                            <p className="text-[10.5px] leading-normal text-rose-200/90">
                              {isUrdu
                                ? 'GitHub Settings -> Pages میں جا کر **Source** کو لازمی **"GitHub Actions"** سلیکٹ کریں! اگر Source "Deploy from a branch" پر ہوگا تو React/Vite کوڈ بلڈ نہیں ہوگا اور ویب سائٹ پر وائٹ پیج آئے گا۔'
                                : 'Go to Repo Settings -> Pages -> Set **Source** to **"GitHub Actions"**! If set to "Deploy from a branch", Vite/React code will not compile and will show a blank white page.'}
                            </p>
                          </div>

                          <p className="font-semibold text-emerald-300 pt-0.5">
                            {isUrdu 
                              ? 'لائیو لنک ایکٹیو کرنے کے 3 آسان قدم:'
                              : '3 Easy Steps to Activate Your Live Link:'}
                          </p>
                          <ol className="list-decimal list-inside space-y-1.5 pl-1 text-slate-200">
                            <li>{isUrdu ? 'ریپوزٹری میں **Settings -> Pages** کھولیں -> **Source** کو **"GitHub Actions"** منتخب کریں۔' : 'Open Repo **Settings -> Pages** -> Under **Source**, select **"GitHub Actions"**.'}</li>
                            <li>{isUrdu ? 'اوپر **Actions** ٹیب میں جائیں -> **"Deploy Web App to GitHub Pages"** منتخب کریں۔' : 'Go to **Actions** tab -> Select **"Deploy Web App to GitHub Pages"** on the left.'}</li>
                            <li>{isUrdu ? '**Run workflow** بٹن پر کلک کریں -> 30 سیکنڈ بعد لائیو URL تیار ہو جائے گا!' : 'Click **Run workflow** button -> In 30 seconds your live URL will be active!'}</li>
                          </ol>

                          <div className="pt-1.5 border-t border-slate-800">
                            <p className="font-semibold text-cyan-300">
                              {isUrdu 
                                ? 'سادہ HTML/CSS/JS ویب سائٹس کے لیے:'
                                : 'For Static HTML/CSS/JS Sites:'}
                            </p>
                            <p className="text-[10.5px] text-slate-400 mt-0.5">
                              {isUrdu
                                ? 'سادہ HTML پیجز کے لیے Settings -> Pages میں Source کو "Deploy from a branch" رکھیں اور main branch سلیکٹ کریں۔ 15 سیکنڈز میں لنک لائیو ہو جائے گا۔'
                                : 'For simple static HTML pages, set Settings -> Pages -> Source to "Deploy from a branch" and select main branch / root folder.'}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center justify-end gap-2 pt-2 border-t border-slate-800">
                      <button
                        type="button"
                        onClick={() => downloadWorkflowZip(isAndroid ? 'android' : 'website', true)}
                        className="px-4 py-2 bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-700/60 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow"
                      >
                        <Download className="w-4 h-4 text-emerald-400" />
                        <span>{isUrdu ? '📦 Workflow ZIP (.github/workflows) ڈاؤنلوڈ کریں' : '📦 Download Workflow ZIP'}</span>
                      </button>

                      <a
                        href={uploadState.repoUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
                      >
                        <Github className="w-4 h-4" />
                        <span>{isUrdu ? 'GitHub ریپوزٹری کھولیں' : 'Open Repository'}</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>

                      {!isAndroid && (
                        <a
                          href={livePagesUrl || `${uploadState.repoUrl}/settings/pages`}
                          target="_blank"
                          rel="noreferrer"
                          className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-lg"
                        >
                          <Globe className="w-4 h-4" />
                          <span>{isUrdu ? '🌐 لائیو ویب سائٹ لنک کھولیں' : '🌐 Open Live Website Link'}</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/90 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-400 flex items-center gap-1">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>
              {isUrdu ? 'اینٹی سسپنشن سیکیورٹی فعال ہے' : 'Anti-Suspension Security Guard Active'}
            </span>
          </div>

          <div className="flex items-center space-x-2 rtl:space-x-reverse">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-400 hover:text-slate-200 text-xs font-semibold rounded-xl hover:bg-slate-800 transition-colors"
            >
              {isUrdu ? 'بند کریں' : 'Close'}
            </button>
            <button
              type="button"
              onClick={handleStartUpload}
              disabled={!user || selectedFilesCount === 0 || uploadState.status === 'uploading_blobs' || uploadState.status === 'creating_tree' || uploadState.status === 'committing'}
              className="px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-lg transition-all flex items-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              <span>
                {uploadState.status === 'completed'
                  ? (isUrdu ? 'دوبارہ اپلوڈ کریں' : 'Re-upload')
                  : (isUrdu ? 'محفوظ اپلوڈ شروع کریں' : 'Start Secure Upload')}
              </span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
