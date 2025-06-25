import { GitConfig, GitInfo, ComponentInfo } from '../types/index.js';
export declare class GitService {
    private config;
    private cacheDir;
    constructor(config: GitConfig, cacheDir?: string);
    testConnection(): Promise<boolean>;
    ensureRepositoryCache(): Promise<string>;
    private cloneRepository;
    private updateRepository;
    getAvailableBranches(): Promise<string[]>;
    getAvailableTags(): Promise<string[]>;
    getGitInfo(): Promise<GitInfo>;
    listComponents(branch?: string): Promise<ComponentInfo[]>;
    downloadComponent(name: string, version?: string, outputDir?: string): Promise<string>;
    private getAvailableComponentNames;
    private checkoutBranch;
    private checkoutVersion;
    private getComponentBranches;
    private getComponentTags;
    private getSSHCommand;
    clearCache(): Promise<void>;
}
//# sourceMappingURL=git-service.d.ts.map