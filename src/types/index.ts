export interface Component {
  name: string;
  version: string;
  description?: string;
  tags?: string[];
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  files: ComponentFile[];
  metadata: ComponentMetadata;
}

export interface ComponentFile {
  path: string;
  content: string;
  type: 'tsx' | 'ts' | 'scss' | 'css' | 'json' | 'md' | 'stories' | 'test';
}

export interface ComponentMetadata {
  category?: string;
  subcategory?: string;
  author?: string;
  createdAt: string;
  updatedAt: string;
  size: number;
  checksum: string;
  exports?: string[];
  props?: ComponentProp[];
  branch?: string;
  commit?: string;
}

export interface ComponentProp {
  name: string;
  type: string;
  required: boolean;
  description?: string;
  defaultValue?: any;
}

export interface ComponentRegistry {
  components: Component[];
  lastUpdated: string;
  version: string;
}

export interface GitConfig {
  repositoryUrl: string;
  branch: string;
  sshKeyPath?: string;
  username?: string;
}

export interface CliConfig {
  git: GitConfig;
  defaultDownloadPath?: string;
  author?: string;
  workspace?: string;
  cacheDir?: string;
}

export interface DownloadOptions {
  version?: string;
  branch?: string;
  commit?: string;
  outputDir?: string;
  force?: boolean;
  includeTests?: boolean;
  includeStories?: boolean;
  installDeps?: boolean;
  packageManager?: string;
}

export interface SearchOptions {
  category?: string;
  tags?: string[];
  author?: string;
  branch?: string;
  limit?: number;
}

export interface GitInfo {
  currentBranch: string;
  latestCommit: string;
  availableBranches: string[];
  availableTags: string[];
}

export interface ComponentInfo {
  name: string;
  path: string;
  branches: string[];
  tags: string[];
  versions: string[];
} 