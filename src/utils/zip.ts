import JSZip from 'jszip';
import { ExtractedFile, AndroidMetadata, ProjectMetadata } from '../types';

const TEXT_EXTENSIONS = new Set([
  'java', 'kt', 'kts', 'xml', 'gradle', 'json', 'properties', 'txt', 'md',
  'gitignore', 'pro', 'bat', 'sh', 'c', 'cpp', 'h', 'hpp', 'rs', 'py',
  'yaml', 'yml', 'html', 'css', 'js', 'ts', 'svg', 'cfg', 'conf', 'ini', 'toml'
]);

const BINARY_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'webp', 'gif', 'ico', 'jar', 'aar', 'apk', 'so',
  'zip', 'pdf', 'ttf', 'otf', 'keystore', 'jks', 'bin', 'class', 'db'
]);

// Helper to determine if file is text or binary
function isBinaryFile(path: string): boolean {
  const ext = path.split('.').pop()?.toLowerCase() || '';
  if (TEXT_EXTENSIONS.has(ext)) return false;
  if (BINARY_EXTENSIONS.has(ext)) return true;
  return false;
}

// Convert ArrayBuffer to Base64 for binary files
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

export async function parseZipFile(file: File): Promise<{
  files: ExtractedFile[];
  metadata: AndroidMetadata;
}> {
  const zip = new JSZip();
  const loadedZip = await zip.loadAsync(file);

  const filePaths = Object.keys(loadedZip.files).filter(
    (path) => !loadedZip.files[path].dir
  );

  // Check if all files share a single common top directory (e.g. MyProject-master/app/...)
  let rootPrefix = '';
  if (filePaths.length > 0) {
    const firstParts = filePaths[0].split('/');
    if (firstParts.length > 1) {
      const candidate = firstParts[0] + '/';
      if (filePaths.every((p) => p.startsWith(candidate))) {
        rootPrefix = candidate;
      }
    }
  }

  const extractedFiles: ExtractedFile[] = [];

  for (const originalPath of filePaths) {
    const zipObj = loadedZip.files[originalPath];
    if (zipObj.dir) continue;

    // Clean path by stripping common top-level wrapper if exists
    let cleanPath = originalPath;
    if (rootPrefix && cleanPath.startsWith(rootPrefix)) {
      cleanPath = cleanPath.substring(rootPrefix.length);
    }

    // Ignore unwanted cache/build outputs if any
    if (
      cleanPath.startsWith('.git/') ||
      cleanPath.includes('/build/') ||
      cleanPath.startsWith('.gradle/') ||
      cleanPath.startsWith('.idea/') ||
      cleanPath.endsWith('.apk')
    ) {
      // We can still include them or mark them, but by default we strip useless build artifacts
    }

    const name = cleanPath.split('/').pop() || cleanPath;
    const ext = name.includes('.') ? name.split('.').pop()?.toLowerCase() || '' : '';
    const binary = isBinaryFile(cleanPath);

    let content = '';
    let lineCount = 0;
    let binaryData: Uint8Array | undefined;

    const arrayBuffer = await zipObj.async('arraybuffer');
    const size = arrayBuffer.byteLength;

    if (binary) {
      content = arrayBufferToBase64(arrayBuffer);
      binaryData = new Uint8Array(arrayBuffer);
    } else {
      const decoder = new TextDecoder('utf-8', { fatal: false });
      content = decoder.decode(arrayBuffer);
      lineCount = content.split(/\r\n|\r|\n/).length;
    }

    extractedFiles.push({
      id: Math.random().toString(36).substring(2, 9),
      path: cleanPath,
      originalPath,
      name,
      ext,
      isBinary: binary,
      content,
      binaryData,
      size,
      lineCount,
      isSelected: true
    });
  }

  // Determine if this is an Android or Website project
  const isAndroid = extractedFiles.some(
    (f) =>
      f.name === 'AndroidManifest.xml' ||
      f.ext === 'kt' ||
      f.ext === 'gradle' ||
      f.ext === 'kts' ||
      f.path.includes('app/src/main/')
  );

  if (isAndroid) {
    const hasWorkflow = extractedFiles.some(
      (f) => f.path.includes('.github/workflows/') && f.path.endsWith('.yml')
    );
    if (!hasWorkflow) {
      extractedFiles.push(getAndroidWorkflowFile());
    }
  }

  const projectName = file.name.replace(/\.zip$/i, '');
  const metadata = analyzeProject(extractedFiles, projectName);

  return { files: extractedFiles, metadata };
}

