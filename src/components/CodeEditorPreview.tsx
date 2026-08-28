import React, { useState, useMemo } from 'react';
import { ExtractedFile } from '../types';
import {
  Copy,
  Check,
  Download,
  X,
  FileCode,
  Code,
  Settings,
  FileText,
  Sparkles,
  WrapText,
  Hash,
  Maximize2,
  Minimize2
} from 'lucide-react';

interface CodeEditorPreviewProps {
  file: ExtractedFile;
  onClose?: () => void;
  language: 'ur' | 'en';
  isModal?: boolean;
}

// Token highlighting helper
function renderHighlightedLine(line: string, ext: string): React.ReactNode[] {
  if (!line) return ['\u00A0']; // empty line non-breaking space

  const fileExt = ext.toLowerCase();

  // XML / HTML highlighting
  if (fileExt === 'xml' || fileExt === 'manifest') {
    return highlightXml(line);
  }

  // Kotlin, Java, Gradle, KTS
  if (['kt', 'java', 'gradle', 'kts', 'groovy', 'properties', 'json', 'yml', 'yaml'].includes(fileExt)) {
    return highlightCode(line, fileExt);
  }

  // Fallback default
  return [line];
}

// Simple regex tokenizer for XML
function highlightXml(line: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  // Regex pattern matching tags, attributes, strings, comments
  const xmlRegex = /(<!--[\s\S]*?-->)|(<\/?[\w:-]+)|([\w:-]+(?==))|("[^"]*"|'[^']*')|([?\/]>|>)/g;
  
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = xmlRegex.exec(line)) !== null) {
    if (match.index > lastIndex) {
      parts.push(line.slice(lastIndex, match.index));
    }

    const [fullMatch, comment, tag, attrName, attrVal, tagClose] = match;

    if (comment) {
      parts.push(
        <span key={match.index} className="text-slate-500 italic">
          {comment}
        </span>
      );
    } else if (tag) {
      parts.push(
        <span key={match.index} className="text-cyan-400 font-semibold">
          {tag}
        </span>
      );
    } else if (attrName) {
      parts.push(
        <span key={match.index} className="text-amber-300">
          {attrName}
        </span>
      );
    } else if (attrVal) {
      parts.push(
        <span key={match.index} className="text-emerald-300">
          {attrVal}
        </span>
      );
    } else if (tagClose) {
      parts.push(
        <span key={match.index} className="text-cyan-400 font-semibold">
          {tagClose}
        </span>
      );
    } else {
      parts.push(fullMatch);
    }

    lastIndex = xmlRegex.lastIndex;
  }

  if (lastIndex < line.length) {
    parts.push(line.slice(lastIndex));
  }

  return parts;
}

