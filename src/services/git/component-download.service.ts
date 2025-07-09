import fs from 'fs-extra';
import path from 'path';
import { DependencyAnalysisService } from './dependency-analysis.service.js';
import { ImportPathService } from './import-path.service.js';

interface DownloadResult {
  extractedPath: string;
  dependencies: string[];
}

export class ComponentDownloadService {
  private dependencyAnalysisService: DependencyAnalysisService;
  private importPathService: ImportPathService;

  constructor(private cacheDir: string) {
    this.dependencyAnalysisService = new DependencyAnalysisService();
    this.importPathService = new ImportPathService();
  }

  async downloadComponent(componentName: string, outputDir: string): Promise<DownloadResult> {
    console.log(`Downloading component: ${componentName}`);
    const pathSegments = componentName.split('/');
    const sourcePath = path.join(this.cacheDir, '.repo-cache', 'src', 'components', ...pathSegments);
    const targetPath = path.join(outputDir, ...pathSegments);

    // Ensure source exists
    if (!await fs.pathExists(sourcePath)) {
      throw new Error(`Component ${componentName} not found in repository`);
    }

    // Create target directory
    await fs.ensureDir(path.dirname(targetPath));

    // Copy component files
    await fs.copy(sourcePath, targetPath, {
      filter: (src) => {
        const basename = path.basename(src);
        // Include test files but exclude stories and other non-essential files
        return !basename.startsWith('.') && 
               !basename.includes('node_modules') && 
               !basename.includes('.stories.') &&
               !basename.includes('.mdx');
      }
    });

    // Analyze dependencies
    const { components: dependencies, sharedFiles } = await this.dependencyAnalysisService.analyzeDependencies(targetPath);

    // Update import paths in all files
    const files = await this.findAllFiles(targetPath);
    for (const file of files) {
      await this.updateImportPaths(file, componentName);
    }

    // Download component dependencies (other components)
    const downloadedDependencies = [];
    for (const dependency of dependencies) {
      try {
        // If the dependency is a relative path, resolve it
        const dependencyPath = dependency.startsWith('.')
          ? path.resolve(path.dirname(componentName), dependency)
          : dependency;

        // Download the dependency
        const sourceDependencyPath = path.join(this.cacheDir, '.repo-cache', 'src', 'components', dependencyPath);
        const targetDependencyPath = path.join(outputDir, dependencyPath);

        // Ensure source exists
        if (!await fs.pathExists(sourceDependencyPath)) {
          console.error(`Dependency ${dependencyPath} not found in repository`);
          continue;
        }

        // Create target directory
        await fs.ensureDir(path.dirname(targetDependencyPath));

        // Copy component files
        await fs.copy(sourceDependencyPath, targetDependencyPath, {
          filter: (src) => {
            const basename = path.basename(src);
            // Include test files but exclude stories and other non-essential files
            return !basename.startsWith('.') && 
                   !basename.includes('node_modules') && 
                   !basename.includes('.stories.') &&
                   !basename.includes('.mdx');
          }
        });

        // Update import paths in dependency files
        const dependencyFiles = await this.findAllFiles(targetDependencyPath);
        for (const file of dependencyFiles) {
          await this.updateImportPaths(file, dependencyPath);
        }

        downloadedDependencies.push(dependencyPath);
      } catch (error) {
        console.error(`Failed to download dependency ${dependency}:`, error);
      }
    }

    // Copy shared file dependencies (e.g., common utilities)
    const projectRoot = path.dirname(outputDir); // root directory where components lives

    for (const sharedRelPath of sharedFiles) {
      try {
        // Attempt to locate the shared path (could be a directory or single file)
        let sourceSharedPath: string | null = null;

        const baseSharedPath = path.join(this.cacheDir, '.repo-cache', 'src', sharedRelPath);

        if (await fs.pathExists(baseSharedPath)) {
          sourceSharedPath = baseSharedPath;
        } else {
          // Try file variants (Foo.tsx, Foo.ts, Foo.jsx, Foo.js)
          const exts = ['.tsx', '.ts', '.jsx', '.js'];
          for (const ext of exts) {
            const candidate = baseSharedPath + ext;
            if (await fs.pathExists(candidate)) {
              sourceSharedPath = candidate;
              break;
            }
          }

          // Try index variants inside directory (Foo/index.tsx ...)
          if (!sourceSharedPath) {
            for (const ext of exts) {
              const candidate = path.join(baseSharedPath, `index${ext}`);
              if (await fs.pathExists(candidate)) {
                sourceSharedPath = path.join(baseSharedPath, `index${ext}`);
                break;
              }
            }
          }
        }

        if (!sourceSharedPath) {
          console.error(`Shared dependency ${sharedRelPath} not found in repository`);
          continue;
        }

        // Determine relative path from src root to mimic structure when copying out
        const relativeFromSrc = path.relative(path.join(this.cacheDir, '.repo-cache', 'src'), sourceSharedPath);
        const targetSharedPath = path.join(projectRoot, relativeFromSrc);

        // Ensure target dir exists
        await fs.ensureDir(path.dirname(targetSharedPath));

        // Copy directory or file depending on what we found
        const stat = await fs.stat(sourceSharedPath);
        if (stat.isDirectory()) {
          await fs.copy(sourceSharedPath, targetSharedPath, {
            filter: (src) => {
              const basename = path.basename(src);
              return !basename.startsWith('.') && !basename.includes('node_modules') && !basename.includes('.stories.') && !basename.includes('.mdx');
            }
          });
        } else {
          await fs.copy(sourceSharedPath, targetSharedPath);
        }
      } catch (err) {
        console.error(`Failed to download shared dependency ${sharedRelPath}:`, err);
      }
    }

    return {
      extractedPath: targetPath,
      dependencies: downloadedDependencies
    };
  }

  private async findAllFiles(dir: string): Promise<string[]> {
    const files: string[] = [];
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...await this.findAllFiles(fullPath));
      } else if (entry.isFile() && /\.(tsx?|jsx?)$/.test(entry.name)) {
        files.push(fullPath);
      }
    }

    return files;
  }

  private async updateImportPaths(filePath: string, componentName: string): Promise<void> {
    const content = await fs.readFile(filePath, 'utf-8');
    const updatedContent = this.importPathService.updateImportPaths(content, componentName);
    await fs.writeFile(filePath, updatedContent);
  }
} 