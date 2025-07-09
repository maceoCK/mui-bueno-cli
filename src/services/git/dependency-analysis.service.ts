import fs from 'fs-extra';
import path from 'path';

interface Dependencies {
  components: string[];
  sharedFiles: string[];
}

export class DependencyAnalysisService {
  constructor() {}

  async analyzeDependencies(componentPath: string): Promise<Dependencies> {
    console.log('Analyzing dependencies for:', componentPath);
    const dependencies: Dependencies = {
      components: [],
      sharedFiles: []
    };

    // Find all TypeScript/JavaScript files in the component directory
    const files = await this.findAllFiles(componentPath);
    console.log('Found files:', files);

    // Get the base component path (e.g., Form/Error)
    const baseComponentPath = path.relative(path.join(process.cwd(), 'components'), componentPath);
    console.log('Base component path:', baseComponentPath);

    // Get the parent directory path (e.g., Form)
    const parentDir = path.dirname(baseComponentPath);
    console.log('Parent directory:', parentDir);

    for (const file of files) {
      console.log('Analyzing file:', file);
      const content = await fs.readFile(file, 'utf-8');
      const imports = this.extractLocalImports(content);
      console.log('Found imports:', imports);

      for (const importPath of imports) {
        // Skip imports from the same directory
        if (importPath.startsWith('./')) {
          console.log('Skipping same-directory import:', importPath);
          continue;
        }

        // Handle relative imports
        if (importPath.startsWith('../')) {
          // Get the absolute path of the import relative to the components directory
          const absolutePath = path.resolve(path.dirname(file), importPath);
          const relativeToComponents = path.relative(
            path.join(process.cwd(), 'components'),
            absolutePath
          );
          console.log('Relative to components:', relativeToComponents);

          // If this is a component import (not going outside the components directory)
          if (!relativeToComponents.startsWith('..')) {
            // Remove file extension and normalize path
            let componentName = relativeToComponents.replace(/\.(tsx?|jsx?)$/, '');

            // Normalize the path so it points to the component *directory* rather than the specific file
            // Common pattern: components follow `<Component>/<Component>.tsx` so an import like `../Button/Button` resolves
            // to `Buttons/Button/Button`. We want `Buttons/Button`.
            const componentParts = componentName.split(path.sep);

            // Remove trailing 'index' (e.g., Foo/index -> Foo)
            if (componentParts[componentParts.length - 1] === 'index') {
              componentParts.pop();
            }

            // If last segment is the same as the previous (e.g., Button/Button), drop it
            if (
              componentParts.length >= 2 &&
              componentParts[componentParts.length - 1] === componentParts[componentParts.length - 2]
            ) {
              componentParts.pop();
            }

            componentName = componentParts.join('/');
            console.log('Normalized component dependency:', componentName);

            // For any relative import inside components, treat as component dependency
            if (!dependencies.components.includes(componentName)) {
              dependencies.components.push(componentName);
            }
          } else {
            // This is a shared file dependency located outside the components directory.
            // Determine the path relative to the workspace root so we can later resolve it
            // inside the cached repository ("src/<sharedPath>").

            // The workspace root is the directory where the CLI is executed (process.cwd()).
            const projectRoot = process.cwd();

            // Create a relative path from the workspace root to the imported file.
            // Example:
            //   absolutePath =   /workspace/common/Utils.ts
            //   projectRoot  =   /workspace
            //   => relative    =   common/Utils.ts
            const relativeToProject = path.relative(projectRoot, absolutePath);

            // Strip any leading "src/" segment because files are stored under <repo>/src/ in the cache.
            const withoutSrcPrefix = relativeToProject.replace(/^src[\/]/, '');

            // Remove the file extension so the download service can try multiple extensions when resolving.
            const sharedPath = withoutSrcPrefix.replace(/\.(tsx?|jsx?)$/, '');

            console.log('Found shared file dependency:', sharedPath);

            if (!dependencies.sharedFiles.includes(sharedPath)) {
              dependencies.sharedFiles.push(sharedPath);
            }
          }
        }
      }
    }

    // Remove self-references
    dependencies.components = dependencies.components.filter(dep => dep !== baseComponentPath);

    console.log('Final dependencies:', dependencies);
    return dependencies;
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

  private extractLocalImports(content: string): string[] {
    const imports: string[] = [];
    const importRegex = /from\s+['"](\.[^'"]+)['"]/g;
    let match;

    while ((match = importRegex.exec(content)) !== null) {
      const importPath = match[1];
      // Remove file extension if present
      const cleanPath = importPath.replace(/\.(tsx?|jsx?)$/, '');
      imports.push(cleanPath);
    }

    return imports;
  }

  // Removed isValidComponent heuristic; relying on path-based detection to avoid missing siblings
} 