// Regex tokenizer for Kotlin / Java / Gradle / JSON
function highlightCode(line: string, ext: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];

  // Keywords set
  const keywords = new Set([
    'fun', 'class', 'interface', 'val', 'var', 'package', 'import', 'private', 'public',
    'protected', 'override', 'return', 'if', 'else', 'when', 'for', 'while', 'try', 'catch',
    'finally', 'throw', 'object', 'companion', 'enum', 'data', 'sealed', 'open', 'abstract',
    'internal', 'lateinit', 'by', 'in', 'is', 'as', 'this', 'super', 'null', 'true', 'false',
    'new', 'extends', 'implements', 'void', 'int', 'boolean', 'double', 'float', 'long', 'char',
    'byte', 'short', 'String', 'plugins', 'android', 'dependencies', 'repositories', 'compileSdk',
    'minSdk', 'targetSdk', 'versionCode', 'versionName', 'buildTypes', 'defaultConfig',
    'implementation', 'testImplementation', 'androidTestImplementation', 'kapt', 'api'
  ]);

  // Unified Regex for comments, strings, annotations, words, numbers, operators
  const codeRegex = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/|#.*$)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|(@[a-zA-Z_]\w*)|([a-zA-Z_]\w*)(?=\s*\()|([a-zA-Z_]\w*)|(\b\d+(?:\.\d+)?[fFL]?\b)/gm;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = codeRegex.exec(line)) !== null) {
    if (match.index > lastIndex) {
      parts.push(line.slice(lastIndex, match.index));
    }

    const [fullMatch, comment, stringLit, annotation, funcCall, word, numberLit] = match;

    if (comment) {
      parts.push(
        <span key={match.index} className="text-slate-500 italic">
          {comment}
        </span>
      );
    } else if (stringLit) {
      parts.push(
        <span key={match.index} className="text-emerald-300">
          {stringLit}
        </span>
      );
    } else if (annotation) {
      parts.push(
        <span key={match.index} className="text-pink-400 font-medium">
          {annotation}
        </span>
      );
    } else if (funcCall) {
      if (keywords.has(funcCall)) {
        parts.push(
          <span key={match.index} className="text-purple-400 font-bold">
            {funcCall}
          </span>
        );
      } else {
        parts.push(
          <span key={match.index} className="text-cyan-300">
            {funcCall}
          </span>
        );
      }
    } else if (word) {
      if (keywords.has(word)) {
        parts.push(
          <span key={match.index} className="text-purple-400 font-bold">
            {word}
          </span>
        );
      } else if (word === word.toUpperCase() && word.length > 2 && /^[A-Z_]+$/.test(word)) {
        // Constants / ENUM
        parts.push(
          <span key={match.index} className="text-amber-400">
            {word}
          </span>
        );
      } else if (/^[A-Z][a-zA-Z0-9_]*$/.test(word)) {
        // Type / Class name
        parts.push(
          <span key={match.index} className="text-yellow-200">
            {word}
          </span>
        );
      } else {
        parts.push(word);
      }
    } else if (numberLit) {
      parts.push(
        <span key={match.index} className="text-amber-300">
          {numberLit}
        </span>
      );
    } else {
      parts.push(fullMatch);
    }

    lastIndex = codeRegex.lastIndex;
  }

  if (lastIndex < line.length) {
    parts.push(line.slice(lastIndex));
  }

  return parts;
}

