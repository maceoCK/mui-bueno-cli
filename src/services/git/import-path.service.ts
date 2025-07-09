import fs from 'fs-extra';
import path from 'path';

export class ImportPathService {
  constructor() {}

  updateImportPaths(content: string, componentName: string): string {
    // Update relative imports to components
    let updatedContent = content.replace(
      /from\s+['"]\.\.\/([^'"]+)['"]/g,
      (match, importPath) => {
        // If the import path is a component path, update it
        if (importPath.includes('/')) {
          return `from '../${importPath}'`;
        }
        return match;
      }
    );

    // Update relative imports to the same component
    updatedContent = updatedContent.replace(
      /from\s+['"]\.\/((?!components\/)[^'"]+)['"]/g,
      (match, importPath) => {
        // If the import is from the same component directory, keep it relative
        if (importPath.startsWith(componentName + '/')) {
          return `from './${importPath.substring(componentName.length + 1)}'`;
        }
        return match;
      }
    );

    return updatedContent;
  }

  async fixImportPaths(componentPath: string, componentName: string): Promise<void> {
    const files = await this.findAllFiles(componentPath);

    for (const file of files) {
      let content = await fs.readFile(file, 'utf-8');
      const imports = this.extractImports(content);

      for (const importPath of imports) {
        const newPath = this.calculateNewImportPath(importPath, componentName);
        if (newPath !== importPath) {
          content = this.replaceImportPath(content, importPath, newPath);
        }
      }

      await fs.writeFile(file, content);
    }
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

  private extractImports(content: string): string[] {
    const imports: string[] = [];
    const importRegex = /from\s+['"](\.[^'"]+)['"]/g;
    let match;

    while ((match = importRegex.exec(content)) !== null) {
      const importPath = match[1];
      imports.push(importPath);
    }

    return imports;
  }

  private calculateNewImportPath(importPath: string, componentName: string): string {
    // If the import path starts with '../components/', update it to be relative to the current component
    if (importPath.startsWith('../components/')) {
      const importedComponent = importPath.replace('../components/', '');
      const currentDepth = componentName.split('/').length;
      const prefix = '../'.repeat(currentDepth);
      return `${prefix}${importedComponent}`;
    }
    return importPath;
  }

  private replaceImportPath(content: string, oldPath: string, newPath: string): string {
    const escapedOldPath = oldPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const importRegex = new RegExp(`(from\\s+['"])${escapedOldPath}(['"])`, 'g');
    return content.replace(importRegex, `$1${newPath}$2`);
  }
} 