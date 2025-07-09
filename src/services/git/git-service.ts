import { GitConfig, GitInfo, ComponentInfo } from '../../types/index.js';
import { GitRepositoryService } from './git-repository.service.js';
import { ComponentDiscoveryService } from './component-discovery.service.js';
import { ComponentDownloadService } from './component-download.service.js';
import path from 'path';
import os from 'os';

export class GitService {
  private gitRepositoryService: GitRepositoryService;
  private componentDiscoveryService: ComponentDiscoveryService;
  private componentDownloadService: ComponentDownloadService;
  private downloadedComponents: Set<string> = new Set();

  constructor(private gitConfig: GitConfig, cacheDir?: string) {
    const resolvedCacheDir = cacheDir || path.join(os.homedir(), '.mui-bueno-cache');
    this.gitRepositoryService = new GitRepositoryService(gitConfig, resolvedCacheDir);
    this.componentDiscoveryService = new ComponentDiscoveryService(resolvedCacheDir);
    this.componentDownloadService = new ComponentDownloadService(resolvedCacheDir);
  }

  async testConnection(): Promise<boolean> {
    return this.gitRepositoryService.testConnection();
  }

  async getGitInfo(): Promise<GitInfo> {
    await this.gitRepositoryService.ensureRepositoryCache();
    return this.gitRepositoryService.getGitInfo();
  }

  async listComponents(branch?: string): Promise<ComponentInfo[]> {
    await this.gitRepositoryService.ensureRepositoryCache(branch);
    return this.componentDiscoveryService.listComponents();
  }

  async downloadComponent(componentName: string, version?: string, outputDir: string = './components'): Promise<string> {
    // Reset downloaded components tracking for new download
    this.downloadedComponents.clear();
    
    // Ensure we're on the right version/branch before starting
    await this.gitRepositoryService.ensureRepositoryCache();
    if (version) {
      await this.gitRepositoryService.checkoutVersion(version);
    }

    return this.downloadComponentWithDependencies(componentName, outputDir);
  }

  private async downloadComponentWithDependencies(componentName: string, outputDir: string): Promise<string> {
    // Check for circular dependencies
    if (this.downloadedComponents.has(componentName)) {
      console.log(`Skipping already downloaded component: ${componentName}`);
      return '';
    }

    // Mark this component as being downloaded
    this.downloadedComponents.add(componentName);

    // Download the component and get its dependencies
    const { extractedPath, dependencies } = await this.componentDownloadService.downloadComponent(componentName, outputDir);

    // Download each dependency
    for (const dependency of dependencies) {
      if (!this.downloadedComponents.has(dependency)) {
        await this.downloadComponentWithDependencies(dependency, outputDir);
      }
    }

    return extractedPath;
  }
} 