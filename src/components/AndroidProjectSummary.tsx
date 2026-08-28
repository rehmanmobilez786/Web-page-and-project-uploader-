import React from 'react';
import { ProjectMetadata } from '../types';
import { Package, Code2, FileCode, Layers, ShieldCheck, FileCheck, Globe, Smartphone, FileText, Image as ImageIcon } from 'lucide-react';

interface AndroidProjectSummaryProps {
  metadata: ProjectMetadata;
  language: 'ur' | 'en';
}

export const AndroidProjectSummary: React.FC<AndroidProjectSummaryProps> = ({
  metadata,
  language
}) => {
  const isUrdu = language === 'ur';

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const isAndroid = metadata.projectType === 'android';

  return (
    <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-5 shadow-lg backdrop-blur-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-700/60">
        <div className="flex items-center space-x-3 rtl:space-x-reverse">
          <div className={`p-2.5 rounded-xl border ${
            isAndroid
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
              : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
          }`}>
            {isAndroid ? <Smartphone className="w-5 h-5" /> : <Globe className="w-5 h-5" />}
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              {metadata.projectName}
              <span className={`inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-md border ${
                isAndroid
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                  : 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
              }`}>
                {isAndroid ? (
                  <>
                    <ShieldCheck className="w-3 h-3 me-1" />
                    {isUrdu ? 'اینڈرائڈ ایپ' : 'Android App'}
                  </>
                ) : (
                  <>
                    <Globe className="w-3 h-3 me-1" />
                    {isUrdu ? 'ویب سائٹ پیج' : 'Website Page'}
                  </>
                )}
              </span>
            </h3>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              {isAndroid ? (
                metadata.packageName ? (
                  <span>Package: <strong className="text-emerald-300 font-semibold">{metadata.packageName}</strong></span>
                ) : (
                  <span className="text-amber-400/80">{isUrdu ? 'پیکیج سورس کوڈ میں تلاش کیا جا رہا ہے' : 'Android Package in source'}</span>
                )
              ) : (
                <span>Framework: <strong className="text-cyan-300 font-semibold">{metadata.frameworkName || 'HTML5/CSS3/JS Web Page'}</strong></span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 rtl:space-x-reverse text-xs">
          {isAndroid ? (
            <>
              {metadata.minSdkVersion && (
                <span className="bg-slate-900/90 text-slate-300 px-2.5 py-1 rounded-lg border border-slate-700 font-medium">
                  minSdk: <strong className="text-cyan-400">{metadata.minSdkVersion}</strong>
                </span>
              )}
              {metadata.targetSdkVersion && (
                <span className="bg-slate-900/90 text-slate-300 px-2.5 py-1 rounded-lg border border-slate-700 font-medium">
                  targetSdk: <strong className="text-cyan-400">{metadata.targetSdkVersion}</strong>
                </span>
              )}
            </>
          ) : (
            <span className={`px-2.5 py-1 rounded-lg border text-xs font-semibold ${
              metadata.hasIndexHtml
                ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
            }`}>
              {metadata.hasIndexHtml
                ? (isUrdu ? '✓ index.html موجود ہے (GitHub Pages Ready)' : '✓ index.html Ready')
                : (isUrdu ? '⚠ index.html فائل شامل کریں' : '⚠ index.html Missing')}
            </span>
          )}
        </div>
      </div>

      {/* Grid Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
        
        {isAndroid ? (
          <>
            <div className="bg-slate-900/60 border border-slate-800 p-3 rounded-xl">
              <div className="flex items-center text-xs text-slate-400 mb-1">
                <Code2 className="w-3.5 h-3.5 me-1.5 text-cyan-400" />
                <span>{isUrdu ? 'کوڈ فائلیں (Kt/Java)' : 'Code Files'}</span>
              </div>
              <p className="text-lg font-bold text-slate-100">{metadata.ktJavaCount || 0}</p>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 p-3 rounded-xl">
              <div className="flex items-center text-xs text-slate-400 mb-1">
                <FileCode className="w-3.5 h-3.5 me-1.5 text-amber-400" />
                <span>{isUrdu ? 'لے آؤٹ XML فائلیں' : 'Layout XMLs'}</span>
              </div>
              <p className="text-lg font-bold text-slate-100">{metadata.xmlCount || 0}</p>
            </div>
          </>
        ) : (
          <>
            <div className="bg-slate-900/60 border border-slate-800 p-3 rounded-xl">
              <div className="flex items-center text-xs text-slate-400 mb-1">
                <FileText className="w-3.5 h-3.5 me-1.5 text-orange-400" />
                <span>{isUrdu ? 'HTML / CSS فائلیں' : 'HTML & CSS Files'}</span>
              </div>
              <p className="text-lg font-bold text-slate-100">{(metadata.htmlCount || 0) + (metadata.cssCount || 0)}</p>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 p-3 rounded-xl">
              <div className="flex items-center text-xs text-slate-400 mb-1">
                <Code2 className="w-3.5 h-3.5 me-1.5 text-amber-400" />
                <span>{isUrdu ? 'JS / TS سکرپٹس' : 'JS & TS Scripts'}</span>
              </div>
              <p className="text-lg font-bold text-slate-100">{metadata.jsCount || 0}</p>
            </div>
          </>
        )}

        <div className="bg-slate-900/60 border border-slate-800 p-3 rounded-xl">
          <div className="flex items-center text-xs text-slate-400 mb-1">
            <Layers className="w-3.5 h-3.5 me-1.5 text-indigo-400" />
            <span>{isUrdu ? 'کل سطریں (Lines)' : 'Total Code Lines'}</span>
          </div>
          <p className="text-lg font-bold text-slate-100">{metadata.totalLines.toLocaleString()}</p>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-3 rounded-xl">
          <div className="flex items-center text-xs text-slate-400 mb-1">
            <FileCheck className="w-3.5 h-3.5 me-1.5 text-emerald-400" />
            <span>{isUrdu ? 'کل فائلیں / سائز' : 'Files & Size'}</span>
          </div>
          <p className="text-sm font-bold text-slate-100 mt-0.5">
            {metadata.totalFiles} files ({formatSize(metadata.totalSize)})
          </p>
        </div>

      </div>
    </div>
  );
};