export const CodeEditorPreview: React.FC<CodeEditorPreviewProps> = ({
  file,
  onClose,
  language,
  isModal = false
}) => {
  const isUrdu = language === 'ur';

  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedPath, setCopiedPath] = useState(false);
  const [copiedCombined, setCopiedCombined] = useState(false);
  const [wordWrap, setWordWrap] = useState(true);
  const [showLineNumbers, setShowLineNumbers] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Split lines for line numbers
  const lines = useMemo(() => {
    if (file.isBinary) return [];
    return file.content.split('\n');
  }, [file]);

  const handleCopyCode = () => {
    if (file.isBinary) return;
    navigator.clipboard.writeText(file.content);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyPath = () => {
    navigator.clipboard.writeText(file.path);
    setCopiedPath(true);
    setTimeout(() => setCopiedPath(false), 2000);
  };

  const handleCopyCombined = () => {
    if (file.isBinary) return;
    const text = `FilePath: ${file.path}\n\n==================== CONTENT ====================\n${file.content}`;
    navigator.clipboard.writeText(text);
    setCopiedCombined(true);
    setTimeout(() => setCopiedCombined(false), 2000);
  };

  const handleDownloadFile = () => {
    const element = document.createElement('a');
    let blob: Blob;
    if (file.isBinary && file.binaryData) {
      blob = new Blob([file.binaryData]);
    } else {
      blob = new Blob([file.content], { type: 'text/plain;charset=utf-8' });
    }
    element.href = URL.createObjectURL(blob);
    element.download = file.name;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const getLanguageLabel = (ext: string) => {
    switch (ext.toLowerCase()) {
      case 'kt':
        return 'KOTLIN';
      case 'java':
        return 'JAVA';
      case 'xml':
        return 'XML LAYOUT';
      case 'gradle':
      case 'kts':
        return 'GRADLE';
      case 'json':
        return 'JSON';
      case 'yml':
      case 'yaml':
        return 'YAML';
      case 'properties':
        return 'PROPERTIES';
      case 'md':
        return 'MARKDOWN';
      default:
        return ext ? ext.toUpperCase() : 'TEXT';
    }
  };

  const getFileIcon = (ext: string) => {
    if (['kt', 'java'].includes(ext)) return <Code className="w-4 h-4 text-cyan-400" />;
    if (ext === 'xml') return <FileCode className="w-4 h-4 text-amber-400" />;
    if (['gradle', 'kts'].includes(ext)) return <Settings className="w-4 h-4 text-emerald-400" />;
    return <FileText className="w-4 h-4 text-indigo-400" />;
  };

  const modalContainerClasses = isFullscreen
    ? 'fixed inset-0 z-50 bg-slate-950 flex flex-col'
    : isModal
    ? 'fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6'
    : 'w-full flex flex-col bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl';

  const windowClasses = isModal && !isFullscreen
    ? 'bg-slate-950 border border-slate-700/90 rounded-2xl w-full max-w-5xl max-h-[88vh] flex flex-col shadow-2xl overflow-hidden'
    : 'w-full flex flex-col flex-1 overflow-hidden';

  return (
    <div className={modalContainerClasses}>
      <div className={windowClasses}>
        
        {/* Editor Window Title Bar */}
        <div className="bg-slate-900 border-b border-slate-800 px-4 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0">
          
          {/* File Info & Language Tag */}
          <div className="flex items-center space-x-3 rtl:space-x-reverse min-w-0">
            {getFileIcon(file.ext)}
            <div className="flex flex-col min-w-0">
              <div className="flex items-center space-x-2 rtl:space-x-reverse">
                <span className="text-xs font-mono font-bold text-slate-100 truncate" title={file.path}>
                  {file.path}
                </span>
                <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-cyan-950 text-cyan-400 border border-cyan-800/60 uppercase shrink-0">
                  {getLanguageLabel(file.ext)}
                </span>
              </div>
              <div className="flex items-center space-x-2 rtl:space-x-reverse text-[11px] text-slate-500 mt-0.5">
                <span>{(file.size / 1024).toFixed(1)} KB</span>
                {!file.isBinary && (
                  <>
                    <span>•</span>
                    <span>{lines.length} lines</span>
                    <span>•</span>
                    <span>{file.content.length} chars</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center space-x-2 rtl:space-x-reverse shrink-0">
            
            {/* Word Wrap Toggle */}
            <button
              onClick={() => setWordWrap(!wordWrap)}
              className={`p-1.5 rounded-lg border text-xs font-medium transition-colors ${
                wordWrap
                  ? 'bg-emerald-950/80 border-emerald-700/60 text-emerald-400'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
              }`}
              title={isUrdu ? 'ورڈ ریپ (Word Wrap)' : 'Toggle Word Wrap'}
            >
              <WrapText className="w-3.5 h-3.5" />
            </button>

            {/* Line Numbers Toggle */}
            <button
              onClick={() => setShowLineNumbers(!showLineNumbers)}
              className={`p-1.5 rounded-lg border text-xs font-medium transition-colors ${
                showLineNumbers
                  ? 'bg-emerald-950/80 border-emerald-700/60 text-emerald-400'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
              }`}
              title={isUrdu ? 'لائن نمبرز (Line Numbers)' : 'Toggle Line Numbers'}
            >
              <Hash className="w-3.5 h-3.5" />
            </button>

            {/* Copy Path */}
            <button
              onClick={handleCopyPath}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-medium border border-slate-700 transition-colors flex items-center space-x-1 rtl:space-x-reverse"
              title={isUrdu ? 'پاتھ کاپی کریں' : 'Copy File Path'}
            >
              {copiedPath ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
              <span className="hidden sm:inline text-[11px]">{isUrdu ? 'پاتھ' : 'Path'}</span>
            </button>

            {/* Copy Code */}
            <button
              disabled={file.isBinary}
              onClick={handleCopyCode}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors flex items-center space-x-1 rtl:space-x-reverse ${
                file.isBinary
                  ? 'bg-slate-900 text-slate-600 border-slate-800 cursor-not-allowed'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border-slate-700'
              }`}
            >
              {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-cyan-400" />}
              <span className="text-[11px]">{isUrdu ? 'کوڈ کاپی' : 'Copy Code'}</span>
            </button>

            {/* Copy Path + Code Combined */}
            <button
              disabled={file.isBinary}
              onClick={handleCopyCombined}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all flex items-center space-x-1 rtl:space-x-reverse ${
                file.isBinary
                  ? 'bg-slate-900 text-slate-600 border-slate-800 cursor-not-allowed'
                  : 'bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border-emerald-700/60 shadow-sm'
              }`}
            >
              {copiedCombined ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Sparkles className="w-3.5 h-3.5 text-emerald-400" />}
              <span className="text-[11px]">{isUrdu ? 'پاتھ + کوڈ' : 'Path & Code'}</span>
            </button>

            {/* Download */}
            <button
              onClick={handleDownloadFile}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg border border-slate-700 transition-colors"
              title={isUrdu ? 'ڈاؤنلوڈ فائل' : 'Download File'}
            >
              <Download className="w-3.5 h-3.5" />
            </button>

            {/* Fullscreen Toggle */}
            {isModal && (
              <button
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg border border-slate-700 transition-colors"
                title={isFullscreen ? 'ریسٹور' : 'فل سکرین'}
              >
                {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              </button>
            )}

            {/* Close Modal Button */}
            {onClose && (
              <button
                onClick={onClose}
                className="p-1.5 bg-slate-800 hover:bg-red-950 hover:text-red-400 text-slate-400 rounded-lg border border-slate-700 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}

          </div>

        </div>

        {/* Code View Area */}
        <div className="flex-1 overflow-y-auto bg-slate-950 font-mono text-xs text-slate-200 select-text relative">
          {file.isBinary ? (
            <div className="p-12 text-center text-slate-500 space-y-3">
              <FileText className="w-12 h-12 mx-auto text-slate-600" />
              <p className="text-sm font-medium">
                {isUrdu ? 'بائنری فائل پریویو سپورٹڈ نہیں ہے' : 'Binary File Preview Not Supported'}
              </p>
              <p className="text-xs text-slate-600">
                {isUrdu ? 'یہ فائل GitHub اپلوڈ یا ZIP ایکسپورٹ میں بالکل ٹھیک شامل ہوگی۔' : 'This binary file will be uploaded directly as raw data.'}
              </p>
            </div>
          ) : (
            <div className="flex min-w-full">
              
              {/* Line Numbers Column */}
              {showLineNumbers && (
                <div className="py-4 px-3 bg-slate-900/60 border-r border-slate-800/80 text-right text-slate-600 font-mono select-none sticky left-0 z-10 shrink-0">
                  {lines.map((_, index) => (
                    <div key={index} className="leading-6 h-6 text-[11px]">
                      {index + 1}
                    </div>
                  ))}
                </div>
              )}

              {/* Syntax Highlighted Code Lines */}
              <div
                className={`py-4 px-4 flex-1 font-mono text-[12.5px] leading-6 ${
                  wordWrap ? 'whitespace-pre-wrap break-words' : 'whitespace-pre overflow-x-auto'
                }`}
              >
                {lines.map((line, idx) => (
                  <div key={idx} className="h-6 hover:bg-slate-900/50 rounded px-1 transition-colors">
                    {renderHighlightedLine(line, file.ext)}
                  </div>
                ))}
              </div>

            </div>
          )}
        </div>

        {/* Footer info status bar */}
        <div className="px-4 py-2 bg-slate-900/90 border-t border-slate-800 text-[11px] text-slate-500 flex items-center justify-between">
          <span className="truncate">
            {isUrdu ? 'کلک کر کے کوڈ یا پاتھ کاپی کریں' : 'Click top bar buttons to copy code or path'}
          </span>
          <span className="shrink-0 text-slate-400 font-medium">
            UTF-8 • {file.ext ? `.${file.ext}` : 'raw'}
          </span>
        </div>

      </div>
    </div>
  );
};
