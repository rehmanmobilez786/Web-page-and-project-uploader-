import React, { useRef, useState } from 'react';
import { UploadCloud, FileArchive, Sparkles, AlertCircle, RefreshCw, CheckCircle, Globe, Smartphone, FileCode2 } from 'lucide-react';

interface ZipUploaderProps {
  onFileSelect: (file: File) => void;
  onWebFilesSelect?: (files: FileList | File[]) => void;
  onLoadAndroidDemo: () => void;
  onLoadWebsiteDemo: () => void;
  isLoading: boolean;
  language: 'ur' | 'en';
}

export const ZipUploader: React.FC<ZipUploaderProps> = ({
  onFileSelect,
  onWebFilesSelect,
  onLoadAndroidDemo,
  onLoadWebsiteDemo,
  isLoading,
  language
}) => {
  const isUrdu = language === 'ur';
  const fileInputRef = useRef<HTMLInputElement>(null);
  const webFileInputRef = useRef<HTMLInputElement>(null);

  const [isDragOver, setIsDragOver] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    setErrorMessage(null);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFiles: File[] = Array.from(e.dataTransfer.files);
      const zipFile = droppedFiles.find((f: File) => f.name.toLowerCase().endsWith('.zip'));

      if (zipFile) {
        onFileSelect(zipFile);
      } else if (onWebFilesSelect && droppedFiles.length > 0) {
        onWebFilesSelect(droppedFiles);
      } else {
        setErrorMessage(
          isUrdu
            ? 'براہ کرم .zip فائل یا ویب پیج فائلیں (HTML, CSS, JS) ڈراپ کریں۔'
            : 'Please drop a .zip file or website files (.html, .css, .js).'
        );
      }
    }
  };

  const handleZipChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMessage(null);
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      if (file.name.toLowerCase().endsWith('.zip')) {
        onFileSelect(file);
      } else if (onWebFilesSelect) {
        onWebFilesSelect(e.target.files);
      }
    }
  };

  const handleWebFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMessage(null);
    if (e.target.files && e.target.files.length > 0 && onWebFilesSelect) {
      onWebFilesSelect(e.target.files);
    }
  };

  return (
    <div className="w-full space-y-4">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-200 group ${
          isDragOver
            ? 'border-emerald-500 bg-emerald-500/10 scale-[1.01]'
            : 'border-slate-700 bg-slate-800/60 hover:border-emerald-500/50 hover:bg-slate-800'
        }`}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleZipChange}
          accept=".zip,application/zip,application/x-zip-compressed,application/octet-stream,.html,.css,.js,.php,.json,.svg,.png,.jpg"
          className="hidden"
          multiple
        />

        <input
          type="file"
          ref={webFileInputRef}
          onChange={handleWebFileChange}
          accept=".html,.css,.js,.jsx,.tsx,.ts,.json,.php,.svg,.png,.jpg,.jpeg,.webp"
          className="hidden"
          multiple
        />

        <div className="flex flex-col items-center justify-center space-y-4">
          <div className="flex items-center space-x-3 rtl:space-x-reverse">
            <div className="h-14 w-14 rounded-2xl bg-slate-900/80 border border-slate-700 flex items-center justify-center text-emerald-400 group-hover:scale-105 group-hover:border-emerald-500/40 transition-transform shadow-lg">
              {isLoading ? (
                <RefreshCw className="w-7 h-7 animate-spin text-emerald-400" />
              ) : (
                <Smartphone className="w-7 h-7 text-emerald-400" />
              )}
            </div>
            <div className="h-14 w-14 rounded-2xl bg-slate-900/80 border border-slate-700 flex items-center justify-center text-cyan-400 group-hover:scale-105 group-hover:border-cyan-500/40 transition-transform shadow-lg">
              <Globe className="w-7 h-7 text-cyan-400" />
            </div>
          </div>

          <div className="space-y-1">
            <h3 className="text-lg font-bold text-slate-100">
              {isUrdu
                ? 'اینڈرائڈ پروجیکٹ (ZIP) یا ویب سائٹ پیج فائلیں ڈراپ کریں'
                : 'Drag & Drop Android ZIP or Website Page files'}
            </h3>
            <p className="text-sm text-slate-400">
              {isUrdu
                ? 'کمپیوٹر سے Android ZIP یا HTML, CSS, JS ویب پیج فائلیں اپلوڈ کرنے کے لیے کلک کریں'
                : 'Click to select Android ZIPs or HTML, CSS, JS website files'}
            </p>
          </div>

          <div className="flex flex-wrap justify-center items-center gap-2 pt-1">
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
              <Smartphone className="w-3.5 h-3.5" />
              {isUrdu ? 'اینڈرائڈ پروجیکٹس (ZIP)' : 'Android ZIP Projects'}
            </span>
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center gap-1">
              <Globe className="w-3.5 h-3.5" />
              {isUrdu ? 'ویب سائٹ پیجز (HTML, CSS, JS)' : 'Website Pages (HTML/CSS/JS)'}
            </span>
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                webFileInputRef.current?.click();
              }}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
            >
              <FileCode2 className="w-4 h-4 text-cyan-400" />
              <span>{isUrdu ? 'برائے راست ویب سائٹ فائلیں منتخب کریں (.html, .css, .js)' : 'Select Loose Website Files (.html, .css, .js)'}</span>
            </button>
          </div>
        </div>
      </div>

      {errorMessage && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center space-x-2 rtl:space-x-reverse text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Demo Projects Triggers */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-2 text-xs text-slate-400 bg-slate-900/60 border border-slate-800 p-3 rounded-xl">
        <span className="flex items-center space-x-1.5 rtl:space-x-reverse">
          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>
            {isUrdu
              ? 'تمام اینڈرائڈ ایپ اور ویب سائٹ پیج فائلیں (HTML/CSS/JS) سپورٹڈ ہیں۔'
              : 'Supports all Android apps (ZIP) and Website page files.'}
          </span>
        </span>

        <div className="flex items-center space-x-3 rtl:space-x-reverse">
          <button
            type="button"
            onClick={onLoadAndroidDemo}
            className="flex items-center space-x-1 rtl:space-x-reverse text-emerald-400 hover:text-emerald-300 font-semibold underline underline-offset-4"
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>
              {isUrdu ? 'ڈیمو اینڈرائڈ ایپ' : 'Demo Android App'}
            </span>
          </button>

          <span className="text-slate-600">|</span>

          <button
            type="button"
            onClick={onLoadWebsiteDemo}
            className="flex items-center space-x-1 rtl:space-x-reverse text-cyan-400 hover:text-cyan-300 font-semibold underline underline-offset-4"
          >
            <Globe className="w-3.5 h-3.5" />
            <span>
              {isUrdu ? 'ڈیمو ویب سائٹ پیج' : 'Demo Website Page'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