export async function parseWebFiles(rawFiles: FileList | File[]): Promise<{
  files: ExtractedFile[];
  metadata: ProjectMetadata;
}> {
  const fileArray = Array.from(rawFiles);
  const extractedFiles: ExtractedFile[] = [];

  for (const f of fileArray) {
    const cleanPath = f.webkitRelativePath || f.name;
    const name = cleanPath.split('/').pop() || cleanPath;
    const ext = name.includes('.') ? name.split('.').pop()?.toLowerCase() || '' : '';
    const binary = isBinaryFile(cleanPath);

    let content = '';
    let lineCount = 0;
    const arrayBuffer = await f.arrayBuffer();
    const size = arrayBuffer.byteLength;

    if (binary) {
      content = arrayBufferToBase64(arrayBuffer);
    } else {
      const decoder = new TextDecoder('utf-8', { fatal: false });
      content = decoder.decode(arrayBuffer);
      lineCount = content.split(/\r\n|\r|\n/).length;
    }

    extractedFiles.push({
      id: Math.random().toString(36).substring(2, 9),
      path: cleanPath,
      originalPath: cleanPath,
      name,
      ext,
      isBinary: binary,
      content,
      size,
      lineCount,
      isSelected: true
    });
  }

  const firstFileName = fileArray[0]?.name.split('.')[0] || 'MyWebsite';
  const metadata = analyzeProject(extractedFiles, firstFileName);

  return { files: extractedFiles, metadata };
}

export function analyzeProject(files: ExtractedFile[], fallbackName: string): ProjectMetadata {
  let packageName: string | undefined;
  let minSdkVersion: string | undefined;
  let targetSdkVersion: string | undefined;
  let kotlinVersion: string | undefined;
  let gradleVersion: string | undefined;
  let hasManifest = false;
  let hasGradle = false;

  let ktJavaCount = 0;
  let xmlCount = 0;
  let gradleCount = 0;

  let htmlCount = 0;
  let cssCount = 0;
  let jsCount = 0;
  let webAssetCount = 0;
  let hasIndexHtml = false;
  let frameworkName = 'Static Web Page';

  let totalLines = 0;
  let totalSize = 0;

  let isAndroid = false;

  for (const file of files) {
    totalSize += file.size;
    if (file.lineCount) totalLines += file.lineCount;

    // Check Android
    if (file.ext === 'kt' || file.ext === 'java') {
      ktJavaCount++;
      isAndroid = true;
    }
    if (file.ext === 'gradle' || file.ext === 'kts') {
      gradleCount++;
      isAndroid = true;
    }
    if (file.name === 'AndroidManifest.xml') {
      hasManifest = true;
      isAndroid = true;
      const packageMatch = file.content.match(/package\s*=\s*["']([^"']+)["']/);
      if (packageMatch) packageName = packageMatch[1];
    }
    if (file.ext === 'xml') xmlCount++;

    if (file.name.includes('build.gradle') || file.name.includes('build.gradle.kts')) {
      hasGradle = true;
      isAndroid = true;
      if (!packageName) {
        const appIdMatch = file.content.match(/applicationId\s*=?\s*["']([^"']+)["']/);
        const nsMatch = file.content.match(/namespace\s*=?\s*["']([^"']+)["']/);
        if (nsMatch) packageName = nsMatch[1];
        else if (appIdMatch) packageName = appIdMatch[1];
      }

      const minSdkMatch = file.content.match(/minSdk\w*\s*=?\s*([0-9]+)/);
      if (minSdkMatch) minSdkVersion = minSdkMatch[1];

      const targetSdkMatch = file.content.match(/targetSdk\w*\s*=?\s*([0-9]+)/);
      if (targetSdkMatch) targetSdkVersion = targetSdkMatch[1];
    }

    // Check Website
    if (file.ext === 'html' || file.ext === 'htm') {
      htmlCount++;
      if (file.name.toLowerCase() === 'index.html') hasIndexHtml = true;
    }
    if (file.ext === 'css' || file.ext === 'scss' || file.ext === 'less') cssCount++;
    if (file.ext === 'js' || file.ext === 'ts' || file.ext === 'jsx' || file.ext === 'tsx') jsCount++;
    if (['png', 'jpg', 'jpeg', 'webp', 'svg', 'gif', 'ico'].includes(file.ext)) webAssetCount++;

    if (file.name === 'package.json') {
      if (file.content.includes('"react"')) frameworkName = 'React Web App';
      else if (file.content.includes('"vue"')) frameworkName = 'Vue Web App';
      else if (file.content.includes('"next"')) frameworkName = 'Next.js App';
      else if (file.content.includes('"vite"')) frameworkName = 'Vite Web App';
      else frameworkName = 'Node.js Web App';
    } else if (file.name.endsWith('.php')) {
      frameworkName = 'PHP Web Application';
    }
  }

  const projectType: 'android' | 'website' = isAndroid ? 'android' : 'website';

  return {
    projectType,
    projectName: fallbackName,
    packageName,
    minSdkVersion,
    targetSdkVersion,
    kotlinVersion,
    gradleVersion,
    hasManifest,
    hasGradle,
    ktJavaCount,
    xmlCount,
    gradleCount,
    htmlCount,
    cssCount,
    jsCount,
    webAssetCount,
    hasIndexHtml,
    frameworkName: isAndroid ? 'Android SDK (Gradle/Kotlin)' : frameworkName,
    totalFiles: files.length,
    totalLines,
    totalSize
  };
}

