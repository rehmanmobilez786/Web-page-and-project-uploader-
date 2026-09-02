import { ExtractedFile, GitLabUser, GitLabProject, UploadState } from '../types';
import { filterSafeFilesForUpload, safeRateDelay } from './security';
import { cleanGitPath } from './github';

const DEFAULT_GITLAB_API = 'https://gitlab.com';

function normalizeInstanceUrl(url?: string): string {
  if (!url || !url.trim()) return DEFAULT_GITLAB_API;
  let normalized = url.trim().replace(/\/+$/, '');
  if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
    normalized = `https://${normalized}`;
  }
  return normalized;
}

// Helper to make authenticated requests to GitLab API
async function safeGitLabFetch(
  endpoint: string,
  token: string,
  options: RequestInit = {},
  instanceUrl: string = DEFAULT_GITLAB_API
): Promise<Response> {
  const base = normalizeInstanceUrl(instanceUrl);
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const fullUrl = `${base}/api/v4${cleanEndpoint}`;

  const headers: Record<string, string> = {
    'PRIVATE-TOKEN': token.trim(),
    Accept: 'application/json',
    ...(options.headers as Record<string, string> || {})
  };

  return await fetch(fullUrl, {
    ...options,
    headers
  });
}

// Fetch authenticated GitLab user profile
export async function getGitLabUser(
  token: string,
  instanceUrl: string = DEFAULT_GITLAB_API
): Promise<GitLabUser> {
  if (!token.trim()) {
    throw new Error('برائے مہربانی اپنا GitLab Personal Access Token درج کریں۔');
  }

  const res = await safeGitLabFetch('/user', token, {}, instanceUrl);

  if (!res.ok) {
    if (res.status === 401) {
      throw new Error('غلط ٹوکن! براہ کرم درست GitLab Personal Access Token (PAT) درج کریں۔ (Invalid Token)');
    }
    throw new Error(`GitLab authentication failed (${res.status}): ${res.statusText}`);
  }

  const userData = await res.json();
  return {
    id: userData.id,
    username: userData.username,
    name: userData.name,
    avatar_url: userData.avatar_url,
    web_url: userData.web_url,
    state: userData.state
  };
}

// Fetch user's GitLab projects
export async function getGitLabProjects(
  token: string,
  instanceUrl: string = DEFAULT_GITLAB_API
): Promise<GitLabProject[]> {
  const res = await safeGitLabFetch(
    '/projects?membership=true&order_by=updated_at&per_page=100',
    token,
    {},
    instanceUrl
  );

  if (!res.ok) {
    throw new Error('GitLab پروجیکٹس لوڈ کرنے میں ناکامی (Failed to fetch GitLab projects)');
  }

  const data = await res.json();
  return data.map((p: any) => ({
    id: p.id,
    name: p.name,
    name_with_namespace: p.name_with_namespace,
    path: p.path,
    path_with_namespace: p.path_with_namespace,
    web_url: p.web_url,
    default_branch: p.default_branch || 'main',
    visibility: p.visibility
  }));
}

// Create new project on GitLab
export async function createGitLabProject(
  token: string,
  projectName: string,
  isPrivate: boolean,
  instanceUrl: string = DEFAULT_GITLAB_API
): Promise<GitLabProject> {
  const cleanName = projectName.trim();
  const pathSlug = cleanName.toLowerCase().replace(/[^a-z0-9_-]/g, '-');

  const res = await safeGitLabFetch(
    '/projects',
    token,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: cleanName,
        path: pathSlug,
        visibility: isPrivate ? 'private' : 'public',
        initialize_with_readme: true,
        description: 'Application project uploaded safely via Safe Project Uploader'
      })
    },
    instanceUrl
  );

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const message = typeof errData.message === 'object'
      ? JSON.stringify(errData.message)
      : errData.message || res.statusText;
    throw new Error(`GitLab پر نیا پروجیکٹ بنانے میں ناکامی: ${message}`);
  }

  const p = await res.json();
  return {
    id: p.id,
    name: p.name,
    name_with_namespace: p.name_with_namespace,
    path: p.path,
    path_with_namespace: p.path_with_namespace,
    web_url: p.web_url,
    default_branch: p.default_branch || 'main',
    visibility: p.visibility
  };
}

// Helper to encode string to base64
function encodeToBase64(str: string, isBinary: boolean): string {
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
}

