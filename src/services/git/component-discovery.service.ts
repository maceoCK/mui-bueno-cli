import fs from 'fs-extra';
import path from 'path';
import { ComponentInfo } from '../../types/index.js';

export class ComponentDiscoveryService {
  constructor(private cacheDir: string) {}

  async listComponents(): Promise<ComponentInfo[]> {
    const componentsPath = path.join(this.cacheDir, '.repo-cache', 'src', 'components');
    const components: ComponentInfo[] = [];

    try {
      await this.findComponentsRecursively(componentsPath, '', components);
    } catch (error) {
      console.warn(`Warning: Could not list components: ${error}`);
    }

    return components;
  }

  private async findComponentsRecursively(basePath: string, relativePath: string, components: ComponentInfo[]): Promise<void> {
    const entries = await fs.readdir(basePath, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const fullPath = path.join(basePath, entry.name);
        const componentPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;

        // Check if this directory contains a component file
        const files = await fs.readdir(fullPath);
        const hasComponentFile = files.some(file => 
          file.endsWith('.tsx') && !file.includes('.stories.') && !file.includes('.test.')
        );

        if (hasComponentFile) {
          const componentInfo = await this.getComponentInfo(fullPath, componentPath);
          components.push(componentInfo);
        }

        // Recursively search subdirectories
        await this.findComponentsRecursively(fullPath, componentPath, components);
      }
    }
  }

  private async getComponentInfo(componentPath: string, name: string): Promise<ComponentInfo> {
    const files = await fs.readdir(componentPath);
    const versions: string[] = []; // In this simplified version, we don't track versions
    const branches: string[] = []; // In this simplified version, we don't track branches
    const tags: string[] = []; // In this simplified version, we don't track tags

    return {
      name,
      path: componentPath,
      versions,
      branches,
      tags
    };
  }
} 