export function getAndroidWorkflowFile(): ExtractedFile {
  const content = `name: Build Android APK

on:
  push:
    branches: ["main", "master"]
  workflow_dispatch:

permissions:
  contents: read

concurrency:
  group: \${{ github.workflow }}-\${{ github.ref }}
  cancel-in-progress: true

jobs:
  build:
    name: Build Android Debug APK
    runs-on: ubuntu-latest
    timeout-minutes: 15

    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Set up JDK 17
        uses: actions/setup-java@v4
        with:
          java-version: '17'
          distribution: 'temurin'

      - name: Setup Gradle
        uses: gradle/actions/setup-gradle@v3

      - name: Make gradlew executable
        run: |
          if [ -f "./gradlew" ]; then
            chmod +x ./gradlew
          fi

      - name: Build APK with Gradle
        run: |
          if [ -f "./gradlew" ]; then
            ./gradlew assembleDebug --no-daemon || ./gradlew build --no-daemon
          else
            gradle assembleDebug --no-daemon || gradle build --no-daemon
          fi

      - name: Upload Built APK Artifact
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: app-debug-apk
          path: |
            **/build/outputs/apk/**/*.apk
            **/build/outputs/bundle/**/*.aab
          retention-days: 14
`;

  return {
    id: 'gh-workflow-android',
    path: '.github/workflows/android.yml',
    originalPath: '.github/workflows/android.yml',
    name: 'android.yml',
    ext: 'yml',
    isBinary: false,
    content: content,
    size: content.length,
    lineCount: content.split('\n').length,
    isSelected: true
  };
}

export function getWebsiteWorkflowFile(isViteProject: boolean = false): ExtractedFile {
  let content = `name: Deploy Website to GitHub Pages

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
  cancel-in-progress: true

jobs:
  deploy:
    environment:
      name: github-pages
      url: \${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    timeout-minutes: 15
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
        uses: actions/deploy-pages@v4
`;

  if (isViteProject) {
    content = `name: Deploy Web App to GitHub Pages

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
  cancel-in-progress: true

jobs:
  build-and-deploy:
    environment:
      name: github-pages
      url: \${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22

      - name: Install Dependencies
        run: npm install --legacy-peer-deps || npm install

      - name: Build Web App
        run: |
          npx vite build --base=./ || npm run build || true
          if [ -d "dist" ]; then
            touch dist/.nojekyll
            [ -f "404.html" ] && cp 404.html dist/ 2>/dev/null || true
            [ -f "index.html" ] && cp index.html dist/404.html 2>/dev/null || true
          fi

      - name: Setup Pages
        uses: actions/configure-pages@v5

      - name: Upload Build Artifacts
        uses: actions/upload-pages-artifact@v3
        with:
          path: \${{ hashFiles('dist/index.html') != '' && './dist' || '.' }}

      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
`;
  }

  return {
    id: 'gh-workflow-website',
    path: '.github/workflows/deploy.yml',
    originalPath: '.github/workflows/deploy.yml',
    name: 'deploy.yml',
    ext: 'yml',
    isBinary: false,
    content: content,
    size: content.length,
    lineCount: content.split('\n').length,
    isSelected: true
  };
}