// Upload project files directly to GitLab using Repository Commits API
export async function uploadProjectToGitLab(
  token: string,
  projectIdOrPath: string | number,
  branch: string,
  commitMessage: string,
  files: ExtractedFile[],
  onProgress: (state: UploadState) => void,
  instanceUrl: string = DEFAULT_GITLAB_API
): Promise<{ webUrl: string; pagesUrl?: string }> {
  const encodedId = encodeURIComponent(String(projectIdOrPath).trim());

  // 1. Filter safe files
  const safeFiles = filterSafeFilesForUpload(files);
  const selectedFiles = safeFiles.filter((f) => f.isSelected);

  if (selectedFiles.length === 0) {
    throw new Error('اپلوڈ کے لیے کوئی فائل منتخب نہیں کی گئی۔ (No files selected)');
  }

  onProgress({
    status: 'connecting',
    progress: 5,
    detailMessage: 'GitLab پروجیکٹ کی تصدیق کی جا رہی ہے... (Connecting to GitLab)'
  });

  // 2. Fetch project details
  const projectRes = await safeGitLabFetch(`/projects/${encodedId}`, token, {}, instanceUrl);
  if (!projectRes.ok) {
    if (projectRes.status === 404) {
      throw new Error(`GitLab پروجیکٹ "${projectIdOrPath}" نہیں ملا۔ برائے مہربانی درست نام یا ID چیک کریں۔`);
    }
    throw new Error(`GitLab پروجیکٹ تک رسائی میں ناکامی (${projectRes.status})`);
  }

  const projectData = await projectRes.json();
  const targetBranch = (branch || projectData.default_branch || 'main').trim();
  const commitMsg = commitMessage || 'Upload Project files via GitLab Direct Uploader';

  // 3. Fetch existing files in repo tree to decide between 'create' or 'update' actions
  onProgress({
    status: 'connecting',
    progress: 15,
    detailMessage: 'موجودہ ریپوزٹری فائل سٹرکچر چیک کیا جا رہا ہے...'
  });

  const existingFilePaths = new Set<string>();
  try {
    const treeRes = await safeGitLabFetch(
      `/projects/${encodedId}/repository/tree?recursive=true&per_page=100`,
      token,
      {},
      instanceUrl
    );
    if (treeRes.ok) {
      const treeData = await treeRes.json();
      if (Array.isArray(treeData)) {
        treeData.forEach((item: any) => {
          if (item.type === 'blob') {
            existingFilePaths.add(item.path);
          }
        });
      }
    }
  } catch (e) {
    console.warn('Could not fetch existing GitLab tree:', e);
  }

  // 4. Build commit actions for GitLab Commit API
  onProgress({
    status: 'uploading_blobs',
    progress: 25,
    detailMessage: `فائلیں Commit کے لیے تیار کی جا رہی ہیں (0/${selectedFiles.length})...`
  });

  const commitActions: Array<{
    action: 'create' | 'update';
    file_path: string;
    content: string;
    encoding: 'base64';
    execute_filemode?: boolean;
  }> = [];

  for (let i = 0; i < selectedFiles.length; i++) {
    const file = selectedFiles[i];
    const cleanPath = cleanGitPath(file.path);
    if (!cleanPath || cleanPath === '.' || cleanPath.startsWith('.git/')) continue;

    const base64Content = encodeToBase64(file.content, file.isBinary);
    const actionType: 'create' | 'update' = existingFilePaths.has(cleanPath) ? 'update' : 'create';
    const isExecutable = file.name === 'gradlew' || file.name.endsWith('.sh');

    commitActions.push({
      action: actionType,
      file_path: cleanPath,
      content: base64Content,
      encoding: 'base64',
      ...(isExecutable ? { execute_filemode: true } : {})
    });
  }

  // 5. Commit files in batches (GitLab API supports batches up to 50-100 files per commit)
  const BATCH_SIZE = 40;
  const totalBatches = Math.ceil(commitActions.length / BATCH_SIZE);

  for (let b = 0; b < totalBatches; b++) {
    const batchSlice = commitActions.slice(b * BATCH_SIZE, (b + 1) * BATCH_SIZE);
    const progressPercent = 30 + Math.round(((b + 1) / totalBatches) * 60);

    onProgress({
      status: 'committing',
      progress: progressPercent,
      detailMessage: `GitLab پر سیکیور کمیٹ بھیجی جا رہی ہے (بیچ ${b + 1}/${totalBatches})...`
    });

    const commitPayload = {
      branch: targetBranch,
      commit_message: totalBatches > 1 ? `${commitMsg} (Part ${b + 1}/${totalBatches})` : commitMsg,
      actions: batchSlice
    };

    let commitRes = await safeGitLabFetch(
      `/projects/${encodedId}/repository/commits`,
      token,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(commitPayload)
      },
      instanceUrl
    );

    // If commit failed because some 'create' files already existed, fallback to update and retry
    if (!commitRes.ok) {
      const errData = await commitRes.json().catch(() => ({}));
      console.warn('Commit attempt error:', errData);

      // Convert all 'create' in this batch to 'update' and retry
      const adjustedSlice = batchSlice.map((act) => ({
        ...act,
        action: 'create' as const // or update if exists
      }));

      // Retry with alternative fallback
      await safeRateDelay(300);
      commitRes = await safeGitLabFetch(
        `/projects/${encodedId}/repository/commits`,
        token,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            branch: targetBranch,
            commit_message: `${commitMsg} (Retry ${b + 1}/${totalBatches})`,
            actions: adjustedSlice
          })
        },
        instanceUrl
      );

      if (!commitRes.ok) {
        const finalErr = await commitRes.json().catch(() => ({}));
        throw new Error(`GitLab پر کمیٹ کرنے میں ناکامی: ${finalErr.message || commitRes.statusText}`);
      }
    }

    await safeRateDelay(150);
  }

  // 6. Calculate GitLab Pages URL
  // GitLab Pages format: https://<username>.gitlab.io/<project-path>/
  let pagesUrl: string | undefined = undefined;
  const namespace = projectData.path_with_namespace ? projectData.path_with_namespace.split('/')[0] : '';
  const projectSlug = projectData.path || projectData.name;
  if (namespace && projectSlug) {
    pagesUrl = `https://${namespace}.gitlab.io/${projectSlug}/`;
  }

  const finalWebUrl = projectData.web_url || `https://gitlab.com/${projectData.path_with_namespace}`;

  onProgress({
    status: 'completed',
    progress: 100,
    detailMessage: 'کامیابی! تمام کوڈ اور GitLab CI کنفیگریشن کامیابی سے GitLab پر پش ہو چکی ہے۔',
    repoUrl: finalWebUrl
  });

  return {
    webUrl: finalWebUrl,
    pagesUrl
  };
}
