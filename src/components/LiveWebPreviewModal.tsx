import React, { useState, useMemo } from 'react';
import { ExtractedFile } from '../types';
import { X, Globe, RefreshCw, ExternalLink, Monitor, Smartphone, AlertCircle, Code } from 'lucide-react';

interface LiveWebPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  files: ExtractedFile[];
  language: 'ur' | 'en';
}

export const LiveWebPreviewModal: React.FC<LiveWebPreviewModalProps> = ({
  isOpen,
  onClose,
  files,
  language
}) => {
  if (!isOpen) return null;
  const isUrdu = language === 'ur';

  const [deviceMode, setDeviceMode] = useState<'desktop' | 'mobile'>('desktop');
  const [key, setKey] = useState(0);

  // Construct combined HTML document for srcDoc
  const previewHtml = useMemo(() => {
    let indexHtml = files.find(f => f.name.toLowerCase() === 'index.html' || f.ext === 'html')?.content || '';

    if (!indexHtml) {
      return `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: system-ui; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; }
    .box { background: #1e293b; padding: 2rem; border-radius: 1rem; border: 1px solid #334155; max-width: 400px; }
    h2 { color: #38bdf8; }
  </style>
</head>
<body>
  <div class="box">
    <h2>⚠️ No index.html found</h2>
    <p>Please upload an index.html file to render the live web preview.</p>
  </div>
</body>
</html>`;
    }

    // Embed local CSS files into style tags if referenced or available
    const cssFiles = files.filter(f => f.ext === 'css' || f.ext === 'scss');
    let combinedCss = cssFiles.map(f => `/* File: ${f.path} */\n${f.content}`).join('\n\n');

    // Embed local JS files into script tags
    const jsFiles = files.filter(f => (f.ext === 'js' || f.ext === 'ts') && f.name !== 'vite.config.js' && f.name !== 'tailwind.config.js');
    let combinedJs = jsFiles.map(f => `/* File: ${f.path} */\ntry {\n${f.content}\n} catch(err) { console.error('Error in ${f.name}:', err); }`).join('\n\n');

    // Inject CSS into <head>
    if (combinedCss) {
      if (indexHtml.includes('</head>')) {
        indexHtml = indexHtml.replace('</head>', `<style>\n${combinedCss}\n</style>\n</head>`);
      } else {
        indexHtml = `<style>\n${combinedCss}\n</style>\n` + indexHtml;
      }
    }

    // Inject JS before </body>
    if (combinedJs) {
      if (indexHtml.includes('</body>')) {
        indexHtml = indexHtml.replace('</body>', `<script>\n${combinedJs}\n</script>\n</body>`);
      } else {
        indexHtml = indexHtml + `<script>\n${combinedJs}\n</script>`;
      }
    }

    return indexHtml;
  }, [files]);

  const handleOpenNewTab = () => {
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(previewHtml);
      win.document.close();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-5 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-6xl h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Top Header Controls */}
        <div className="bg-slate-950 border-b border-slate-800 px-4 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center space-x-3 rtl:space-x-reverse">
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <span>{isUrdu ? 'لائیو ویب سائٹ پیج پریویو (Live Web Sandbox)' : 'Live Website Page Sandbox'}</span>
                <span className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 rounded">
                  HTML5 / CSS / JS
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                {isUrdu
                  ? 'اپلوڈ شدہ ویب پیج سورس کا لائیو رینڈرڈ پریویو دیکھیں۔'
                  : 'Instant live interactive render of your uploaded website page files.'}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 rtl:space-x-reverse">
            {/* Device Toggle */}
            <div className="bg-slate-900 p-1 rounded-xl border border-slate-800 flex items-center space-x-1 rtl:space-x-reverse">
              <button
                onClick={() => setDeviceMode('desktop')}
                className={`p-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1 rtl:space-x-reverse transition-colors ${
                  deviceMode === 'desktop'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title={isUrdu ? 'ڈیسک ٹاپ ویو' : 'Desktop View'}
              >
                <Monitor className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{isUrdu ? 'ڈیسک ٹاپ' : 'Desktop'}</span>
              </button>

              <button
                onClick={() => setDeviceMode('mobile')}
                className={`p-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1 rtl:space-x-reverse transition-colors ${
                  deviceMode === 'mobile'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title={isUrdu ? 'موبائل ویو' : 'Mobile View'}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{isUrdu ? 'موبائل' : 'Mobile'}</span>
              </button>
            </div>

            {/* Refresh */}
            <button
              onClick={() => setKey(prev => prev + 1)}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition-colors"
              title={isUrdu ? 'دوبارہ رینڈر کریں' : 'Reload Sandbox'}
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            {/* Open New Tab */}
            <button
              onClick={handleOpenNewTab}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-medium border border-slate-700 flex items-center gap-1.5 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden sm:inline">{isUrdu ? 'نئے ٹیب میں کھولیں' : 'Open Full Screen'}</span>
            </button>

            {/* Close */}
            <button
              onClick={onClose}
              className="p-2 bg-slate-800 hover:bg-red-950 hover:text-red-400 text-slate-400 rounded-xl border border-slate-700 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Sandbox Iframe Stage */}
        <div className="flex-1 bg-slate-950 flex items-center justify-center p-3 overflow-hidden relative">
          <div
            className={`h-full transition-all duration-300 rounded-xl overflow-hidden shadow-2xl border border-slate-800 bg-white ${
              deviceMode === 'desktop' ? 'w-full' : 'w-[390px] max-w-full my-auto border-4 border-slate-700 rounded-[32px]'
            }`}
          >
            <iframe
              key={key}
              srcDoc={previewHtml}
              title="Live Website Sandbox Preview"
              className="w-full h-full border-0 bg-white"
              sandbox="allow-scripts allow-modals allow-forms allow-popups allow-same-origin"
            />
          </div>
        </div>

        {/* Footer info bar */}
        <div className="bg-slate-950 border-t border-slate-800 px-4 py-2 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <span className="flex items-center gap-1.5">
            <Code className="w-3.5 h-3.5 text-cyan-400" />
            <span>
              {isUrdu
                ? 'GitHub Pages پر پبلش کرنے کے بعد آپ کی ویب سائٹ پوری دنیا میں لائیو دستیاب ہوگی۔'
                : 'After pushing to GitHub, your site goes live instantly on GitHub Pages.'}
            </span>
          </span>
          <span className="text-[11px] font-mono text-slate-500">
            Render Mode: srcDoc Sandbox
          </span>
        </div>

      </div>
    </div>
  );
};
