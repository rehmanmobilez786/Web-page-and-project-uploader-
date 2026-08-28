export interface ExtractedFile {
  id: string;
  path: string; // cleaned relative path e.g. "app/src/main/java/MainActivity.kt"
  originalPath: string; // full path inside zip
  name: string;
  ext: string;
  isBinary: boolean;
  content: string; // text content or base64 string if binary
  binaryData?: Uint8Array;
  size: number; // in bytes
  lineCount?: number;
  isSelected: boolean;
}

export interface ProjectMetadata {
  projectType: 'android' | 'website';
  projectName: string;
  // Android specific fields
  packageName?: string;
  minSdkVersion?: string;
  targetSdkVersion?: string;
  kotlinVersion?: string;
  gradleVersion?: string;
  hasManifest?: boolean;
  hasGradle?: boolean;
  ktJavaCount?: number;
  xmlCount?: number;
  gradleCount?: number;
  // Website specific fields
  htmlCount?: number;
  cssCount?: number;
  jsCount?: number;
  webAssetCount?: number;
  hasIndexHtml?: boolean;
  frameworkName?: string;
  // General fields
  totalFiles: number;
  totalLines: number;
  totalSize: number;
}

export type AndroidMetadata = ProjectMetadata;

export interface GitHubConfig {
  token: string;
  owner: string;
  repo: string;
  branch: string;
  commitMessage: string;
  isPrivate: boolean;
  autoCreateRepo: boolean;
}

export interface RateLimitStatus {
  limit: number;
  remaining: number;
  resetDate: string;
  isSafe: boolean;
}

export interface GitHubUser {
  login: string;
  avatar_url: string;
  name: string;
  html_url: string;
  hasWorkflowScope?: boolean;
  scopes?: string[];
  isOverprivileged?: boolean;
  rateLimit?: RateLimitStatus;
}

export interface GitHubRepo {
  name: string;
  full_name: string;
  private: boolean;
  html_url: string;
  default_branch: string;
}

export interface UploadState {
  status: 'idle' | 'connecting' | 'creating_repo' | 'uploading_blobs' | 'creating_tree' | 'committing' | 'completed' | 'error';
  progress: number; // 0 to 100
  currentFile?: string;
  detailMessage?: string;
  repoUrl?: string;
  error?: string;
  rateLimitRemaining?: number;
  sanitizedSecretsCount?: number;
}
