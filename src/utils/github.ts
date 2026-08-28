import { ExtractedFile, GitHubUser, GitHubRepo, UploadState, RateLimitStatus } from '../types';
import { checkTokenSecurityScopes, filterSafeFilesForUpload, safeRateDelay } from './security';

const GITHUB_API_URL = 'https://api.github.com';

// Cache for last detected rate limit info
let latestRateLimitStatus: RateLimitStatus | undefined;

export function getLatestRateLimitStatus(): RateLimitStatus | undefined {
  return latestRateLimitStatus;
}

// Parse rate limit headers from any GitHub API response
export function parseRateLimitHeaders(res: Response): RateLimitStatus {
  const limitHeader = res.headers.get('x-ratelimit-limit');
  const remainingHeader = res.headers.get('x-ratelimit-remaining');
  const resetHeader = res.headers.get('x-ratelimit-reset');

  const limit = limitHeader ? parseInt(limitHeader, 10) : 5000;
  const remaining = remainingHeader ? parseInt(remainingHeader, 10) : 4999;
  const resetEpoch = resetHeader ? parseInt(resetHeader, 10) * 1000 : Date.now() + 3600000;
  const resetDate = new Date(resetEpoch).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const status: RateLimitStatus = {
    limit,
    remaining,
    resetDate,
    isSafe: remaining > 100
  };

  latestRateLimitStatus = status;
  return status;
}

// Safe API fetch with secondary rate limit detection and exponential backoff
async function safeGitHubFetch(
  url: string,
  options: RequestInit,
  retryCount: number = 2
): Promise<Response> {
  for (let attempt = 0; attempt <= retryCount; attempt++) {
    try {
      const res = await fetch(url, options);
      parseRateLimitHeaders(res);

      // Handle Secondary Rate Limits / Abuse detection (403 with retry-after or 429)
      if (res.status === 429 || (res.status === 403 && res.headers.get('retry-after'))) {
        const retryAfterSec = parseInt(res.headers.get('retry-after') || '2', 10);
        console.warn(`GitHub Rate Limit throttle detected. Backing off for ${retryAfterSec}s...`);
        if (attempt < retryCount) {
          await new Promise((resolve) => setTimeout(resolve, (retryAfterSec + 1) * 1000));
          continue;
        }
      }

      return res;
    } catch (err) {
      if (attempt >= retryCount) throw err;
      await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
    }
  }

  return await fetch(url, options);
}

// Fetch user info to verify PAT and check security scopes & rate limits
export async function getGitHubUser(token: string): Promise<GitHubUser> {
  const res = await safeGitHubFetch(`${GITHUB_API_URL}/user`, {
    headers: {
      Authorization: `Bearer ${token.trim()}`,
      Accept: 'application/vnd.github.v3+json'
    }
  });

  if (!res.ok) {
    if (res.status === 401) {
      throw new Error('غلط ٹوکن! براہ کرم درست GitHub Personal Access Token درج کریں۔ (Invalid Token)');
    }
    throw new Error(`GitHub user authentication failed: ${res.statusText}`);
  }

  const oauthScopesHeader = res.headers.get('x-oauth-scopes');
  const tokenReport = checkTokenSecurityScopes(oauthScopesHeader);
  const rateLimit = parseRateLimitHeaders(res);

  const userData = await res.json();
  return {
    ...userData,
    hasWorkflowScope: tokenReport.hasWorkflowScope,
    scopes: tokenReport.scopes,
    isOverprivileged: tokenReport.hasOverprivilegedScope,
    rateLimit
  };
}

// Fetch user repositories
export async function getGitHubRepos(token: string): Promise<GitHubRepo[]> {
  const res = await safeGitHubFetch(`${GITHUB_API_URL}/user/repos?per_page=100&sort=updated`, {
    headers: {
      Authorization: `Bearer ${token.trim()}`,
      Accept: 'application/vnd.github.v3+json'
    }
  });

  if (!res.ok) {
    throw new Error('ریپوزٹریز لوڈ کرنے میں ناکامی (Failed to fetch repositories)');
  }

  return await res.json();
}

