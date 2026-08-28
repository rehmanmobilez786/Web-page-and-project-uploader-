import React from 'react';
import { Github, Smartphone, FileArchive, HelpCircle, Sparkles, CheckCircle2, Globe } from 'lucide-react';

interface HeaderProps {
  language: 'ur' | 'en';
  onLanguageToggle: () => void;
  onOpenGuide: () => void;
  onOpenPagesGuide?: () => void;
  hasFiles: boolean;
  fileName?: string;
}

export const Header: React.FC<HeaderProps> = ({
  language,
  onLanguageToggle,
  onOpenGuide,
  onOpenPagesGuide,
  hasFiles,
  fileName
}) => {
  const isUrdu = language === 'ur';

  return (
    <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-30 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Brand & Title */}
        <div className="flex items-center space-x-3 rtl:space-x-reverse">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-emerald-500 via-teal-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <Github className="w-5 h-5 text-slate-950 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center space-x-2 rtl:space-x-reverse">
              <h1 className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-200 to-slate-400">
                {isUrdu ? 'گیٹ ہب پروجیکٹ و ویب سائٹ اپلوڈر' : 'GitHub Code & Website Uploader'}
              </h1>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Github className="w-3 h-3 me-1 inline" /> v2.0
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              {isUrdu
                ? 'اینڈرائڈ پروجیکٹس (ZIP) اور ویب سائٹ پیجز (HTML/CSS/JS) براہ راست GitHub پر اپلوڈ کریں'
                : 'Upload Android Apps (ZIP) & Website Pages (HTML/CSS/JS) directly to GitHub'}
            </p>
          </div>
        </div>

        {/* Status & Actions */}
        <div className="flex items-center space-x-2.5 rtl:space-x-reverse">
          {hasFiles && (
            <div className="hidden md:flex items-center space-x-2 rtl:space-x-reverse text-xs bg-slate-800/80 text-emerald-300 px-3 py-1.5 rounded-lg border border-slate-700">
              <FileArchive className="w-3.5 h-3.5 text-emerald-400" />
              <span className="truncate max-w-[150px] font-medium">{fileName}</span>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            </div>
          )}

          {onOpenPagesGuide && (
            <button
              onClick={onOpenPagesGuide}
              className="flex items-center space-x-1.5 rtl:space-x-reverse px-3 py-1.5 text-xs font-semibold bg-cyan-950 hover:bg-cyan-900 text-cyan-300 rounded-lg transition-colors border border-cyan-700/60"
              title={isUrdu ? 'GitHub Pages لائیو ہوسٹنگ کی تفصیلات' : 'GitHub Pages Hosting Guide'}
            >
              <Globe className="w-4 h-4 text-cyan-400" />
              <span className="hidden sm:inline">{isUrdu ? 'ویب ڈیپلائی گائیڈ' : 'Pages Guide'}</span>
            </button>
          )}

          <button
            onClick={onOpenGuide}
            className="flex items-center space-x-1.5 rtl:space-x-reverse px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors border border-slate-700"
            title={isUrdu ? 'استعمال کی راہنمائی' : 'Usage Guide'}
          >
            <HelpCircle className="w-4 h-4 text-cyan-400" />
            <span className="hidden sm:inline">{isUrdu ? 'ہدایات' : 'Guide'}</span>
          </button>

          <button
            onClick={onLanguageToggle}
            className="px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors flex items-center space-x-1 rtl:space-x-reverse shadow-sm"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{isUrdu ? 'English' : 'اردو'}</span>
          </button>
        </div>

      </div>
    </header>
  );
};
