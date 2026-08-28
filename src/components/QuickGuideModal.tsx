import React from 'react';
import { X, Key, Copy, UploadCloud, Github, CheckCircle, ExternalLink, Sparkles } from 'lucide-react';

interface QuickGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: 'ur' | 'en';
}

export const QuickGuideModal: React.FC<QuickGuideModalProps> = ({
  isOpen,
  onClose,
  language
}) => {
  if (!isOpen) return null;

  const isUrdu = language === 'ur';

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="p-4 bg-slate-800 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center space-x-2 rtl:space-x-reverse">
            <Sparkles className="w-5 h-5 text-emerald-400" />
            <h2 className="text-base font-bold text-slate-100">
              {isUrdu ? 'استعمال کا مکمل طریقہ (User Guide)' : 'GitHub Upload Guide'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-700/60"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto text-xs text-slate-300 leading-relaxed">
          
          {/* Method 1: Automatic Direct Upload */}
          <div className="space-y-3 bg-slate-950 p-4 rounded-xl border border-slate-800">
            <h3 className="text-sm font-bold text-emerald-400 flex items-center gap-2">
              <UploadCloud className="w-4 h-4" />
              {isUrdu ? 'طریقہ #1: ڈائریکٹ 1-کلک خودکار اپلوڈ (سفارش کردہ)' : 'Method #1: Direct 1-Click Upload (Recommended)'}
            </h3>

            <ol className="list-decimal list-inside space-y-2 text-slate-300">
              <li>
                <strong>{isUrdu ? 'پروجیکٹ یا ویب پیج فائلیں اپلوڈ کریں:' : 'Upload Project or Web Files:'}</strong> {isUrdu ? 'اپنی اینڈرائڈ ZIP پروجیکٹ یا ویب پیج (HTML, CSS, JS) فائلیں ڈریگ ڈراپ کریں۔' : 'Drag & drop your Android ZIP or Website Page (HTML, CSS, JS) files.'}
              </li>
              <li>
                <strong>{isUrdu ? 'GitHub Personal Access Token (PAT) درج کریں:' : 'Enter GitHub Token:'}</strong> {isUrdu ? 'اپنے GitHub اکاؤنٹ سے Token حاصل کریں اور درج کریں۔' : 'Generate token from GitHub settings with repo scope.'}
              </li>
              <li>
                <strong>{isUrdu ? 'اپلوڈ کا بٹن دبائیں:' : 'Click Push to GitHub:'}</strong> {isUrdu ? 'یہ ٹول خودکار طور پر تمام فائلیں، فولڈر سٹرکچر اور آٹو-ورک فلو GitHub پر اپلوڈ کر دے گا۔' : 'The tool will create all folders, paths, and commit all files automatically!'}
              </li>
            </ol>
          </div>

          {/* Method 2: Manual Path & Code Copy */}
          <div className="space-y-3 bg-slate-950 p-4 rounded-xl border border-slate-800">
            <h3 className="text-sm font-bold text-cyan-400 flex items-center gap-2">
              <Copy className="w-4 h-4" />
              {isUrdu ? 'طریقہ #2: صرف پاتھ اور کوڈ کاپی کر کے پیسٹ کرنا' : 'Method #2: Copy Path & Content for Manual Paste'}
            </h3>

            <p>
              {isUrdu
                ? 'اگر آپ GitHub ویب ایڈیٹر (Add File -> Create new file) استعمال کرنا چاہتے ہیں:'
                : 'If you prefer using GitHub Web Editor manually:'}
            </p>

            <ul className="space-y-2 list-disc list-inside text-slate-300">
              <li>
                {isUrdu
                  ? 'فائل کی لسٹ میں "پاتھ" (Path) کے بٹن پر کلک کریں تاکہ فولڈر سٹرکچر کے ساتھ نام کاپی ہو۔'
                  : 'Click "Path" button on any file to copy its exact relative path.'}
              </li>
              <li>
                {isUrdu
                  ? '"کوڈ" (Content) بٹن پر کلک کریں تاکہ مکمل سورس کوڈ کاپی ہو جائے۔'
                  : 'Click "Content" button to copy its complete source code.'}
              </li>
              <li>
                {isUrdu
                  ? 'یا "پاتھ + مواد" (Path & Code) پر کلک کریں جو دونوں معلومات کو ایک ساتھ ترتیب دے کر کاپی کرتا ہے۔'
                  : 'Or click "Path & Code" to copy both path and content formatted together!'}
              </li>
            </ul>
          </div>

          {/* APK Build Troubleshooting & Explanation */}
          <div className="space-y-3 bg-slate-950 p-4 rounded-xl border border-emerald-500/30">
            <h3 className="text-sm font-bold text-emerald-400 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              {isUrdu ? 'سوال: کوڈ اپلوڈ کرنے پر APK کیوں نہیں بنتی؟ (APK Build Solution)' : 'Why does uploaded code not build APK automatically?'}
            </h3>

            <div className="space-y-2 text-slate-300">
              <p className="text-slate-200 font-medium">
                {isUrdu
                  ? 'GitHub صرف سورس کوڈ (Java, Kotlin, Gradle) کو محفوظ کرتا ہے۔ یہ خود بخود APK کمپائل نہیں کرتا جب تک کہ CI/CD ورک فلو شامل نہ ہو۔'
                  : 'GitHub is a source code host, not a build machine by default. It requires a GitHub Actions workflow to run Gradle and compile APK.'}
              </p>

              <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 space-y-2 text-[11px]">
                <p className="font-bold text-cyan-300">
                  {isUrdu ? 'حل (Solution):' : 'The Solution:'}
                </p>
                <ol className="list-decimal list-inside space-y-1.5 text-slate-300">
                  <li>
                    {isUrdu
                      ? 'اپلوڈ کرتے وقت **"خودکار APK بلڈ شامل کریں"** چیک باکس آن رکھیں۔'
                      : 'Keep "Include Auto APK Build Workflow" checked when uploading.'}
                  </li>
                  <li>
                    {isUrdu
                      ? 'یہ ٹول ایک ورک فلو فائل `.github/workflows/android.yml` آپ کے GitHub پروجیکٹ میں شامل کر دے گا۔'
                      : 'This adds `.github/workflows/android.yml` to your GitHub repo.'}
                  </li>
                  <li>
                    {isUrdu
                      ? 'کمیٹ ہوتے ہی GitHub کا کلاؤڈ سرور خود بخود Gradle کے ذریعے APK بلڈ کرنا شروع کر دے گا۔'
                      : 'GitHub Actions will automatically trigger Gradle build on cloud servers.'}
                  </li>
                  <li>
                    {isUrdu
                      ? 'اپنے GitHub پروجیکٹ کے **"Actions"** ٹیب پر جائیں اور بننے والی **`app-debug-apk`** فائل ڈاؤنلوڈ کریں۔'
                      : 'Go to the **"Actions"** tab on your GitHub repo to download the compiled `.apk` file!'}
                  </li>
                </ol>
              </div>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-800 border-t border-slate-700 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold"
          >
            {isUrdu ? 'فہمیدم (سمجھ آ گئی)' : 'Got it!'}
          </button>
        </div>

      </div>
    </div>
  );
};