// Create new repository
export async function createGitHubRepo(
  token: string,
  repoName: string,
  isPrivate: boolean
): Promise<GitHubRepo> {
  const res = await safeGitHubFetch(`${GITHUB_API_URL}/user/repos`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token.trim()}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: repoName,
      private: isPrivate,
      auto_init: true, // auto initialize with README so main branch ref exists
      description: 'Application project uploaded safely via GitHub Direct Uploader'
    })
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.message || `ریپوزٹری بنانے میں ناکامی (Failed to create repository: ${res.status})`);
  }

  return await res.json();
}

// Helper to clean Git relative paths
export function cleanGitPath(rawPath: string): string {
  if (!rawPath) return '';
  let p = rawPath.replace(/\\/g, '/').trim();
  while (p.startsWith('/') || p.startsWith('./')) {
    p = p.replace(/^(\/+|\.\/)/, '');
  }
  p = p.replace(/\/+/g, '/');
  p = p.replace(/\/+$/, '').trim();
  return p;
}

// Fallback upload method using GitHub Contents API directly if Git Tree API fails
async function uploadViaContentsApi(
  token: string,
  owner: string,
  repo: string,
  branch: string,
  commitMessage: string,
  selectedFiles: ExtractedFile[],
  onProgress: (state: UploadState) => void
): Promise<string> {
  const headers = {
    Authorization: `Bearer ${token.trim()}`,
    Accept: 'application/vnd.github.v3+json',
    'Content-Type': 'application/json'
  };

  const encodeToBase64 = (str: string, isBinary: boolean): string => {
    if (isBinary) return str;
    try {
      const bytes = new TextEncoder().encode(str);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      return window.btoa(binary);
    } catch {
      return window.btoa(str);
    }
  };

  const total = selectedFiles.length;
  let skippedWorkflows = false;

  // First, fetch existing tree on branch and delete any old files that are not present in selectedFiles
  try {
    const treeRes = await safeGitHubFetch(
      `${GITHUB_API_URL}/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
      { headers }
    );
    if (treeRes.ok) {
      const treeData = await treeRes.json();
      if (Array.isArray(treeData.tree)) {
        const newPathsSet = new Set(selectedFiles.map((f) => cleanGitPath(f.path)));
        const oldBlobs = treeData.tree.filter(
          (item: any) => item.type === 'blob' && !item.path.startsWith('.git/')
        );

        for (const oldBlob of oldBlobs) {
          if (!newPathsSet.has(oldBlob.path)) {
            onProgress({
              status: 'uploading_blobs',
              progress: 75,
              currentFile: oldBlob.path,
              detailMessage: `پرانی فائل ختم کی جا رہی ہے (Deleting old file): ${oldBlob.path}`,
              rateLimitRemaining: latestRateLimitStatus?.remaining
            });
            await safeGitHubFetch(`${GITHUB_API_URL}/repos/${owner}/${repo}/contents/${oldBlob.path}`, {
              method: 'DELETE',
              headers,
              body: JSON.stringify({
                message: `Delete old file ${oldBlob.path} to replace repository with new ZIP`,
                sha: oldBlob.sha,
                branch: branch
              })
            }).catch(() => {});
            await safeRateDelay(60);
          }
        }
      }
    }
  } catch (err) {
    console.warn('Could not clean old files via Contents API:', err);
  }

  for (let i = 0; i < total; i++) {
    const file = selectedFiles[i];
    const cleanPath = cleanGitPath(file.path);
    if (!cleanPath || cleanPath.startsWith('.git/')) continue;

    const progressPercent = 80 + Math.round(((i + 1) / total) * 18);
    onProgress({
      status: 'uploading_blobs',
      progress: progressPercent,
      currentFile: cleanPath,
      detailMessage: `مستقیم اپلوڈ (Direct API): ${cleanPath} (${i + 1}/${total})`,
      rateLimitRemaining: latestRateLimitStatus?.remaining
    });

    let existingSha: string | undefined = undefined;
    try {
      const getRes = await safeGitHubFetch(`${GITHUB_API_URL}/repos/${owner}/${repo}/contents/${cleanPath}?ref=${encodeURIComponent(branch)}`, { headers });
      if (getRes.ok) {
        const getData = await getRes.json();
        existingSha = getData.sha;
      }
    } catch {
      // File does not exist yet
    }

    const base64Content = encodeToBase64(file.content, file.isBinary);

    try {
      let putRes = await safeGitHubFetch(`${GITHUB_API_URL}/repos/${owner}/${repo}/contents/${cleanPath}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          message: `${commitMessage} (${cleanPath})`,
          content: base64Content,
          branch: branch,
          sha: existingSha
        })
      });

      if (!putRes.ok && !cleanPath.includes('.github/workflows/')) {
        // retry once with rate safe delay
        await safeRateDelay(400);
        putRes = await safeGitHubFetch(`${GITHUB_API_URL}/repos/${owner}/${repo}/contents/${cleanPath}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({
            message: `${commitMessage} (${cleanPath})`,
            content: base64Content,
            branch: branch,
            sha: existingSha
          })
        });
      }

      if (!putRes.ok) {
        if (cleanPath.includes('.github/workflows/')) {
          console.warn(`Skipping workflow file "${cleanPath}" due to PAT scope/permission restriction.`);
          skippedWorkflows = true;
          continue;
        }
        const err = await putRes.json().catch(() => ({}));
        throw new Error(`فائل "${cleanPath}" اپلوڈ کرنے میں ناکامی: ${err.message || putRes.statusText}`);
      }

      // Safe rate delay between file uploads
      await safeRateDelay(70);
    } catch (err: any) {
      if (cleanPath.includes('.github/workflows/')) {
        console.warn(`Skipping workflow file "${cleanPath}" due to error:`, err);
        skippedWorkflows = true;
        continue;
      }
      throw err;
    }
  }

  const finalRepoUrl = `https://github.com/${owner}/${repo}`;
  onProgress({
    status: 'completed',
    progress: 100,
    detailMessage: skippedWorkflows
      ? 'کامیابی! کوڈ اپلوڈ ہو گیا (نوٹ: Workflow فائل کے لیے PAT میں workflow scope درکار ہے)'
      : 'کامیابی! تمام فائلیں GitHub پر محفوظ ہو گئی ہیں۔',
    repoUrl: finalRepoUrl,
    rateLimitRemaining: latestRateLimitStatus?.remaining
  });

  return finalRepoUrl;
}

// Core Direct Project Upload using Git Database API with fallback and anti-abuse safeguards
export async function uploadProjectToGitHub(
  token: string,
  rawOwner: string,
  rawRepo: string,
  branch: string,
  commitMessage: string,
  files: ExtractedFile[],
  onProgress: (state: UploadState) => void
): Promise<string> {
  const headers = {
    Authorization: `Bearer ${token.trim()}`,
    Accept: 'application/vnd.github.v3+json',
    'Content-Type': 'application/json'
  };

  let owner = rawOwner.trim();
  let repo = rawRepo.trim();
  if (repo.includes('/')) {
    const parts = repo.split('/');
    owner = parts[0].trim();
    repo = parts[1].trim();
  }

  // Filter out dangerous/blacklisted local junk files (e.g. .git, .DS_Store, .idea)
  const safeFiles = filterSafeFilesForUpload(files);
  const selectedFiles = safeFiles.filter((f) => f.isSelected);
  if (selectedFiles.length === 0) {
    throw new Error('اپلوڈ کے لیے کوئی فائل منتخب نہیں کی گئی۔ (No files selected)');
  }

  onProgress({
    status: 'connecting',
    progress: 5,
    detailMessage: 'GitHub ریپوزٹری کی معلومات حاصل کی جا رہی ہیں... (Verifying repository)',
    rateLimitRemaining: latestRateLimitStatus?.remaining
  });

  // Verify repository exists and get details
  const repoInfoRes = await safeGitHubFetch(`${GITHUB_API_URL}/repos/${owner}/${repo}`, { headers });
  if (!repoInfoRes.ok) {
    if (repoInfoRes.status === 404) {
      throw new Error(`ریپوزٹری "${owner}/${repo}" نہیں ملی۔ یا تو نام غلط ہے یا PAT ٹوکن کے پاس اس کی رسائی نہیں ہے۔`);
    }
    throw new Error(`GitHub ریپوزٹری تک رسائی میں ناکامی (${repoInfoRes.status}): ${repoInfoRes.statusText}`);
  }

  const repoInfo = await repoInfoRes.json();
  const targetBranch = (branch || repoInfo.default_branch || 'main').trim();
  const commitMsg = commitMessage || 'Upload Project files via GitHub Uploader';

  // Helper to get branch ref & commit SHA
  const getBranchRef = async (b: string) => {
    try {
      const res = await safeGitHubFetch(`${GITHUB_API_URL}/repos/${owner}/${repo}/git/refs/heads/${encodeURIComponent(b)}`, { headers });
      if (res.ok) {
        const data = await res.json();
        return data.object?.sha || null;
      }
    } catch {
      // ignore
    }
    return null;
  };

  let parentCommitSha: string | null = await getBranchRef(targetBranch);

  if (!parentCommitSha && repoInfo.default_branch) {
    parentCommitSha = await getBranchRef(repoInfo.default_branch);
  }

  if (!parentCommitSha) {
    await safeRateDelay(400);
    parentCommitSha = await getBranchRef(targetBranch) || (repoInfo.default_branch ? await getBranchRef(repoInfo.default_branch) : null);
  }

  // If repository is completely empty (no refs exist at all)
  if (!parentCommitSha) {
    onProgress({
      status: 'connecting',
      progress: 10,
      detailMessage: `ریپوزٹری خالی ہے۔ ابتدائی کمیٹ بنائی جا رہی ہے... (Initializing repo)`,
      rateLimitRemaining: latestRateLimitStatus?.remaining
    });

    const initRes = await safeGitHubFetch(`${GITHUB_API_URL}/repos/${owner}/${repo}/contents/README.md`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        message: 'Initial commit (Safe Code Uploader)',
        content: window.btoa('# ' + repo + '\nApplication project code.'),
        branch: targetBranch
      })
    });

    if (initRes.ok) {
      await safeRateDelay(400);
      parentCommitSha = await getBranchRef(targetBranch) || (repoInfo.default_branch ? await getBranchRef(repoInfo.default_branch) : null);
    }
  }

  const encodeToBase64 = (str: string, isBinary: boolean): string => {
    if (isBinary) return str;
    try {
      const bytes = new TextEncoder().encode(str);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      return window.btoa(binary);
    } catch {
      return window.btoa(str);
    }
  };

  let skippedWorkflows = false;

  // Step 3: Create blobs for each file with anti-abuse safe delay
  onProgress({
    status: 'uploading_blobs',
    progress: 15,
    detailMessage: `فائلوں کے لیے Git Blobs بنائے جا رہے ہیں (0/${selectedFiles.length})...`,
    rateLimitRemaining: latestRateLimitStatus?.remaining
  });

  const treeEntriesMap = new Map<string, { path: string; mode: string; type: 'blob'; sha: string }>();

  for (let i = 0; i < selectedFiles.length; i++) {
    const file = selectedFiles[i];
    const progressPercent = 15 + Math.round(((i + 1) / selectedFiles.length) * 60);

    const sanitizedPath = cleanGitPath(file.path);
    if (!sanitizedPath || sanitizedPath === '.' || sanitizedPath.startsWith('.git/')) continue;

    onProgress({
      status: 'uploading_blobs',
      progress: progressPercent,
      currentFile: sanitizedPath,
      detailMessage: `محفوظ اپلوڈ جاری: ${sanitizedPath} (${i + 1}/${selectedFiles.length})`,
      rateLimitRemaining: latestRateLimitStatus?.remaining
    });

    const base64Content = encodeToBase64(file.content, file.isBinary);

    try {
      const blobRes = await safeGitHubFetch(`${GITHUB_API_URL}/repos/${owner}/${repo}/git/blobs`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          content: base64Content,
          encoding: 'base64'
        })
      });

      if (!blobRes.ok) {
        if (sanitizedPath.includes('.github/workflows/')) {
          skippedWorkflows = true;
          continue;
        }
        const err = await blobRes.json().catch(() => ({}));
        throw new Error(`فائل "${sanitizedPath}" کا blob بنانے میں ناکامی: ${err.message || blobRes.statusText}`);
      }

      const blobData = await blobRes.json();

      const isExecutable = file.name === 'gradlew' || file.name.endsWith('.sh');
      const mode = isExecutable ? '100755' : '100644';

      treeEntriesMap.set(sanitizedPath, {
        path: sanitizedPath,
        mode: mode,
        type: 'blob',
        sha: blobData.sha
      });

      // Pacing delay between requests to protect against secondary rate limit / abuse detection
      await safeRateDelay(70);
    } catch (err: any) {
      if (sanitizedPath.includes('.github/workflows/')) {
        skippedWorkflows = true;
        continue;
      }
      throw err;
    }
  }

  const treeEntries = Array.from(treeEntriesMap.values());

  // Step 4: Create new Git Tree
  onProgress({
    status: 'creating_tree',
    progress: 80,
    detailMessage: 'نیا Git Tree تشکیل دیا جا رہا ہے... (Creating Git Tree)',
    rateLimitRemaining: latestRateLimitStatus?.remaining
  });

  let treeRes: Response | null = null;

  const tryCreateTree = async (entries: typeof treeEntries, baseSha: string | null = null) => {
    const payload: any = { tree: entries };
    if (baseSha) payload.base_tree = baseSha;
    return await safeGitHubFetch(`${GITHUB_API_URL}/repos/${owner}/${repo}/git/trees`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });
  };

  try { treeRes = await tryCreateTree(treeEntries, null); } catch { treeRes = null; }

  // If tree creation failed and treeEntries contains workflow files, retry without workflow files
  if ((!treeRes || !treeRes.ok) && treeEntries.some((e) => e.path.includes('.github/workflows/'))) {
    const nonWorkflowEntries = treeEntries.filter((e) => !e.path.includes('.github/workflows/'));
    skippedWorkflows = true;
    try { treeRes = await tryCreateTree(nonWorkflowEntries, null); } catch { treeRes = null; }
  }

  // Fallback to Contents API if Git Tree API failed
  if (!treeRes || !treeRes.ok) {
    console.warn('Git Tree API failed, switching to direct Contents API upload...');
    return await uploadViaContentsApi(token, owner, repo, targetBranch, commitMsg, selectedFiles, onProgress);
  }

  const newTreeData = await treeRes.json();

  // Step 5: Create new Commit
  onProgress({
    status: 'committing',
    progress: 90,
    detailMessage: 'GitHub پر سیکیور کمیٹ (Commit) رجسٹر کی جا رہی ہے...',
    rateLimitRemaining: latestRateLimitStatus?.remaining
  });

  let newCommitRes: Response | null = null;

  if (parentCommitSha) {
    newCommitRes = await safeGitHubFetch(`${GITHUB_API_URL}/repos/${owner}/${repo}/git/commits`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        message: commitMsg,
        tree: newTreeData.sha,
        parents: [parentCommitSha]
      })
    });
  }

  if (!newCommitRes || !newCommitRes.ok) {
    newCommitRes = await safeGitHubFetch(`${GITHUB_API_URL}/repos/${owner}/${repo}/git/commits`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        message: commitMsg,
        tree: newTreeData.sha
      })
    });
  }

  if (!newCommitRes.ok) {
    console.warn('Git Commit API failed, switching to direct Contents API upload...');
    return await uploadViaContentsApi(token, owner, repo, targetBranch, commitMsg, selectedFiles, onProgress);
  }

  const newCommitData = await newCommitRes.json();

  // Step 6: Update or Create branch ref
  onProgress({
    status: 'committing',
    progress: 95,
    detailMessage: `برانچ "${targetBranch}" اپڈیٹ کی جا رہی ہے...`,
    rateLimitRemaining: latestRateLimitStatus?.remaining
  });

  let updateRefRes = await safeGitHubFetch(
    `${GITHUB_API_URL}/repos/${owner}/${repo}/git/refs/heads/${encodeURIComponent(targetBranch)}`,
    {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        sha: newCommitData.sha,
        force: true
      })
    }
  );

  if (!updateRefRes.ok) {
    updateRefRes = await safeGitHubFetch(`${GITHUB_API_URL}/repos/${owner}/${repo}/git/refs`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        ref: `refs/heads/${targetBranch}`,
        sha: newCommitData.sha
      })
    });
  }

  if (!updateRefRes.ok) {
    console.warn('Git Ref API failed, switching to direct Contents API upload...');
    return await uploadViaContentsApi(token, owner, repo, targetBranch, commitMsg, selectedFiles, onProgress);
  }

  const finalRepoUrl = `https://github.com/${owner}/${repo}`;

  onProgress({
    status: 'completed',
    progress: 100,
    detailMessage: skippedWorkflows
      ? 'کامیابی! کوڈ محفوظ طریقے سے اپلوڈ ہو گیا (نوٹ: Workflow فائل کے لیے PAT میں workflow scope درکار تھا)'
      : 'کامیابی! تمام کوڈ اور سیکیور کنفیگریشن GitHub پر محفوظ ہو چکی ہے۔',
    repoUrl: finalRepoUrl,
    rateLimitRemaining: latestRateLimitStatus?.remaining
  });

  return finalRepoUrl;
}
