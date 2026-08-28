import React, { useState, useMemo } from 'react';
import { ExtractedFile } from '../types';
import { CodeEditorPreview } from './CodeEditorPreview';
import {
  Search,
  Copy,
  Check,
  FileText,
  FileCode,
  Code,
  Settings,
  Eye,
  Github,
  CheckSquare,
  Square,
  Sparkles,
  Filter,
  Columns,
  List
} from 'lucide-react';

interface FileTreeInspectorProps {
  files: ExtractedFile[];
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: (select: boolean) => void;
  onOpenGitHubUpload: () => void;
  language: 'ur' | 'en';
}

type FilterCategory = 'all' | 'kt_java' | 'xml' | 'gradle' | 'other';

export const FileTreeInspector: React.FC<FileTreeInspectorProps> = ({
  files,
  onToggleSelect,
  onToggleSelectAll,
  onOpenGitHubUpload,
  language
}) => {
  const isUrdu = language === 'ur';

  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<FilterCategory>('all');
  const [modalPreviewFile, setModalPreviewFile] = useState<ExtractedFile | null>(null);
  const [panePreviewFile, setPanePreviewFile] = useState<ExtractedFile | null>(null);
  const [isSplitPaneMode, setIsSplitPaneMode] = useState(true);

  // Copy status indicators
  const [copiedPathId, setCopiedPathId] = useState<string | null>(null);
  const [copiedContentId, setCopiedContentId] = useState<string | null>(null);
  const [copiedCombinedId, setCopiedCombinedId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Filtered files
  const filteredFiles = useMemo(() => {
    return files.filter((file) => {
      // Category filter
      if (activeCategory === 'kt_java' && !['kt', 'java'].includes(file.ext)) return false;
      if (activeCategory === 'xml' && file.ext !== 'xml') return false;
      if (activeCategory === 'gradle' && !['gradle', 'kts'].includes(file.ext)) return false;
      if (activeCategory === 'other' && ['kt', 'java', 'xml', 'gradle', 'kts'].includes(file.ext))
        return false;

      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        return file.path.toLowerCase().includes(query) || file.name.toLowerCase().includes(query);
      }

      return true;
    });
  }, [files, activeCategory, searchQuery]);

  const selectedCount = useMemo(() => files.filter((f) => f.isSelected).length, [files]);
  const isAllSelected = selectedCount === files.length && files.length > 0;

  // Copy Handlers
  const handleCopyPath = (file: ExtractedFile, e?: React.MouseEvent) => {
    e?.stopPropagation();
    navigator.clipboard.writeText(file.path);
    setCopiedPathId(file.id);
    setTimeout(() => setCopiedPathId(null), 2000);
    showToast(
      isUrdu
        ? `پاتھ کاپی ہو گیا: ${file.name}`
        : `Path copied: ${file.path}`
    );
  };

  const handleCopyContent = (file: ExtractedFile, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (file.isBinary) {
      showToast(isUrdu ? 'بائنری فائل کا ٹیکسٹ کاپی نہیں کیا جا سکتا' : 'Binary file content cannot be copied as text');
      return;
    }
    navigator.clipboard.writeText(file.content);
    setCopiedContentId(file.id);
    setTimeout(() => setCopiedContentId(null), 2000);
    showToast(
      isUrdu
        ? `فائل کا مکمل مواد کاپی ہو گیا: ${file.name}`
        : `Content copied: ${file.name}`
    );
  };

  const handleCopyCombined = (file: ExtractedFile, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (file.isBinary) {
      showToast(isUrdu ? 'بائنری فائل' : 'Binary file');
      return;
    }

    const combinedText = `FilePath: ${file.path}\n\n==================== CONTENT ====================\n${file.content}`;
    navigator.clipboard.writeText(combinedText);
    setCopiedCombinedId(file.id);
    setTimeout(() => setCopiedCombinedId(null), 2000);
    showToast(
      isUrdu
        ? `پاتھ اور کوڈ مواد دونوں کاپی ہو گئے!`
        : `Path & Content both copied to clipboard!`
    );
  };

  const getFileIcon = (ext: string, isBinary: boolean) => {
    if (ext === 'kt' || ext === 'java')
      return <Code className="w-4 h-4 text-cyan-400 shrink-0" />;
    if (ext === 'xml')
      return <FileCode className="w-4 h-4 text-amber-400 shrink-0" />;
    if (ext === 'gradle' || ext === 'kts')
      return <Settings className="w-4 h-4 text-emerald-400 shrink-0" />;
    if (isBinary)
      return <FileText className="w-4 h-4 text-slate-500 shrink-0" />;
    return <FileText className="w-4 h-4 text-indigo-400 shrink-0" />;
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-500 text-slate-950 px-4 py-2.5 rounded-xl font-bold shadow-2xl flex items-center space-x-2 rtl:space-x-reverse animate-bounce">
          <Sparkles className="w-4 h-4 text-slate-950" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Action Header Bar */}
      <div className="p-4 bg-slate-800/80 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4">
        
        {/* Left: Search & Filter */}
        <div className="flex flex-1 items-center space-x-3 rtl:space-x-reverse min-w-[280px]">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                isUrdu
                  ? 'فائل کا نام یا پاتھ تلاش کریں (e.g. MainActivity, build.gradle)...'
                  : 'Search by file name or path...'
              }
              className="w-full bg-slate-950 border border-slate-700/80 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <button
            onClick={() => onToggleSelectAll(!isAllSelected)}
            className="flex items-center space-x-1.5 rtl:space-x-reverse px-3 py-2 bg-slate-950 border border-slate-700/80 rounded-xl text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors shrink-0"
          >
            {isAllSelected ? (
              <CheckSquare className="w-4 h-4 text-emerald-400" />
            ) : (
              <Square className="w-4 h-4 text-slate-500" />
            )}
            <span>
              {isUrdu
                ? `${selectedCount}/${files.length} منتخب`
                : `${selectedCount}/${files.length} selected`}
            </span>
          </button>
        </div>

        {/* Right: Direct GitHub Upload CTA */}
        <button
          onClick={onOpenGitHubUpload}
          className="flex items-center space-x-2 rtl:space-x-reverse px-5 py-2.5 bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-600/20 transition-all hover:scale-[1.02] shrink-0"
        >
          <Github className="w-4 h-4" />
          <span>
            {isUrdu
              ? 'ڈائریکٹ GitHub پر اپلوڈ کریں (Push to GitHub)'
              : 'Push Directly to GitHub'}
          </span>
        </button>

      </div>

      {/* Filter Chips & View Mode Bar */}
      <div className="px-4 py-2.5 bg-slate-900/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-slate-400 font-medium me-1 flex items-center">
            <Filter className="w-3.5 h-3.5 me-1 text-slate-500" />
            {isUrdu ? 'فائل فلٹر:' : 'Filter:'}
          </span>

          {[
            { id: 'all', labelUr: `تمام فائلیں (${files.length})`, labelEn: `All (${files.length})` },
            { id: 'kt_java', labelUr: 'Kotlin / Java سورس', labelEn: 'Kotlin/Java' },
            { id: 'xml', labelUr: 'Layout XMLs', labelEn: 'XML Layouts' },
            { id: 'gradle', labelUr: 'Gradle سکرپٹس', labelEn: 'Gradle' },
            { id: 'other', labelUr: 'دیگر تنظیمات', labelEn: 'Configs/Other' },
          ].map((chip) => (
            <button
              key={chip.id}
              onClick={() => setActiveCategory(chip.id as FilterCategory)}
              className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                activeCategory === chip.id
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
              }`}
            >
              {isUrdu ? chip.labelUr : chip.labelEn}
            </button>
          ))}
        </div>

        {/* View Mode Toggle: Split Pane Code Editor vs Standard List */}
        <div className="flex items-center space-x-1 rtl:space-x-reverse shrink-0">
          <button
            onClick={() => {
              setIsSplitPaneMode(!isSplitPaneMode);
              if (!panePreviewFile && filteredFiles.length > 0) {
                setPanePreviewFile(filteredFiles[0]);
              }
            }}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center space-x-1.5 rtl:space-x-reverse border transition-colors ${
              isSplitPaneMode
                ? 'bg-cyan-950/80 text-cyan-300 border-cyan-700/60'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200 border-slate-700'
            }`}
            title={isUrdu ? 'سائڈ بائی سائڈ کوڈ ایڈیٹر ویو' : 'Toggle Interactive Preview Pane'}
          >
            <Columns className="w-3.5 h-3.5 text-cyan-400" />
            <span>{isUrdu ? 'کوڈ ایڈیٹر پین' : 'Code Preview Pane'}</span>
          </button>
        </div>
      </div>

      {/* Main Container Layout: Split Pane or Single List */}
      <div className={`grid ${isSplitPaneMode ? 'grid-cols-1 lg:grid-cols-12' : 'grid-cols-1'} min-h-[480px]`}>
        
        {/* File List Column */}
        <div className={`divide-y divide-slate-800/60 max-h-[600px] overflow-y-auto ${isSplitPaneMode ? 'lg:col-span-5 border-r border-slate-800' : 'w-full'}`}>
          {filteredFiles.length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-sm">
              {isUrdu
                ? 'کوئی فائل نہیں ملی۔ تلاش یا فلٹر تبدیل کریں۔'
                : 'No matching files found. Try clearing your search.'}
            </div>
          ) : (
            filteredFiles.map((file) => {
              const isSelectedForPane = panePreviewFile?.id === file.id;

              return (
                <div
                  key={file.id}
                  onClick={() => setPanePreviewFile(file)}
                  className={`group px-4 py-3 transition-colors cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    isSelectedForPane
                      ? 'bg-slate-800/90 border-l-4 border-cyan-400'
                      : file.isSelected
                      ? 'bg-slate-900/80 hover:bg-slate-800/60'
                      : 'bg-slate-950/40 opacity-75 hover:opacity-100 hover:bg-slate-800/40'
                  }`}
                >
                  {/* File Info */}
                  <div className="flex items-center space-x-3 rtl:space-x-reverse min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleSelect(file.id);
                      }}
                      className="text-slate-500 hover:text-emerald-400 focus:outline-none shrink-0"
                    >
                      {file.isSelected ? (
                        <CheckSquare className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-600" />
                      )}
                    </button>

                    {getFileIcon(file.ext, file.isBinary)}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center space-x-2 rtl:space-x-reverse">
                        <span
                          className={`text-xs font-mono font-medium truncate ${
                            isSelectedForPane ? 'text-cyan-300 font-bold' : 'text-slate-200 hover:text-cyan-300'
                          }`}
                          title={file.path}
                        >
                          {file.path}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2 rtl:space-x-reverse text-[11px] text-slate-500 mt-0.5">
                        <span>{file.ext ? `.${file.ext}` : 'file'}</span>
                        <span>•</span>
                        <span>{(file.size / 1024).toFixed(1)} KB</span>
                        {!file.isBinary && file.lineCount !== undefined && (
                          <>
                            <span>•</span>
                            <span>{file.lineCount} lines</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons for Easy Copying / Pasting */}
                  <div className="flex items-center space-x-1.5 rtl:space-x-reverse shrink-0 self-end sm:self-center" onClick={(e) => e.stopPropagation()}>
                    
                    {/* Copy Path */}
                    <button
                      onClick={(e) => handleCopyPath(file, e)}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-medium border border-slate-700/80 transition-colors flex items-center space-x-1 rtl:space-x-reverse"
                      title={isUrdu ? 'صرف پاتھ (Path) کاپی کریں' : 'Copy File Path'}
                    >
                      {copiedPathId === file.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5 text-slate-400" />
                      )}
                      <span className="text-[11px]">{isUrdu ? 'پاتھ' : 'Path'}</span>
                    </button>

                    {/* Copy Content */}
                    <button
                      disabled={file.isBinary}
                      onClick={(e) => handleCopyContent(file, e)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors flex items-center space-x-1 rtl:space-x-reverse ${
                        file.isBinary
                          ? 'bg-slate-900 text-slate-600 border-slate-800 cursor-not-allowed'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border-slate-700/80'
                      }`}
                      title={isUrdu ? 'صرف فائل کوڈ/مواد کاپی کریں' : 'Copy Code Content'}
                    >
                      {copiedContentId === file.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <FileText className="w-3.5 h-3.5 text-cyan-400" />
                      )}
                      <span className="text-[11px]">{isUrdu ? 'کوڈ' : 'Content'}</span>
                    </button>

                    {/* Copy Path + Content Combined */}
                    <button
                      disabled={file.isBinary}
                      onClick={(e) => handleCopyCombined(file, e)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold border transition-all flex items-center space-x-1 rtl:space-x-reverse ${
                        file.isBinary
                          ? 'bg-slate-900 text-slate-600 border-slate-800 cursor-not-allowed'
                          : 'bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border-emerald-700/60 shadow-sm'
                      }`}
                      title={
                        isUrdu
                          ? 'پاتھ + کوڈ دونوں اکٹھا کاپی کریں'
                          : 'Copy Path & Content together'
                      }
                    >
                      {copiedCombinedId === file.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                      )}
                      <span className="text-[11px]">
                        {isUrdu ? 'پاتھ + مواد' : 'Path & Code'}
                      </span>
                    </button>

                    {/* View Code Modal Trigger */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setModalPreviewFile(file);
                      }}
                      className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 rounded-lg border border-slate-700/80 transition-colors"
                      title={isUrdu ? 'فل سکرین ایڈیٹر پریویو (Full Modal)' : 'Fullscreen Preview Window'}
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>

                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Embedded Interactive Code Editor Preview Pane */}
        {isSplitPaneMode && (
          <div className="lg:col-span-7 bg-slate-950 flex flex-col min-h-[500px] border-t lg:border-t-0 border-slate-800">
            {panePreviewFile ? (
              <CodeEditorPreview
                file={panePreviewFile}
                language={language}
                onClose={() => setPanePreviewFile(null)}
              />
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-slate-500 text-center space-y-3">
                <Code className="w-12 h-12 text-slate-700" />
                <p className="text-sm font-medium">
                  {isUrdu ? 'کسی فائل پر کلک کریں تاکہ کوڈ ہائی لائٹڈ ایڈیٹر ونڈو میں دیکھے' : 'Click any file on the left to inspect inside the interactive code editor'}
                </p>
              </div>
            )}
          </div>
        )}

      </div>

      {/* Code Preview Modal Window */}
      {modalPreviewFile && (
        <CodeEditorPreview
          file={modalPreviewFile}
          language={language}
          isModal={true}
          onClose={() => setModalPreviewFile(null)}
        />
      )}

    </div>
  );
};