// Generate sample Android Hello World files for Instant Demo
export function createDemoAndroidProject(): { files: ExtractedFile[]; metadata: AndroidMetadata } {
  const files: ExtractedFile[] = [
    getAndroidWorkflowFile(),
    {
      id: 'd1',
      path: 'app/src/main/AndroidManifest.xml',
      originalPath: 'app/src/main/AndroidManifest.xml',
      name: 'AndroidManifest.xml',
      ext: 'xml',
      isBinary: false,
      content: `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.example.androidapp">

    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="My Android App"
        android:theme="@style/Theme.AppCompat.Light">
        <activity
            android:name=".MainActivity"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>

</manifest>`,
      size: 680,
      lineCount: 19,
      isSelected: true
    },
    {
      id: 'd2',
      path: 'app/src/main/java/com/example/androidapp/MainActivity.kt',
      originalPath: 'app/src/main/java/com/example/androidapp/MainActivity.kt',
      name: 'MainActivity.kt',
      ext: 'kt',
      isBinary: false,
      content: `package com.example.androidapp

import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import android.widget.TextView

class MainActivity : AppCompatActivity() {
    override function onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        val textView = findViewById<TextView>(R.id.welcomeText)
        textView.text = "Hello GitHub! Android Upload Successful."
    }
}`,
      size: 450,
      lineCount: 16,
      isSelected: true
    },
    {
      id: 'd3',
      path: 'app/src/main/res/layout/activity_main.xml',
      originalPath: 'app/src/main/res/layout/activity_main.xml',
      name: 'activity_main.xml',
      ext: 'xml',
      isBinary: false,
      content: `<?xml version="1.0" encoding="utf-8"?>
<RelativeLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:padding="16dp">

    <TextView
        android:id="@+id/welcomeText"
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:text="Welcome to Android GitHub Uploader"
        android:textSize="20sp"
        android:layout_centerInParent="true" />

</RelativeLayout>`,
      size: 480,
      lineCount: 15,
      isSelected: true
    },
    {
      id: 'd4',
      path: 'app/build.gradle.kts',
      originalPath: 'app/build.gradle.kts',
      name: 'build.gradle.kts',
      ext: 'kts',
      isBinary: false,
      content: `plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
}

android {
    namespace = "com.example.androidapp"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.example.androidapp"
        minSdk = 24
        targetSdk = 34
        versionCode = 1
        versionName = "1.0"
    }
}`,
      size: 320,
      lineCount: 18,
      isSelected: true
    },
    {
      id: 'd5',
      path: '.gitignore',
      originalPath: '.gitignore',
      name: '.gitignore',
      ext: 'gitignore',
      isBinary: false,
      content: `*.iml
.gradle
/local.properties
/.idea/
.DS_Store
/build
/captures
.externalNativeBuild
.cxx
local.properties`,
      size: 110,
      lineCount: 11,
      isSelected: true
    },
    {
      id: 'd6',
      path: 'README.md',
      originalPath: 'README.md',
      name: 'README.md',
      ext: 'md',
      isBinary: false,
      content: `# Android App Project

This Android project was extracted and uploaded using **GitHub Android Code Uploader**.

## Structure
- \`app/src/main/java/\`: Source code (Kotlin/Java)
- \`app/src/main/res/\`: Layouts and resources
- \`build.gradle.kts\`: Build configurations
`,
      size: 260,
      lineCount: 10,
      isSelected: true
    }
  ];

  const metadata = analyzeProject(files, 'DemoAndroidApp');
  return { files, metadata };
}

// Generate sample Website Project files for Instant Demo
export function createDemoWebsiteProject(): { files: ExtractedFile[]; metadata: ProjectMetadata } {
  const files: ExtractedFile[] = [
    {
      id: 'web1',
      path: 'index.html',
      originalPath: 'index.html',
      name: 'index.html',
      ext: 'html',
      isBinary: false,
      content: `<!DOCTYPE html>
<html lang="ur" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>خوش آمدید - ڈیمو ویب سائٹ پیج</title>
  <link rel="stylesheet" href="css/style.css">
</head>
<body>
  <div class="container">
    <header>
      <h1>🌐 میری ویب سائٹ (My Website Page)</h1>
      <p>GitHub Uploader کے ذریعے کامیابی سے اپلوڈ کی گئی ویب سائٹ پیج فائلیں۔</p>
    </header>

    <main>
      <section class="card">
        <h2>🚀 فیچرز</h2>
        <ul>
          <li>HTML5, CSS3, JavaScript سپورٹ</li>
          <li>GitHub Pages پر براہ راست لائیو ڈیپلائمنٹ</li>
          <li>فاسٹ اور محفوظ 1-Click اپلوڈ</li>
        </ul>
        <button id="clickBtn">کلک کریں (Click Me)</button>
      </section>
    </main>
  </div>

  <script src="js/script.js"></script>
</body>
</html>`,
      size: 850,
      lineCount: 30,
      isSelected: true
    },
    {
      id: 'web2',
      path: 'css/style.css',
      originalPath: 'css/style.css',
      name: 'style.css',
      ext: 'css',
      isBinary: false,
      content: `/* Modern Responsive CSS Stylesheet */
:root {
  --primary: #10b981;
  --bg-dark: #0f172a;
  --card-bg: #1e293b;
  --text: #f8fafc;
}

body {
  margin: 0;
  padding: 0;
  font-family: system-ui, -apple-system, sans-serif;
  background-color: var(--bg-dark);
  color: var(--text);
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
}

.container {
  width: 90%;
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem;
  background: var(--card-bg);
  border-radius: 16px;
  box-shadow: 0 10px 25px rgba(0,0,0,0.5);
}

button {
  background: var(--primary);
  color: white;
  border: none;
  padding: 12px 24px;
  font-size: 1rem;
  border-radius: 8px;
  cursor: pointer;
  transition: transform 0.2s, background 0.2s;
}

button:hover {
  transform: translateY(-2px);
  background: #059669;
}`,
      size: 780,
      lineCount: 42,
      isSelected: true
    },
    {
      id: 'web3',
      path: 'js/script.js',
      originalPath: 'js/script.js',
      name: 'script.js',
      ext: 'js',
      isBinary: false,
      content: `// Interactive Web Page Script
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('clickBtn');
  if (btn) {
    btn.addEventListener('click', () => {
      alert('مبارک ہو! ویب سائٹ پیج کا سکرپٹ کامیابی سے چل رہا ہے۔');
    });
  }
});`,
      size: 280,
      lineCount: 11,
      isSelected: true
    },
    {
      id: 'web4',
      path: 'package.json',
      originalPath: 'package.json',
      name: 'package.json',
      ext: 'json',
      isBinary: false,
      content: `{
  "name": "my-demo-website",
  "version": "1.0.0",
  "description": "Responsive Web Page Project uploaded via GitHub Uploader",
  "main": "index.html",
  "scripts": {
    "start": "npx serve ."
  },
  "keywords": ["website", "html", "css", "js", "github-pages"]
}`,
      size: 260,
      lineCount: 11,
      isSelected: true
    },
    {
      id: 'web5',
      path: 'README.md',
      originalPath: 'README.md',
      name: 'README.md',
      ext: 'md',
      isBinary: false,
      content: `# 🌐 Demo Website Page

This website source repository was created and uploaded using **GitHub Direct Code Uploader**.

## Files
- \`index.html\`: Main HTML page structure
- \`css/style.css\`: Styling and layout
- \`js/script.js\`: Client-side JavaScript interactions

## GitHub Pages Setup
To publish this website live on GitHub Pages:
1. Go to repository **Settings** -> **Pages**.
2. Under **Build and deployment**, select \`main\` branch and root \`/\` directory.
3. Click **Save** to make your page live!
`,
      size: 450,
      lineCount: 15,
      isSelected: true
    }
  ];

  const metadata = analyzeProject(files, 'DemoWebsitePage');
  return { files, metadata };
}

