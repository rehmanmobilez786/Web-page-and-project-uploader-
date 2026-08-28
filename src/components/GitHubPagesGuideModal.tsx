import React, { useState } from 'react';
import { X, Globe, Cpu, ExternalLink, CheckCircle2, Copy, Check, Sparkles, ShieldCheck, HelpCircle, Layers, AlertCircle } from 'lucide-react';

interface GitHubPagesGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: 'ur' | 'en';
}

export const GitHubPagesGuideModal: React.FC<GitHubPagesGuideModalProps> = ({
  isOpen,
  onClose,
  language
}) => {
  if (!isOpen) return null;
  const isUrdu = language === 'ur';

  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedWorkflow, setCopiedWorkflow] = useState(false);

  const workflowCode = `name: Deploy Website to GitHub Pages

on:
  push:
    branches: ["main", "master"]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: false

jobs:
  deploy:
    environment:
      name: github-pages
      url: \${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Setup Pages
        uses: actions/configure-pages@v5

      - name: Upload Artifacts
        uses: actions/upload-pages-artifact@v3
        with:
          path: '.'

      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4`;

  const handleCopyWorkflow = () => {
    navigator.clipboard.writeText(workflowCode);
    setCopiedWorkflow(true);
    setTimeout(() => setCopiedWorkflow(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Modal Header */}
        <div className="bg-slate-950 border-b border-slate-800 px-5 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3 rtl:space-x-reverse">
            <div className="p-2.5 rounded-xl bg-gradient-to-tr from-cyan-500/20 to-blue-500/20 text-cyan-400 border border-cyan-500/30">
              <Globe className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <span>{isUrdu ? 'GitHub Pages پر ویب سائٹ لائیو پبلش کرنے کی مکمل رہنمائی' : 'Deploying Website Live on GitHub Pages'}</span>
                <span className="px-2 py-0.5 text-[10px] font-bold bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 rounded-md">
                  100% Free Hosting
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                {isUrdu
                  ? 'اپنی ویب سائٹ کو GitHub Pages کے ذریعے مفت لائیو لنک (URL) پر کیسے پبلش کریں۔'
                  : 'Step-by-step guide to hosting your website code live on GitHub Pages with custom domain support.'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6 text-sm text-slate-300">
          
          {/* Troubleshooting White Page / Blank Screen Issue */}
          <div className="p-4 bg-amber-950/40 border border-amber-500/40 rounded-2xl space-y-3">
            <div className="flex items-center space-x-2 rtl:space-x-reverse text-amber-400 font-bold text-sm">
              <AlertCircle className="w-5 h-5 shrink-0 text-amber-400" />
              <h4>{isUrdu ? '⚠️ اگر وائٹ / بلینک پیج (Blank White Screen) آ رہا ہو تو کیا کریں؟' : '⚠️ Fixing White / Blank Page Issue on GitHub Pages'}</h4>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              {isUrdu
                ? 'اگر آپ نے React / Vite پروجیکٹ (جس میں src/main.tsx، package.json یا vite.config.ts ہو) اپلوڈ کیا ہے اور GitHub Pages پر وائٹ پیج آ رہا ہے، تو اس کی وجہ یہ ہے کہ GitHub Pages خام سورس کوڈ (Uncompiled TSX/JSX) کو ڈائریکٹ نہیں چلا سکتا۔'
                : 'If you uploaded a React/Vite project (with src/, vite.config.ts, TSX files) and see a blank white page on GitHub Pages, it is because browsers cannot execute raw React/TypeScript source code without building first.'}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs pt-1">
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                <h5 className="font-bold text-cyan-300 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-cyan-400" />
                  <span>{isUrdu ? 'حل 1: Vercel یا Netlify پر لائیو کریں (10 سیکنڈز)' : 'Option A: Deploy on Vercel or Netlify (Fastest)'}</span>
                </h5>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  {isUrdu
                    ? '1. Vercel.com پر جا کر اپنے GitHub سے لاگ ان کریں۔\n2. اس ریپوزٹری کو سلیکٹ کر کے "Deploy" دبائیں۔\n3. Vercel خودکار طور پر React/Vite کوڈ بلڈ کر کے 10 سیکنڈز میں لائیو لنک دے دے گا۔'
                    : '1. Log in to Vercel.com with your GitHub account.\n2. Select your repository and click "Deploy".\n3. Vercel builds React/Vite code automatically in 10 seconds!'}
                </p>
              </div>

              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                <h5 className="font-bold text-emerald-300 flex items-center gap-1.5">
                  <Globe className="w-4 h-4 text-emerald-400" />
                  <span>{isUrdu ? 'حل 2: سادہ HTML/CSS/JS فائلیں' : 'Option B: Static HTML/CSS/JS Files'}</span>
                </h5>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  {isUrdu
                    ? 'اگر آپ کا پروجیکٹ سادہ HTML/CSS/JS پر مشتمل ہے، تو GitHub Settings -> Pages میں جا کر Source کو "Deploy from a branch" رکھیں اور Main Branch (Root /) منتخب کریں۔'
                    : 'If your project is pure HTML, CSS, and JS (index.html at root), set GitHub Pages settings to "Deploy from a branch" and select main branch / root folder.'}
                </p>
              </div>
            </div>
          </div>

          {/* Method 1: Automatic Workflow (Built-in) */}
          <div className="p-4 bg-emerald-950/30 border border-emerald-500/30 rounded-2xl space-y-3">
            <div className="flex items-center space-x-2 rtl:space-x-reverse text-emerald-400 font-bold text-sm">
              <Sparkles className="w-5 h-5 shrink-0" />
              <h4>{isUrdu ? 'طریقہ 1: اس اپلوڈر کا خودکار طریقہ (Auto GitHub Pages)' : 'Method 1: Automatic 1-Click Workflow (Recommended)'}</h4>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              {isUrdu
                ? 'جب آپ اس اپلوڈر کے ذریعے "Push to GitHub" کرتے ہیں اور "Include GitHub Pages Auto Deploy Workflow" والا باکس ٹک رکھتے ہیں، تو یہ خودکار طور پر .github/workflows/static.yml فائل شامل کر دیتا ہے۔'
                : 'When pushing code via this app, ensure "Include GitHub Pages Auto Deploy Workflow" is checked. It automatically injects the official GitHub Pages deployment workflow.'}
            </p>
            
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-2">
              <h5 className="text-xs font-bold text-slate-200">
                {isUrdu ? 'ریپوزٹری سیٹنگز میں صرف ایک بار ایکٹیو کریں:' : 'Enable in Repository Settings (One-Time Step):'}
              </h5>
              <ol className="list-decimal list-inside text-xs text-slate-300 space-y-1.5 leading-relaxed">
                <li>{isUrdu ? 'اپنی GitHub ریپوزٹری کے **Settings** ٹیب میں جائیں۔' : 'Go to your repository **Settings** tab on GitHub.'}</li>
                <li>{isUrdu ? 'بائیں مینو میں **Pages** پر کلک کریں۔' : 'Click **Pages** under the Code and automation section.'}</li>
                <li>{isUrdu ? 'Under **Source**, select **GitHub Actions** (یا Select `main` branch).' : 'Under **Source**, choose **GitHub Actions** (or Deploy from branch -> `main`).'}</li>
                <li>{isUrdu ? 'سیو کریں! کچھ سیکنڈز میں آپ کی ویب سائٹ کا لائیو لنک (e.g. `https://username.github.io/repo/`) تیار ہو جائے گا۔' : 'Save! In a few seconds your site goes live at `https://<username>.github.io/<repo-name>/`!'}</li>
              </ol>
            </div>
          </div>

          {/* Live Link URL Structure */}
          <div className="p-4 bg-slate-800/60 border border-slate-700/80 rounded-2xl space-y-3">
            <h4 className="font-bold text-slate-100 text-sm flex items-center gap-2">
              <Globe className="w-4 h-4 text-cyan-400" />
              <span>{isUrdu ? 'آپ کی لائیو ویب سائٹ کا URL سٹرکچر:' : 'Your Live Website URL Pattern:'}</span>
            </h4>
            
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 font-mono text-xs text-cyan-300 flex items-center justify-between">
              <span>https://<strong className="text-emerald-400">&lt;your-github-username&gt;</strong>.github.io/<strong className="text-amber-300">&lt;repository-name&gt;</strong>/</span>
              <span className="px-2 py-1 bg-cyan-950 text-cyan-400 rounded text-[10px]">GitHub Pages</span>
            </div>
            
            <p className="text-xs text-slate-400">
              {isUrdu
                ? 'مثال کے طور پر اگر آپ کی یوزر نیم `ali-developer` اور پروجیکٹ `my-website` ہے، تو URL ہوگا: `https://ali-developer.github.io/my-website/`'
                : 'Example: If username is `dev-john` and repo is `my-portfolio`, URL is `https://dev-john.github.io/my-portfolio/`'}
            </p>
          </div>

          {/* Workflow Code Box */}
          <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-slate-200 text-xs flex items-center gap-2">
                <Cpu className="w-4 h-4 text-amber-400" />
                <span>.github/workflows/static.yml</span>
              </h4>
              <button
                onClick={handleCopyWorkflow}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium border border-slate-700 flex items-center gap-1 transition-colors"
              >
                {copiedWorkflow ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                <span>{isUrdu ? 'ورک فلو کوڈ کاپی کریں' : 'Copy Workflow Code'}</span>
              </button>
            </div>
            <pre className="p-3 bg-slate-900 rounded-xl text-[11px] font-mono text-slate-300 overflow-x-auto max-h-48 border border-slate-800">
              {workflowCode}
            </pre>
          </div>

          {/* Other Free Hosting Platforms */}
          <div className="p-4 bg-slate-800/40 border border-slate-700/60 rounded-2xl space-y-3">
            <h4 className="font-bold text-slate-100 text-sm flex items-center gap-2">
              <Layers className="w-4 h-4 text-purple-400" />
              <span>{isUrdu ? 'دیگر پلیٹ فارمز پر ویب سائٹ لائیو کرنا (Vercel / Netlify / Cloudflare):' : 'Other Platforms (Vercel, Netlify, Cloudflare Pages):'}</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
                <h5 className="font-bold text-cyan-300">Vercel</h5>
                <p className="text-slate-400 text-[11px]">GitHub ریپوزٹری کنیکٹ کریں اور 1-کلک میں لائیو کریں۔</p>
              </div>
              <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
                <h5 className="font-bold text-emerald-300">Netlify</h5>
                <p className="text-slate-400 text-[11px]">Import from GitHub کر کے مفت `name.netlify.app` حاصل کریں۔</p>
              </div>
              <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
                <h5 className="font-bold text-amber-300">Cloudflare Pages</h5>
                <p className="text-slate-400 text-[11px]">فاسٹ عالمی CDN پر اپنی HTML/CSS/JS ویب سائٹ چلائیں۔</p>
              </div>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="bg-slate-950 border-t border-slate-800 px-5 py-3 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{isUrdu ? 'تمام سورس کوڈ 100% اوپن سورس اور پورٹیبل ہے۔' : 'Your code is standard open-source and ready for any host.'}</span>
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl transition-colors shadow-lg shadow-emerald-600/20"
          >
            {isUrdu ? 'سمجھ آ گیا (Got it!)' : 'Got it'}
          </button>
        </div>

      </div>
    </div>
  );
};
