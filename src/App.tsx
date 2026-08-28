import React, { useState } from 'react';
import { ExtractedFile, ProjectMetadata } from './types';
import { parseZipFile, parseWebFiles, createDemoAndroidProject, createDemoWebsiteProject, exportFilesToZip, patchFilesForGitHubPages, downloadWorkflowZip } from './utils/zip';
import { Header } from './components/Header';
import { ZipUploader } from './components/ZipUploader';
import { AndroidProjectSummary } from './components/AndroidProjectSummary';
import { FileTreeInspector } from './components/FileTreeInspector';
import { GitHubUploaderModal } from './components/GitHubUploaderModal';
import { QuickGuideModal } from './components/QuickGuideModal';
import { Github, FileArchive, Trash2, ArrowUpRight, Sparkles, CheckCircle, ShieldCheck, Globe, Smartphone, Download } from 'lucide-react';

import { LiveWebPreviewModal } from './components/LiveWebPreviewModal';
import { GitHubPagesGuideModal } from './components/GitHubPagesGuideModal';
import { GitHubSecurityShield } from './components/GitHubSecurityShield';

export default function App() {
  const [language, setLanguage] = useState<'ur' | 'en'>('ur');
  const isUrdu = language === 'ur';

  const [files, setFiles] = useState<ExtractedFile[]>([]);
  const [metadata, setMetadata] = useState<ProjectMetadata | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [zipFileName, setZipFileName] = useState<string>('');

  const [isGitHubModalOpen, setIsGitHubModalOpen] = useState(false);
  const [isGuideModalOpen, setIsGuideModalOpen] = useState(false);
  const [isLiveWebModalOpen, setIsLiveWebModalOpen] = useState(false);
  const [isPagesGuideModalOpen, setIsPagesGuideModalOpen] = useState(false);

  const handleFilesUpdate = (updatedFiles: ExtractedFile[]) => {
    setFiles(updatedFiles);
  };

  // Handle Upload of ZIP
  const handleFileSelect = async (file: File) => {
    setIsLoading(true);
    setZipFileName(file.name);
    try {
      const result = await parseZipFile(file);
      setFiles(result.files);
      setMetadata(result.metadata);
    } catch (error: any) {
      alert(isUrdu ? `فائل کھولنے میں ایرر: ${error.message}` : `Failed to extract zip file: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Upload of Direct Web Files (.html, .css, .js)
  const handleWebFilesSelect = async (rawFiles: FileList | File[]) => {
    setIsLoading(true);
    const fileList = Array.from(rawFiles);
    const mainName = fileList[0]?.name || 'WebFiles';
    setZipFileName(`${mainName} (${fileList.length} files)`);
    try {
      const result = await parseWebFiles(fileList);
      setFiles(result.files);
      setMetadata(result.metadata);
    } catch (error: any) {
      alert(isUrdu ? `فائلیں پروسیس کرنے میں ایرر: ${error.message}` : `Failed to process web files: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Load Demo Android Project
  const handleLoadAndroidDemo = () => {
    setIsLoading(true);
    setTimeout(() => {
      const demo = createDemoAndroidProject();
      setFiles(demo.files);
      setMetadata(demo.metadata);
      setZipFileName('DemoAndroidApp.zip');
      setIsLoading(false);
    }, 400);
  };

  // Load Demo Website Project
  const handleLoadWebsiteDemo = () => {
    setIsLoading(true);
    setTimeout(() => {
      const demo = createDemoWebsiteProject();
      setFiles(demo.files);
      setMetadata(demo.metadata);
      setZipFileName('DemoWebsitePage');
      setIsLoading(false);
    }, 400);
  };

  const handleExportZip = async () => {
    if (files.length === 0) return;
    const name = metadata?.projectName || 'project-source';
    await exportFilesToZip(files, `${name}.zip`);
  };

  const handleDownloadWorkflowZip = async () => {
    const isAndroid = metadata?.projectType === 'android' || files.some(f => f.ext === 'kt' || f.name === 'AndroidManifest.xml');
    await downloadWorkflowZip(isAndroid ? 'android' : 'website', true);
  };

  const handleAutoFixWhiteScreen = () => {
    if (files.length === 0) return;
    const patched = patchFilesForGitHubPages(files);
    setFiles(patched);
    alert(
      isUrdu
        ? 'کامیابی! GitHub Pages کے لیے تمام وائٹ پیج ایشوز حل کر دیے گئے ہیں: (1) index.html روٹ پر لگا دی گئی (2) Relative Asset Paths (./) اور base: "./" سیٹ کر دیے گئے (3) .nojekyll، 404.html اور GitHub Actions Workflow خودکار شامل کر دیے گئے۔ اب ڈاؤنلوڈ یا اپلوڈ کریں، لائیو چلے گا!'
        : 'Success! Resolved all White Screen / Blank Page issues for GitHub Pages: (1) Hoisted index.html to root (2) Fixed relative asset paths (./) and base: "./" (3) Auto-injected .nojekyll, 404.html, and GitHub Actions workflow. Ready for live upload or ZIP download!'
    );
  };

  const handleToggleSelect = (id: string) => {
    setFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, isSelected: !f.isSelected } : f))
    );
  };

  const handleToggleSelectAll = (select: boolean) => {
    setFiles((prev) => prev.map((f) => ({ ...f, isSelected: select })));
  };

  const handleReset = () => {
    setFiles([]);
    setMetadata(null);
    setZipFileName('');
  };

  return (
    <div className={`min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col ${isUrdu ? 'rtl' : 'ltr'}`}>
      
      {/* Header */}
      <Header
        language={language}
        onLanguageToggle={() => setLanguage(language === 'ur' ? 'en' : 'ur')}
        onOpenGuide={() => setIsGuideModalOpen(true)}
        onOpenPagesGuide={() => setIsPagesGuideModalOpen(true)}
        hasFiles={files.length > 0}
        fileName={zipFileName}
      />

      {/* Main Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        
        {files.length === 0 ? (
          /* Landing Upload Zone */
          <div className="max-w-3xl mx-auto space-y-6">
            
            <div className="text-center space-y-3 pt-4">
              <div className="inline-flex items-center space-x-2 rtl:space-x-reverse px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
                <Sparkles className="w-3.5 h-3.5" />
                <span>
                  {isUrdu
                    ? 'اینڈرائڈ ایپس اور ویب سائٹ پیجز برائے راست GitHub اپلوڈر'
                    : 'Android Apps & Website Pages Direct GitHub Publisher'}
                </span>
              </div>

              <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-100 tracking-tight leading-tight">
                {isUrdu
                  ? 'اینڈرائڈ پروجیکٹس (ZIP) یا ویب سائٹ فائلیں اپلوڈ کریں'
                  : 'Upload Android Projects (ZIP) or Website Files'}
              </h2>

              <p className="text-slate-400 text-sm max-w-xl mx-auto">
                {isUrdu
                  ? 'اینڈرائڈ ایپس (Kotlin/Java) یا ویب سائٹ پیجز (HTML/CSS/JS) کی فائلیں منتخب کریں، فائلیں دیکھ کر کاپی کریں یا براہ راست GitHub پر 1-Click میں پش کریں۔'
                  : 'Extract Android projects or Website files, inspect code snippets, and upload directly to GitHub repositories with automated Action workflows.'}
              </p>
            </div>

            <ZipUploader
              onFileSelect={handleFileSelect}
              onWebFilesSelect={handleWebFilesSelect}
              onLoadAndroidDemo={handleLoadAndroidDemo}
              onLoadWebsiteDemo={handleLoadWebsiteDemo}
              isLoading={isLoading}
              language={language}
            />

            {/* Feature Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
              <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl space-y-2">
                <div className="p-2 w-fit rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center gap-1.5">
                  <Smartphone className="w-4 h-4" />
                  <Globe className="w-4 h-4" />
                </div>
                <h4 className="text-sm font-bold text-slate-200">
                  {isUrdu ? 'اینڈرائڈ اور ویب سائٹس' : 'Android & Web Pages'}
                </h4>
                <p className="text-xs text-slate-400">
                  {isUrdu
                    ? 'اینڈرائڈ کی ZIP فائلیں اور HTML/CSS/JS ویب پیج فائلیں خودکار طریقے سے سپورٹ ہوتی ہیں۔'
                    : 'Supports full Android source ZIPs and static HTML/CSS/JS website pages.'}
                </p>
              </div>

              <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl space-y-2">
                <div className="p-2 w-fit rounded-lg bg-emerald-500/10 text-emerald-400">
                  <Github className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-bold text-slate-200">
                  {isUrdu ? '1-Click GitHub اپلوڈ' : 'Direct GitHub Commit'}
                </h4>
                <p className="text-xs text-slate-400">
                  {isUrdu
                    ? 'PAT ٹوکن سے نئی ریپوزٹری بنائیں، APK بلڈ ورک فلو یا GitHub Pages لائیو ڈیپلائمنٹ شامل کریں۔'
                    : 'Create repos with PAT token, auto-inject APK builder or GitHub Pages deploy workflows.'}
                </p>
              </div>

              <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl space-y-2">
                <div className="p-2 w-fit rounded-lg bg-amber-500/10 text-amber-400">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-bold text-slate-200">
                  {isUrdu ? 'پاتھ اور مواد کاپی' : 'Path & Content Copy'}
                </h4>
                <p className="text-xs text-slate-400">
                  {isUrdu
                    ? 'فائل پاتھ اور کوڈ مینوئل کاپی پیسٹ کرنے کے لیے آسان 1-کلک کاپی فیچر۔'
                    : 'One-click copy formatted Relative Path & Content for manual paste.'}
                </p>
              </div>
            </div>

          </div>
        ) : (
          /* Active Extracted Project Dashboard */
          <div className="space-y-6">
            
            {/* Top Bar for Reset / Quick Actions */}
            <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-4 rounded-2xl">
              <div className="flex items-center space-x-3 rtl:space-x-reverse">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
                  <CheckCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                    {metadata?.projectType === 'android' ? (
                      <span>{isUrdu ? 'اینڈرائڈ پروجیکٹ کامیابی سے لوڈ ہو گیا' : 'Android Source Code Ready'}</span>
                    ) : (
                      <span>{isUrdu ? 'ویب سائٹ سورس فائلیں کامیابی سے لوڈ ہو گئیں' : 'Website Source Code Ready'}</span>
                    )}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {zipFileName} ({files.length} {isUrdu ? 'فائلیں' : 'files'})
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Live Web Sandbox Preview & Auto Fix Buttons */}
                {metadata?.projectType === 'website' && (
                  <>
                    <button
                      onClick={() => setIsLiveWebModalOpen(true)}
                      className="px-3.5 py-2 bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-700/60 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
                    >
                      <Globe className="w-4 h-4 text-cyan-400" />
                      <span>{isUrdu ? 'لائیو ویب سائٹ پریویو (Sandbox)' : 'Live Web Preview'}</span>
                    </button>

                    <button
                      onClick={handleAutoFixWhiteScreen}
                      className="px-3 py-2 bg-amber-950/60 hover:bg-amber-900/80 text-amber-300 border border-amber-600/50 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                      title={isUrdu ? 'وائٹ اسکرین فکس کریں (.nojekyll, relative paths, base: ./)' : 'Fix White Screen Issues'}
                    >
                      <Sparkles className="w-4 h-4 text-amber-400" />
                      <span>{isUrdu ? 'وائٹ اسکرین آٹو فکس' : 'Fix White Screen'}</span>
                    </button>
                  </>
                )}

                <button
                  onClick={() => setIsGitHubModalOpen(true)}
                  className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5"
                >
                  <Github className="w-4 h-4" />
                  <span>{isUrdu ? 'GitHub پر اپلوڈ کریں' : 'Upload to GitHub'}</span>
                </button>

                <button
                  onClick={handleExportZip}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                  title={isUrdu ? 'تمام فائلیں ZIP کی صورت میں ڈاؤنلوڈ کریں' : 'Download ZIP Archive'}
                >
                  <Download className="w-4 h-4 text-emerald-400" />
                  <span>{isUrdu ? 'پروجیکٹ ZIP' : 'Project ZIP'}</span>
                </button>

                <button
                  onClick={handleDownloadWorkflowZip}
                  className="px-3.5 py-2 bg-emerald-950/90 hover:bg-emerald-900 text-emerald-300 border border-emerald-700/60 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow"
                  title={isUrdu ? 'صرف .github/workflows کا زپ پاتھ کے ساتھ ڈاؤنلوڈ کریں' : 'Download .github/workflows folder as ZIP'}
                >
                  <Download className="w-4 h-4 text-emerald-400" />
                  <span>{isUrdu ? '📦 Workflow ZIP' : '📦 Workflow ZIP'}</span>
                </button>

                <button
                  onClick={handleReset}
                  className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-red-400 rounded-xl border border-slate-700 transition-colors"
                  title={isUrdu ? 'نئی فائل اپلوڈ کریں' : 'Upload New File'}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Android/Website Project Metadata Summary */}
            {metadata && <AndroidProjectSummary metadata={metadata} language={language} />}

            {/* Anti-Suspension Security Shield */}
            <GitHubSecurityShield
              files={files}
              onFilesUpdate={handleFilesUpdate}
              language={language}
              compact={false}
            />

            {/* Main File Tree Inspector */}
            <FileTreeInspector
              files={files}
              onToggleSelect={handleToggleSelect}
              onToggleSelectAll={handleToggleSelectAll}
              onOpenGitHubUpload={() => setIsGitHubModalOpen(true)}
              language={language}
            />

          </div>
        )}

      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-900/60 py-4 text-center text-xs text-slate-500">
        <p>
          GitHub Code & Website Uploader • {isUrdu ? 'اینڈرائڈ ایپس اور ویب سائٹ پیجز کی فاسٹ پبلشنگ کے لیے ڈیزائن شدہ' : 'Built for fast Android & Website GitHub publishing'}
        </p>
      </footer>

      {/* Modals */}
      <GitHubUploaderModal
        isOpen={isGitHubModalOpen}
        onClose={() => setIsGitHubModalOpen(false)}
        files={files}
        projectName={metadata?.projectName || 'my-project'}
        projectType={metadata?.projectType || 'android'}
        language={language}
        onFilesUpdate={handleFilesUpdate}
      />

      <QuickGuideModal
        isOpen={isGuideModalOpen}
        onClose={() => setIsGuideModalOpen(false)}
        language={language}
      />

      <LiveWebPreviewModal
        isOpen={isLiveWebModalOpen}
        onClose={() => setIsLiveWebModalOpen(false)}
        files={files}
        language={language}
      />

      <GitHubPagesGuideModal
        isOpen={isPagesGuideModalOpen}
        onClose={() => setIsPagesGuideModalOpen(false)}
        language={language}
      />

    </div>
  );
}
