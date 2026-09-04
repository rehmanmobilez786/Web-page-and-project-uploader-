import React, { useState, useEffect } from 'react';
import { ExtractedFile, GitLabUser, GitLabProject, UploadState } from '../types';
import {
  getGitLabUser,
  getGitLabProjects,
  createGitLabProject,
  uploadProjectToGitLab,
  sanitizeGitLabSlug
} from '../utils/gitlab';
import { patchFilesForGitLab, downloadGitLabCiFile } from '../utils/zip';
import { sanitizeSecretsInFiles } from '../utils/security';
import { GitHubSecurityShield } from './GitHubSecurityShield';
import {
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
  Smartphone,
  ShieldCheck,
  Download,
  Server,
  Copy,
  Check,
  Cpu
} from 'lucide-react';

interface GitLabUploaderModalProps {
  isOpen: boolean;
  onClose: () => void;
  files: ExtractedFile[];
  projectName: string;
  projectType?: 'android' | 'website';
  language: 'ur' | 'en';
  onFilesUpdate?: (sanitized: ExtractedFile[]) => void;
}

export const GitLabUploaderModal: React.FC<GitLabUploaderModalProps> = ({
  isOpen,
  onClose,
  files,
  projectName,
  projectType = 'website',
  language,
  onFilesUpdate
}) => {
  if (!isOpen) return null;

  const isUrdu = language === 'ur';
  const isAndroid = projectType === 'android';

  // PAT and user state
  const [token, setToken] = useState<string>(() => localStorage.getItem('gl_pat_token') || '');
  const [instanceUrl, setInstanceUrl] = useState<string>(() => localStorage.getItem('gl_instance_url') || 'https://gitlab.com');
  const [showAdvancedServer, setShowAdvancedServer] = useState<boolean>(false);
  const [saveToken, setSaveToken] = useState<boolean>(true);
  const [user, setUser] = useState<GitLabUser | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Project target state
  const [projects, setProjects] = useState<GitLabProject[]>([]);
  const [isProjectListLoading, setIsProjectListLoading] = useState<boolean>(false);
  const [mode, setMode] = useState<'new' | 'existing'>('new');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [newProjectName, setNewProjectName] = useState<string>(() =>
    projectName ? sanitizeGitLabSlug(projectName) : 'my-app'
  );
  const [isPrivate, setIsPrivate] = useState<boolean>(false);
  const [branch, setBranch] = useState<string>('main');
  const [commitMessage, setCommitMessage] = useState<string>(
    isAndroid
      ? 'Upload Android Studio project via GitLab Safe Uploader'
      : 'Deploy website & components via GitLab Safe Uploader'
  );
  const [targetType, setTargetType] = useState<'website' | 'android'>(
    isAndroid ? 'android' : 'website'
  );
  const [copiedUrl, setCopiedUrl] = useState<boolean>(false);
  const [autoCiConfig, setAutoCiConfig] = useState<boolean>(true);
  const [autoSanitizeSecrets, setAutoSanitizeSecrets] = useState<boolean>(true);

  // Upload progress state
  const [uploadState, setUploadState] = useState<UploadState & { pagesUrl?: string }>({
    status: 'idle',
    progress: 0
  });

  // Auto-verify if token exists
  useEffect(() => {
    const saved = localStorage.getItem('gl_pat_token');
    if (saved && !user && !isAuthLoading) {
      setToken(saved);
      verifyToken(saved, instanceUrl);
    }
  }, []);

  const verifyToken = async (pat: string, hostUrl: string = instanceUrl) => {
    if (!pat.trim()) {
      setAuthError(isUrdu ? 'برائے مہربانی اپنا GitLab PAT ٹوکن درج کریں۔' : 'Please enter your GitLab PAT token');
      return;
    }

    setIsAuthLoading(true);
    setAuthError(null);

    try {
      const u = await getGitLabUser(pat, hostUrl);
      setUser(u);

      if (saveToken) {
        localStorage.setItem('gl_pat_token', pat.trim());
        localStorage.setItem('gl_instance_url', hostUrl.trim());
      }

      // Load user projects
      loadProjects(pat, hostUrl);
    } catch (err: any) {
      setUser(null);
      setAuthError(err.message || (isUrdu ? 'ٹوکن کی توثیق میں ناکامی' : 'Authentication failed'));
    } finally {
      setIsAuthLoading(false);
    }
  };

  const loadProjects = async (pat: string, hostUrl: string) => {
    setIsProjectListLoading(true);
    try {
      const pList = await getGitLabProjects(pat, hostUrl);
      setProjects(pList);
      if (pList.length > 0 && !selectedProjectId) {
        setSelectedProjectId(String(pList[0].id));
      }
    } catch (err) {
      console.warn('Could not list GitLab projects:', err);
    } finally {
      setIsProjectListLoading(false);
    }
  };

  const handleStartUpload = async () => {
    if (!user || !token) {
      setAuthError(isUrdu ? 'پہلے ٹوکن کی توثیق کریں' : 'Please verify token first');
      return;
    }

    let filesToUpload = [...files];

    // 1. Auto sanitize secrets if enabled
    if (autoSanitizeSecrets) {
      const { sanitizedFiles, sanitizedCount } = sanitizeSecretsInFiles(filesToUpload);
      filesToUpload = sanitizedFiles;
      if (onFilesUpdate && sanitizedCount > 0) {
        onFilesUpdate(sanitizedFiles);
      }
    }

    // 2. Auto patch files for GitLab Pages / Android CI (Inject .gitlab-ci.yml, fix relative paths)
    if (autoCiConfig) {
      filesToUpload = patchFilesForGitLab(filesToUpload, targetType);
    }

    try {
      let targetProjectId = selectedProjectId;

      // Create new project if selected
      if (mode === 'new') {
        const cleanSlug = sanitizeGitLabSlug(newProjectName);
        setUploadState({
          status: 'creating_repo',
          progress: 10,
          detailMessage: isUrdu
            ? `GitLab پر نیا پروجیکٹ "${cleanSlug}" بنایا جا رہا ہے...`
            : `Creating new GitLab project "${cleanSlug}"...`
        });

        const newP = await createGitLabProject(token, cleanSlug, isPrivate, instanceUrl);
        targetProjectId = String(newP.id);
      }

      // Perform upload
      const result = await uploadProjectToGitLab(
        token,
        targetProjectId,
        branch,
        commitMessage,
        filesToUpload,
        (progress) => {
          setUploadState((prev) => ({ ...prev, ...progress }));
        },
        instanceUrl
      );

      setUploadState((prev) => ({
        ...prev,
        status: 'completed',
        progress: 100,
        repoUrl: result.webUrl,
        pagesUrl: result.pagesUrl
      }));
    } catch (err: any) {
      setUploadState({
        status: 'error',
        progress: 0,
        error: err.message || (isUrdu ? 'اپلوڈ کے دوران ایرر پیش آیا' : 'Upload failed')
      });
    }
  };

  const handleDownloadCi = () => {
    const isVite = files.some(
      (f) => f.name === 'vite.config.ts' || (f.name === 'package.json' && f.content.includes('vite'))
    );
    downloadGitLabCiFile(targetType, isVite);
  };

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto ${isUrdu ? 'rtl' : 'ltr'}`}>
      <div className="bg-slate-900 border border-orange-500/30 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] my-auto animate-in fade-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="p-5 bg-gradient-to-r from-orange-950/70 via-slate-900 to-amber-950/40 border-b border-orange-500/20 flex items-center justify-between">
          <div className="flex items-center space-x-3 rtl:space-x-reverse">
            <div className="p-2.5 rounded-xl bg-gradient-to-tr from-orange-600 to-amber-500 text-white shadow-lg shadow-orange-500/20">
              <span className="font-black text-base tracking-tighter">🦊</span>
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-100 flex items-center gap-2">
                <span>{isUrdu ? 'GitLab پروجیکٹ اور پیجز اپلوڈر' : 'GitLab Project & Pages Uploader'}</span>
                <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30">
                  v4 REST API
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                {isUrdu
                  ? 'اینڈرائڈ پروجیکٹس یا ویب سائٹس کو GitLab ریپوزٹری پر 1-Click میں پش کریں اور GitLab Pages سے لائیو چلائیں'
                  : 'Push Android projects or websites to GitLab with automated .gitlab-ci.yml for Pages'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-5 space-y-5 overflow-y-auto flex-1 text-slate-200 text-xs">

          {/* Security Shield Banner */}
          <GitHubSecurityShield files={files} language={language} compact={true} />

          {/* STEP 1: GitLab Token Authentication */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <label className="font-bold text-slate-200 flex items-center gap-2">
                <Key className="w-4 h-4 text-orange-400" />
                <span>{isUrdu ? '1. GitLab Personal Access Token (PAT):' : '1. GitLab Personal Access Token (PAT):'}</span>
              </label>

              <button
                type="button"
                onClick={() => setShowAdvancedServer(!showAdvancedServer)}
                className="text-[11px] text-slate-400 hover:text-orange-300 flex items-center gap-1"
              >
                <Server className="w-3 h-3" />
                <span>{showAdvancedServer ? (isUrdu ? 'سرور چھپائیں' : 'Hide Host') : (isUrdu ? 'خودکار / کسٹم سرور' : 'Custom Host')}</span>
              </button>
            </div>

            {showAdvancedServer && (
              <div className="pt-1">
                <label className="text-[11px] text-slate-400 block mb-1">GitLab Instance URL:</label>
                <input
                  type="text"
                  value={instanceUrl}
                  onChange={(e) => setInstanceUrl(e.target.value)}
                  placeholder="https://gitlab.com"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-orange-500"
                />
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="glpat-XXXXXXXXXXXXXXXXXXXX"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-orange-500 font-mono"
                />
              </div>

              <button
                onClick={() => verifyToken(token, instanceUrl)}
                disabled={isAuthLoading || !token.trim()}
                className="px-4 py-2 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 disabled:opacity-50 text-white font-bold rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 shrink-0"
              >
                {isAuthLoading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>{isUrdu ? 'تصدیق جاری...' : 'Verifying...'}</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>{isUrdu ? 'ٹوکن چیک کریں' : 'Verify Token'}</span>
                  </>
                )}
              </button>
            </div>

            {/* Error Message */}
            {authError && (
              <div className="p-2.5 rounded-lg bg-red-950/50 border border-red-800 text-red-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
                <span>{authError}</span>
              </div>
            )}

            {/* User Profile Verified Card */}
            {user && (
              <div className="p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-xl flex items-center justify-between">
                <div className="flex items-center space-x-2.5 rtl:space-x-reverse">
                  {user.avatar_url ? (
                    <img src={user.avatar_url} alt={user.username} className="w-8 h-8 rounded-full border border-emerald-500" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-emerald-700 flex items-center justify-center font-bold text-white">
                      {user.username.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <h4 className="font-bold text-slate-100 flex items-center gap-1.5">
                      <span>{user.name || user.username}</span>
                      <span className="text-[10px] text-emerald-400 font-mono">(@{user.username})</span>
                    </h4>
                    <span className="text-[10px] text-emerald-400/90 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      {isUrdu ? 'GitLab ٹوکن کامیابی سے کنیکٹ ہو گیا' : 'GitLab account connected'}
                    </span>
                  </div>
                </div>

                <a
                  href={user.web_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-slate-400 hover:text-white p-1"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            )}

            {/* Help / Guide on getting GitLab PAT */}
            <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
              <span className="flex items-center gap-1">
                <Info className="w-3.5 h-3.5 text-orange-400" />
                {isUrdu ? 'مطلوبہ Scopes: api یا write_repository' : 'Required Scopes: api, write_repository'}
              </span>
              <a
                href={`${instanceUrl}/-/user_settings/personal_access_tokens`}
                target="_blank"
                rel="noreferrer"
                className="text-orange-400 hover:underline flex items-center gap-1"
              >
                <span>{isUrdu ? 'نیا GitLab PAT بنائیں ↗' : 'Generate GitLab PAT ↗'}</span>
              </a>
            </div>
          </div>

          {/* STEP 2: Target Project Selection */}
          {user && (
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-4">
              <label className="font-bold text-slate-200 flex items-center gap-2">
                <FolderPlus className="w-4 h-4 text-orange-400" />
                <span>{isUrdu ? '2. GitLab پروجیکٹ کا انتخاب کریں:' : '2. Select GitLab Project Destination:'}</span>
              </label>

              {/* Mode Toggle: New vs Existing */}
              <div className="grid grid-cols-2 gap-2 bg-slate-900 p-1 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => setMode('new')}
                  className={`py-2 px-3 rounded-lg font-bold transition-all ${
                    mode === 'new'
                      ? 'bg-gradient-to-r from-orange-600 to-amber-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {isUrdu ? '✨ نیا پروجیکٹ بنائیں' : '✨ Create New Project'}
                </button>

                <button
                  type="button"
                  onClick={() => setMode('existing')}
                  className={`py-2 px-3 rounded-lg font-bold transition-all ${
                    mode === 'existing'
                      ? 'bg-gradient-to-r from-orange-600 to-amber-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {isUrdu ? '📂 موجودہ پروجیکٹ منتخب کریں' : '📂 Existing Project'}
                </button>
              </div>

              {mode === 'new' ? (
                <div className="space-y-3 pt-1">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-slate-300 font-semibold">
                        {isUrdu ? 'پروجیکٹ کا نام (Project Name):' : 'Project Name:'}
                      </label>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {isUrdu ? 'صرف انگریزی و اعداد' : 'Letters & Numbers'}
                      </span>
                    </div>
                    <input
                      type="text"
                      value={newProjectName}
                      onChange={(e) => setNewProjectName(e.target.value)}
                      onBlur={() => {
                        if (newProjectName) {
                          setNewProjectName(sanitizeGitLabSlug(newProjectName));
                        }
                      }}
                      placeholder="my-awesome-app"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-orange-500"
                    />

                    {/* Live Slug Preview & Validation Hint */}
                    <div className="mt-1.5 space-y-1 bg-slate-950/60 p-2 rounded-lg border border-slate-800/80 text-[11px]">
                      <div className="flex flex-wrap items-center justify-between gap-1">
                        <div className="flex items-center gap-1.5 font-mono text-slate-400">
                          <span className="text-slate-500">GitLab Slug:</span>
                          <span className="text-orange-400 font-bold">{sanitizeGitLabSlug(newProjectName)}</span>
                        </div>
                        {user && (
                          <div className="text-[10px] text-slate-400 font-mono truncate max-w-[280px]">
                            gitlab.com/{user.username}/{sanitizeGitLabSlug(newProjectName)}
                          </div>
                        )}
                      </div>
                      {user && (
                        <div className="text-[10px] text-amber-300/90 font-mono flex items-center gap-1 pt-0.5 border-t border-slate-800/60">
                          <Globe className="w-3 h-3 text-amber-400 shrink-0" />
                          <span className="text-slate-400">Pages URL:</span>
                          <span className="truncate">https://{user.username.toLowerCase()}.gitlab.io/{sanitizeGitLabSlug(newProjectName)}/</span>
                        </div>
                      )}
                    </div>

                    {/* Helpful warning if user typed trailing '-' or '_' or '.' */}
                    {newProjectName && (/^[-_.]|[-_.]$/.test(newProjectName.trim()) || newProjectName.includes('--')) && (
                      <p className="mt-1 text-[11px] text-amber-400/90 flex items-center gap-1">
                        <Info className="w-3 h-3 shrink-0" />
                        <span>
                          {isUrdu
                            ? 'شروع یا آخر کے علامات (- / _ / .) خودکار طریقے سے ہٹا دیے جائیں گے'
                            : 'Leading/trailing symbols will be automatically cleaned for GitLab compatibility'}
                        </span>
                      </p>
                    )}
                  </div>

                  <div className="flex items-center space-x-2 rtl:space-x-reverse pt-1">
                    <input
                      type="checkbox"
                      id="gl-private-toggle"
                      checked={isPrivate}
                      onChange={(e) => setIsPrivate(e.target.checked)}
                      className="rounded bg-slate-900 border-slate-700 text-orange-500 focus:ring-orange-500 w-4 h-4"
                    />
                    <label htmlFor="gl-private-toggle" className="text-slate-300 cursor-pointer flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-slate-400" />
                      <span>{isUrdu ? 'پرائیویٹ پروجیکٹ بنائیں (Private Repository)' : 'Create as Private Project'}</span>
                    </label>
                  </div>
                </div>
              ) : (
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between">
                    <label className="block text-slate-300 font-semibold">
                      {isUrdu ? 'موجودہ پروجیکٹ منتخب کریں:' : 'Select Project:'}
                    </label>
                    <button
                      type="button"
                      onClick={() => loadProjects(token, instanceUrl)}
                      className="text-orange-400 hover:underline flex items-center gap-1 text-[11px]"
                    >
                      <RefreshCw className={`w-3 h-3 ${isProjectListLoading ? 'animate-spin' : ''}`} />
                      <span>{isUrdu ? 'ریفریش کریں' : 'Refresh'}</span>
                    </button>
                  </div>

                  {projects.length > 0 ? (
                    <select
                      value={selectedProjectId}
                      onChange={(e) => setSelectedProjectId(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-orange-500"
                    >
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.path_with_namespace} ({p.visibility})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-slate-500 italic">
                      {isUrdu ? 'کوئی پروجیکٹ نہیں ملا، نیا پروجیکٹ بنائیں' : 'No existing projects found. Create a new one.'}
                    </p>
                  )}
                </div>
              )}

              {/* Project CI Target Type */}
              <div className="pt-2">
                <label className="block text-slate-300 font-semibold mb-1.5 flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5 text-orange-400" />
                    <span>{isUrdu ? 'پروجیکٹ کی قسم (Project CI Type):' : 'Project CI Target:'}</span>
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {targetType === 'website'
                      ? (isUrdu ? 'GitLab Pages لائیو ویب سائٹ' : 'GitLab Pages Web Hosting')
                      : (isUrdu ? 'اینڈرائیڈ APK آٹومیشن بلڈر' : 'Android APK Build Pipeline')}
                  </span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setTargetType('website');
                      setCommitMessage('Deploy website & components via GitLab Safe Uploader');
                    }}
                    className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                      targetType === 'website'
                        ? 'bg-orange-500/20 border-orange-500 text-orange-300 shadow-sm'
                        : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Globe className="w-4 h-4 text-orange-400" />
                    <span>{isUrdu ? '🌐 ویب سائٹ (Pages)' : '🌐 Web (Pages)'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setTargetType('android');
                      setCommitMessage('Upload Android Studio project via GitLab Safe Uploader');
                    }}
                    className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                      targetType === 'android'
                        ? 'bg-orange-500/20 border-orange-500 text-orange-300 shadow-sm'
                        : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Smartphone className="w-4 h-4 text-emerald-400" />
                    <span>{isUrdu ? '📱 اینڈرائیڈ (APK Build)' : '📱 Android (APK)'}</span>
                  </button>
                </div>
              </div>

              {/* Branch & Commit Message */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1 flex items-center gap-1">
                    <GitBranch className="w-3.5 h-3.5 text-orange-400" />
                    <span>{isUrdu ? 'برانچ (Branch):' : 'Branch:'}</span>
                  </label>
                  <input
                    type="text"
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    placeholder="main"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    {isUrdu ? 'کمیٹ میسج (Commit Message):' : 'Commit Message:'}
                  </label>
                  <input
                    type="text"
                    value={commitMessage}
                    onChange={(e) => setCommitMessage(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              {/* Auto Config Toggles */}
              <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center space-x-2 rtl:space-x-reverse">
                  <input
                    type="checkbox"
                    id="gl-auto-ci"
                    checked={autoCiConfig}
                    onChange={(e) => setAutoCiConfig(e.target.checked)}
                    className="rounded bg-slate-950 border-slate-700 text-orange-500 focus:ring-orange-500 w-4 h-4"
                  />
                  <label htmlFor="gl-auto-ci" className="text-slate-300 cursor-pointer flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-orange-400" />
                    <span className="font-semibold">
                      {isUrdu
                        ? 'GitLab Pages کے لیے .gitlab-ci.yml خودکار شامل کریں'
                        : 'Auto-inject .gitlab-ci.yml for zero-config GitLab Pages deployment'}
                    </span>
                  </label>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center space-x-2 rtl:space-x-reverse">
                    <input
                      type="checkbox"
                      id="gl-auto-sanitize"
                      checked={autoSanitizeSecrets}
                      onChange={(e) => setAutoSanitizeSecrets(e.target.checked)}
                      className="rounded bg-slate-950 border-slate-700 text-orange-500 focus:ring-orange-500 w-4 h-4"
                    />
                    <label htmlFor="gl-auto-sanitize" className="text-slate-300 cursor-pointer flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{isUrdu ? 'پش کرنے سے پہلے سیکیور کوڈ سینیٹائز کریں' : 'Auto-sanitize leaked API keys before push'}</span>
                    </label>
                  </div>

                  <button
                    type="button"
                    onClick={handleDownloadCi}
                    className="text-orange-400 hover:text-orange-300 text-[11px] flex items-center gap-1 hover:underline"
                    title={isUrdu ? '.gitlab-ci.yml فائل ڈاؤنلوڈ کریں' : 'Download .gitlab-ci.yml'}
                  >
                    <Download className="w-3 h-3" />
                    <span>{isUrdu ? 'ڈاؤنلوڈ .gitlab-ci.yml' : 'Download CI'}</span>
                  </button>
                </div>
              </div>

            </div>
          )}

          {/* STEP 3: Upload Progress / Result */}
          {uploadState.status !== 'idle' && (
            <div className={`p-4 rounded-xl border space-y-3 ${
              uploadState.status === 'completed'
                ? 'bg-emerald-950/40 border-emerald-500/40'
                : uploadState.status === 'error'
                ? 'bg-red-950/40 border-red-500/40'
                : 'bg-slate-950 border-orange-500/30'
            }`}>
              <div className="flex items-center justify-between">
                <span className="font-bold flex items-center gap-2">
                  {uploadState.status === 'completed' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                  {uploadState.status === 'error' && <AlertCircle className="w-4 h-4 text-red-400" />}
                  {uploadState.status !== 'completed' && uploadState.status !== 'error' && (
                    <RefreshCw className="w-4 h-4 text-orange-400 animate-spin" />
                  )}
                  <span>
                    {uploadState.status === 'completed'
                      ? (isUrdu ? '🎉 مبارک ہو! اپلوڈ کامیابی سے مکمل ہو گیا' : '🎉 Upload Successful!')
                      : uploadState.status === 'error'
                      ? (isUrdu ? 'اپلوڈ میں خرابی' : 'Upload Failed')
                      : (isUrdu ? 'اپلوڈ جاری ہے...' : 'Uploading to GitLab...')}
                  </span>
                </span>
                <span className="font-mono text-xs font-bold text-orange-400">{uploadState.progress}%</span>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
                <div
                  className={`h-full transition-all duration-300 ${
                    uploadState.status === 'completed'
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                      : uploadState.status === 'error'
                      ? 'bg-red-500'
                      : 'bg-gradient-to-r from-orange-500 to-amber-400'
                  }`}
                  style={{ width: `${uploadState.progress}%` }}
                />
              </div>

              {/* Detail Message */}
              {uploadState.detailMessage && (
                <p className="text-slate-300 text-xs">{uploadState.detailMessage}</p>
              )}

              {/* Error Detail */}
              {uploadState.error && (
                <p className="text-red-400 text-xs font-mono">{uploadState.error}</p>
              )}

              {/* Live Links */}
              {uploadState.status === 'completed' && (
                <div className="space-y-3 pt-2 border-t border-slate-800/80">
                  {/* GitLab Pages URL Box with Copy Button */}
                  {uploadState.pagesUrl && targetType === 'website' && (
                    <div className="p-3.5 rounded-xl bg-gradient-to-r from-orange-950/70 via-amber-950/50 to-slate-900 border border-orange-500/40 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                          <Globe className="w-4 h-4 text-amber-400" />
                          <span>{isUrdu ? 'GitLab Pages لائیو ویب سائٹ لنک 🌐' : 'GitLab Pages Live Website URL 🌐'}</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            if (uploadState.pagesUrl) {
                              navigator.clipboard.writeText(uploadState.pagesUrl);
                              setCopiedUrl(true);
                              setTimeout(() => setCopiedUrl(false), 2000);
                            }
                          }}
                          className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-lg text-[11px] font-bold text-slate-200 flex items-center gap-1 transition-colors"
                        >
                          {copiedUrl ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                              <span className="text-emerald-400">{isUrdu ? 'کاپی ہو گیا!' : 'Copied!'}</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5 text-slate-400" />
                              <span>{isUrdu ? 'لنک کاپی کریں' : 'Copy URL'}</span>
                            </>
                          )}
                        </button>
                      </div>

                      <div className="p-2 bg-slate-950/90 rounded-lg border border-slate-800 flex items-center justify-between gap-2 overflow-x-auto">
                        <code className="text-xs font-mono text-amber-200 select-all truncate">
                          {uploadState.pagesUrl}
                        </code>
                        <a
                          href={uploadState.pagesUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="shrink-0 px-3 py-1 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-bold text-xs rounded-md flex items-center gap-1 transition-all shadow"
                        >
                          <span>{isUrdu ? 'ویب سائٹ کھولیں' : 'Open Site'}</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>

                      {/* 404 & Pipeline Resolution Notice */}
                      <div className="p-2.5 bg-slate-900/90 rounded-lg border border-slate-800 text-[11px] text-slate-300 space-y-1.5">
                        <div className="font-semibold text-orange-300 flex items-center gap-1.5">
                          <Info className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                          <span>{isUrdu ? '404 ایرر حل کرنے کی اہم رہنمائی:' : 'Why 404 Happened & Solution:'}</span>
                        </div>
                        <ul className="space-y-1 text-slate-300 list-disc list-inside ps-1">
                          <li>
                            <strong className="text-amber-300">{isUrdu ? 'پروجیکٹ کا مکمل پاتھ:' : 'Full Project Path:'}</strong>{' '}
                            {isUrdu
                              ? 'سکرین شاٹ میں صرف lez786.gitlab.io کھلا تھا۔ GitLab Pages پر ہر پروجیکٹ کا اصل لنک اوپر والا مکمل ایڈریس ہوتا ہے جس کے آخر میں پروجیکٹ کا نام شامل ہوتا ہے۔'
                              : 'The screenshot showed root lez786.gitlab.io. GitLab Pages requires the project path at the end.'}
                          </li>
                          <li>
                            <strong className="text-emerald-300">{isUrdu ? 'پائپ لائن گرین فکس:' : 'Zero-Fail Pipeline:'}</strong>{' '}
                            {isUrdu
                              ? 'ہم نے .gitlab-ci.yml کو اپڈیٹ کر دیا ہے تاکہ پائپ لائن بغیر کسی ایرر کے 100% گرین پاس ہو اور تمام فائلز کو فوری پبلش کرے۔'
                              : 'Updated .gitlab-ci.yml to guarantee green deployment without exit errors.'}
                          </li>
                        </ul>
                      </div>
                    </div>
                  )}

                  {/* Pipelines Direct Link */}
                  {uploadState.repoUrl && (
                    <a
                      href={`${uploadState.repoUrl}/-/pipelines`}
                      target="_blank"
                      rel="noreferrer"
                      className="block p-2.5 rounded-xl bg-slate-900 hover:bg-slate-850 border border-slate-700 text-slate-200 font-bold text-xs flex items-center justify-between group transition-colors"
                    >
                      <span className="flex items-center gap-2">
                        <RefreshCw className="w-4 h-4 text-orange-400" />
                        <span>{isUrdu ? 'GitLab Pipelines لائیو مانیٹر کریں (Green Pass دیکھیں)' : 'Monitor GitLab Pipelines Live (View Status)'}</span>
                      </span>
                      <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-white" />
                    </a>
                  )}

                  {/* Repository Link */}
                  {uploadState.repoUrl && (
                    <a
                      href={uploadState.repoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="block p-2.5 rounded-xl bg-slate-900 hover:bg-slate-850 border border-slate-700 text-slate-300 font-medium text-xs flex items-center justify-between group transition-colors"
                    >
                      <span className="flex items-center gap-2">
                        <FolderPlus className="w-4 h-4 text-slate-400" />
                        <span>{isUrdu ? 'GitLab ریپوزٹری فائلز دیکھیں' : 'View GitLab Repository Code'}</span>
                      </span>
                      <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-white" />
                    </a>
                  )}
                </div>
              )}
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-xs transition-colors"
          >
            {isUrdu ? 'بند کریں' : 'Close'}
          </button>

          <button
            type="button"
            onClick={handleStartUpload}
            disabled={!user || uploadState.status === 'uploading_blobs' || uploadState.status === 'committing'}
            className="px-5 py-2.5 bg-gradient-to-r from-orange-600 via-amber-600 to-yellow-600 hover:from-orange-500 hover:to-yellow-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition-all shadow-lg shadow-orange-600/25 flex items-center gap-2"
          >
            <Send className="w-4 h-4" />
            <span>{isUrdu ? 'GitLab پر براہ راست اپلوڈ کریں' : 'Push to GitLab Now'}</span>
          </button>
        </div>

      </div>
    </div>
  );
};