export async function exportFilesToZip(files: ExtractedFile[], zipName: string = 'exported-project'): Promise<void> {
  const zip = new JSZip();

  // Determine if it's a web project and patch automatically before zipping
  const isAndroid = files.some(
    (f) =>
      f.name === 'AndroidManifest.xml' ||
      f.ext === 'kt' ||
      f.ext === 'gradle' ||
      f.ext === 'kts' ||
      f.path.includes('app/src/main/')
  );

  let exportableFiles = files;
  if (!isAndroid) {
    exportableFiles = patchFilesForGitHubPages(files);
  }

  for (const f of exportableFiles) {
    if (f.isSelected === false) continue;
    if (f.isBinary) {
      try {
        const binaryString = window.atob(f.content);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        zip.file(f.path, bytes);
      } catch (e) {
        zip.file(f.path, f.content);
      }
    } else {
      zip.file(f.path, f.content);
    }
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = zipName.toLowerCase().endsWith('.zip') ? zipName : `${zipName}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Auto-patcher to fix White Screen / Blank Page issues on Vercel and GitHub Pages
export function patchFilesForGitHubPages(files: ExtractedFile[]): ExtractedFile[] {
  let patched = [...files];

  // 1. Check if all files share a common single root folder prefix (e.g. my-app/index.html) and strip it
  if (patched.length > 0) {
    const paths = patched.map((f) => f.path);
    const firstParts = paths[0].split('/');
    if (firstParts.length > 1) {
      const candidate = firstParts[0] + '/';
      if (paths.every((p) => p.startsWith(candidate))) {
        patched = patched.map((f) => ({
          ...f,
          path: f.path.substring(candidate.length)
        }));
      }
    }
  }

  // 2. Ensure root index.html exists. If missing at root, hoist index.html or alias primary html file (e.g. app-tool.html -> index.html)
  const hasRootIndexHtml = patched.some((f) => f.path === 'index.html' || (f.name === 'index.html' && !f.path.includes('/')));
  if (!hasRootIndexHtml) {
    let sourceHtml = patched.find((f) => f.name.toLowerCase() === 'index.html');
    if (!sourceHtml) {
      // Find root .html file or any .html file in the project
      sourceHtml = patched.find((f) => f.ext === 'html' && !f.path.includes('/')) || patched.find((f) => f.ext === 'html');
    }

    if (sourceHtml) {
      patched.push({
        id: 'hoisted-root-index-html',
        path: 'index.html',
        originalPath: 'index.html',
        name: 'index.html',
        ext: 'html',
        isBinary: false,
        content: sourceHtml.content,
        size: sourceHtml.content.length,
        lineCount: sourceHtml.lineCount,
        isSelected: true
      });
    }
  }

  // 3. Ensure .nojekyll file exists at root AND inside public/ so Vite copies it to dist/.nojekyll
  const hasNoJekyll = patched.some((f) => f.path === '.nojekyll' || f.name === '.nojekyll');
  if (!hasNoJekyll) {
    patched.push({
      id: 'nojekyll-file',
      path: '.nojekyll',
      originalPath: '.nojekyll',
      name: '.nojekyll',
      ext: '',
      isBinary: false,
      content: '# Prevents GitHub Pages Jekyll filter from breaking assets\n',
      size: 58,
      lineCount: 2,
      isSelected: true
    });
  }

  const hasPublicNoJekyll = patched.some((f) => f.path === 'public/.nojekyll');
  if (!hasPublicNoJekyll) {
    patched.push({
      id: 'public-nojekyll-file',
      path: 'public/.nojekyll',
      originalPath: 'public/.nojekyll',
      name: '.nojekyll',
      ext: '',
      isBinary: false,
      content: '# Copies to dist/.nojekyll during vite build\n',
      size: 45,
      lineCount: 2,
      isSelected: true
    });
  }

  // 4. Fix index.html paths (convert absolute /src/... or /assets/... to relative ./src/... or ./assets/...)
  patched = patched.map((file) => {
    if (file.ext === 'html') {
      let content = file.content;
      // Remove or fix base href
      content = content.replace(/<base\s+href=["']\/["']\s*\/?>/gi, '<base href="./">');
      content = content.replace(/<base\s+href=["']\/[^"']*["']\s*\/?>/gi, '<base href="./">');
      
      // Replace absolute paths with relative paths
      content = content.replace(/src=["']\/src\//g, 'src="./src/');
      content = content.replace(/src=["']\/assets\//g, 'src="./assets/');
      content = content.replace(/href=["']\/src\//g, 'href="./src/');
      content = content.replace(/href=["']\/assets\//g, 'href="./assets/');
      content = content.replace(/href=["']\/css\//g, 'href="./css/');
      content = content.replace(/src=["']\/js\//g, 'src="./js/');
      content = content.replace(/href=["']\/favicon/g, 'href="./favicon');

      return {
        ...file,
        content
      };
    }
    return file;
  });

  // 5. Detect if Vite/React project
  const isViteProject = patched.some(
    (f) =>
      f.name === 'vite.config.ts' ||
      f.name === 'vite.config.js' ||
      f.path.includes('src/main.tsx') ||
      f.path.includes('src/App.tsx') ||
      (f.name === 'package.json' && f.content.includes('vite'))
  );

  // 6. Force base: './' in vite.config.ts / vite.config.js to resolve asset 404 white screen errors
  if (isViteProject) {
    const viteConfigFile = patched.find((f) => f.name === 'vite.config.ts' || f.name === 'vite.config.js');
    if (viteConfigFile) {
      let content = viteConfigFile.content;
      if (content.includes('base:')) {
        content = content.replace(/base:\s*['"][^'"]*['"]/g, "base: './'");
      } else if (content.includes('defineConfig({')) {
        content = content.replace('defineConfig({', "defineConfig({\n  base: './',");
      } else if (content.includes('export default {')) {
        content = content.replace('export default {', "export default {\n  base: './',");
      }
      patched = patched.map((f) => (f.id === viteConfigFile.id ? { ...f, content } : f));
    } else {
      patched.push({
        id: 'auto-vite-config',
        path: 'vite.config.ts',
        originalPath: 'vite.config.ts',
        name: 'vite.config.ts',
        ext: 'ts',
        isBinary: false,
        content: `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // Ensures relative asset paths on Vercel & GitHub Pages
});
`,
        size: 215,
        lineCount: 9,
        isSelected: true
      });
    }
  }

  // 7. Ensure package.json exists and has valid "build": "vite build" script for GitHub Actions deployment
  const pkgFileIndex = patched.findIndex((f) => f.name === 'package.json');
  if (isViteProject) {
    if (pkgFileIndex >= 0) {
      let pkgContent = patched[pkgFileIndex].content;
      try {
        const pkgObj = JSON.parse(pkgContent);
        if (!pkgObj.scripts) pkgObj.scripts = {};
        if (!pkgObj.scripts.build || pkgObj.scripts.build.includes('tsc')) {
          pkgObj.scripts.build = 'vite build';
        }
        pkgContent = JSON.stringify(pkgObj, null, 2);
        patched[pkgFileIndex] = {
          ...patched[pkgFileIndex],
          content: pkgContent
        };
      } catch {
        // keep as is if unparseable
      }
    } else {
      const defaultPkg = {
        name: 'web-app',
        private: true,
        version: '1.0.0',
        type: 'module',
        scripts: {
          dev: 'vite',
          build: 'vite build',
          preview: 'vite preview'
        },
        dependencies: {
          react: '^18.2.0',
          'react-dom': '^18.2.0'
        },
        devDependencies: {
          '@types/react': '^18.2.0',
          '@types/react-dom': '^18.2.0',
          '@vitejs/plugin-react': '^4.2.0',
          typescript: '^5.2.0',
          vite: '^5.0.0'
        }
      };
      const pkgStr = JSON.stringify(defaultPkg, null, 2);
      patched.push({
        id: 'auto-package-json',
        path: 'package.json',
        originalPath: 'package.json',
        name: 'package.json',
        ext: 'json',
        isBinary: false,
        content: pkgStr,
        size: pkgStr.length,
        lineCount: pkgStr.split('\n').length,
        isSelected: true
      });
    }
  }

  // 9. Create 404.html fallback in root AND public/ for SPAs if missing
  const indexFile = patched.find((f) => f.name === 'index.html' || f.path === 'index.html');
  if (indexFile) {
    const has404 = patched.some((f) => f.name === '404.html' || f.path === '404.html');
    if (!has404) {
      patched.push({
        id: 'auto-404-html',
        path: '404.html',
        originalPath: '404.html',
        name: '404.html',
        ext: 'html',
        isBinary: false,
        content: indexFile.content,
        size: indexFile.content.length,
        lineCount: indexFile.lineCount,
        isSelected: true
      });
    }

    const hasPublic404 = patched.some((f) => f.path === 'public/404.html');
    if (!hasPublic404) {
      patched.push({
        id: 'auto-public-404-html',
        path: 'public/404.html',
        originalPath: 'public/404.html',
        name: '404.html',
        ext: 'html',
        isBinary: false,
        content: indexFile.content,
        size: indexFile.content.length,
        lineCount: indexFile.lineCount,
        isSelected: true
      });
    }
  }

  // 10. Inject/Update .github/workflows/deploy.yml
  const workflowFileIndex = patched.findIndex((f) => f.path.includes('.github/workflows/'));
  const newWorkflow = getWebsiteWorkflowFile(isViteProject);
  if (workflowFileIndex >= 0) {
    patched[workflowFileIndex] = newWorkflow;
  } else {
    patched.push(newWorkflow);
  }

  return patched;
}

// Helper to generate .gitlab-ci.yml for GitLab Pages / Android CI
export function getGitLabCiFile(
  projectType: 'android' | 'website' = 'website',
  isViteProject: boolean = true
): ExtractedFile {
  let content = '';

  if (projectType === 'android') {
    content = `# GitLab CI/CD configuration for Android APK Build
image: ghcr.io/cirruslabs/android-sdk:34

variables:
  GRADLE_OPTS: "-Dorg.gradle.daemon=false"

stages:
  - build

before_script:
  - chmod +x ./gradlew 2>/dev/null || true

assembleDebug:
  stage: build
  script:
    - echo "=== 📱 Starting Android APK Build ==="
    - |
      if [ -f "./gradlew" ]; then
        ./gradlew assembleDebug --stacktrace || ./gradlew build --stacktrace
      else
        gradle assembleDebug --stacktrace || gradle build --stacktrace
      fi
    - echo "=== ✅ Android APK Build Completed ==="
  artifacts:
    name: "android-debug-apk-\${CI_COMMIT_SHORT_SHA}"
    paths:
      - "**/build/outputs/apk/**/*.apk"
    expire_in: 1 month
  rules:
    - if: $CI_COMMIT_BRANCH == "main"
    - if: $CI_COMMIT_BRANCH == "master"
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
    - when: always
`;
  } else {
    // Universal Zero-Fail deployer for both Vite/React and Static HTML on GitLab Pages
    content = `# GitLab CI/CD configuration for GitLab Pages (Universal Zero-Fail Deployer)
image: node:20

stages:
  - deploy

pages:
  stage: deploy
  cache:
    key: \${CI_COMMIT_REF_SLUG}
    paths:
      - .npm/
  script:
    - echo "=== 🚀 Starting GitLab Pages Automated Deployment ==="
    
    # 1. Build project if package.json exists
    - |
      if [ -f "package.json" ]; then
        echo "Found package.json, installing dependencies..."
        npm install --prefer-offline --no-audit --legacy-peer-deps || npm install --no-audit || true
        echo "Compiling web project with Vite/npm..."
        npx vite build --base="./" || npm run build || true
      fi

    # 2. Assemble deployable files into temporary directory
    - |
      rm -rf .deploy_temp
      mkdir -p .deploy_temp

      if [ -d "dist" ] && [ -f "dist/index.html" ]; then
        echo "Found compiled dist/ directory with index.html, using build output..."
        cp -a dist/. .deploy_temp/
      elif [ -f "index.html" ]; then
        echo "Found root index.html, preparing static web files..."
        cp -a . .deploy_temp/ 2>/dev/null || true
        rm -rf .deploy_temp/.git .deploy_temp/.gitlab-ci.yml .deploy_temp/node_modules .deploy_temp/.deploy_temp
      elif [ -d "public" ] && [ -f "public/index.html" ]; then
        echo "Found index.html inside public/, using existing public folder..."
        cp -a public/. .deploy_temp/
      else
        echo "Searching for any index.html in subdirectories..."
        FOUND_HTML=$(find . -maxdepth 3 -name "index.html" | head -n 1)
        if [ -n "$FOUND_HTML" ]; then
          FOUND_DIR=$(dirname "$FOUND_HTML")
          echo "Found index.html in $FOUND_DIR, deploying that directory..."
          cp -a "$FOUND_DIR"/. .deploy_temp/
        else
          echo "Generating clean fallback landing page..."
          echo "<!DOCTYPE html><html lang='en'><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'><title>GitLab Pages</title><style>body{font-family:system-ui,-apple-system,sans-serif;background:#0f172a;color:#f8fafc;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center;padding:1rem;}h1{color:#f97316;margin-bottom:0.5rem;}p{color:#94a3b8;font-size:1.1rem;}</style></head><body><div><h1>🎉 GitLab Pages Deployed</h1><p>Your web project has been successfully published to GitLab Pages!</p></div></body></html>" > .deploy_temp/index.html
        fi
      fi

    # 3. Finalize official public directory for GitLab Pages artifact
    - |
      rm -rf public
      mv .deploy_temp public
      
      # Ensure 404 fallback for SPAs & bypass Jekyll processor
      [ -f "public/index.html" ] && [ ! -f "public/404.html" ] && cp public/index.html public/404.html || true
      touch public/.nojekyll
      
      echo "=== ✅ GitLab Pages Artifact Ready ==="
      ls -la public/
  artifacts:
    paths:
      - public
  rules:
    - if: $CI_COMMIT_BRANCH == "main"
    - if: $CI_COMMIT_BRANCH == "master"
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
    - when: always
`;
  }

  return {
    id: 'gitlab-ci-yml',
    path: '.gitlab-ci.yml',
    originalPath: '.gitlab-ci.yml',
    name: '.gitlab-ci.yml',
    ext: 'yml',
    isBinary: false,
    content,
    size: content.length,
    lineCount: content.split('\n').length,
    isSelected: true
  };
}

// Auto-patch files specifically for GitLab Pages
export function patchFilesForGitLab(
  files: ExtractedFile[],
  explicitType?: 'android' | 'website'
): ExtractedFile[] {
  let patched = patchFilesForGitHubPages(files);

  const detectedAndroid = files.some(
    (f) =>
      f.name === 'AndroidManifest.xml' ||
      f.ext === 'kt' ||
      f.ext === 'gradle' ||
      f.ext === 'kts'
  );

  const effectiveType = explicitType || (detectedAndroid ? 'android' : 'website');

  const isVite = patched.some(
    (f) =>
      f.name === 'vite.config.ts' ||
      f.name === 'vite.config.js' ||
      (f.name === 'package.json' && f.content.includes('vite'))
  );

  // Injects .gitlab-ci.yml
  const gitlabCiIndex = patched.findIndex((f) => f.name === '.gitlab-ci.yml' || f.path === '.gitlab-ci.yml');
  const ciFile = getGitLabCiFile(effectiveType, isVite);

  if (gitlabCiIndex >= 0) {
    patched[gitlabCiIndex] = ciFile;
  } else {
    patched.push(ciFile);
  }

  return patched;
}

// Helper to download just the .gitlab-ci.yml
export function downloadGitLabCiFile(
  projectType: 'android' | 'website' = 'website',
  isViteProject: boolean = true
) {
  const ciFile = getGitLabCiFile(projectType, isViteProject);
  const blob = new Blob([ciFile.content], { type: 'text/yaml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = '.gitlab-ci.yml';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Helper to download just the .github/workflows directory as a ZIP file
export async function downloadWorkflowZip(
  projectType: 'android' | 'website' = 'website',
  isViteProject: boolean = true
) {
  const zip = new JSZip();
  const folder = zip.folder('.github/workflows');
  if (projectType === 'android') {
    const androidWorkflow = getAndroidWorkflowFile();
    folder?.file('android.yml', androidWorkflow.content);
  } else {
    const websiteWorkflow = getWebsiteWorkflowFile(isViteProject);
    folder?.file('deploy.yml', websiteWorkflow.content);
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = projectType === 'android' ? 'github-workflows-android.zip' : 'github-workflows-pages.zip';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}



