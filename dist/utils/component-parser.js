"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ComponentParser = void 0;
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const glob_1 = require("glob");
const crypto_1 = __importDefault(require("crypto"));
class ComponentParser {
    async parseComponent(componentPath, name) {
        const files = await this.getComponentFiles(componentPath);
        const metadata = await this.extractMetadata(files, componentPath);
        const dependencies = await this.extractDependencies(files);
        const peerDependencies = await this.extractPeerDependencies(componentPath);
        return {
            name,
            version: this.generateVersion(),
            files,
            metadata,
            dependencies,
            peerDependencies
        };
    }
    async getComponentFiles(componentPath) {
        const pattern = path_1.default.join(componentPath, '**/*');
        const filePaths = await (0, glob_1.glob)(pattern, {
            ignore: ['**/node_modules/**', '**/dist/**', '**/.git/**'],
            nodir: true
        });
        const files = [];
        for (const filePath of filePaths) {
            const content = await fs_extra_1.default.readFile(filePath, 'utf8');
            const relativePath = path_1.default.relative(componentPath, filePath);
            const type = this.getFileType(filePath);
            files.push({
                path: relativePath,
                content,
                type
            });
        }
        return files;
    }
    getFileType(filePath) {
        const ext = path_1.default.extname(filePath).toLowerCase();
        const basename = path_1.default.basename(filePath, ext).toLowerCase();
        if (basename.includes('.stories'))
            return 'stories';
        if (basename.includes('.test') || basename.includes('.spec'))
            return 'test';
        switch (ext) {
            case '.tsx': return 'tsx';
            case '.ts': return 'ts';
            case '.scss': return 'scss';
            case '.css': return 'css';
            case '.json': return 'json';
            case '.md': return 'md';
            default: return 'ts';
        }
    }
    async extractMetadata(files, componentPath) {
        const mainFile = files.find(f => f.type === 'tsx' && !f.path.includes('.stories') && !f.path.includes('.test'));
        const props = mainFile ? await this.extractProps(mainFile.content) : [];
        const exports = await this.extractExports(files);
        const totalSize = files.reduce((sum, file) => sum + Buffer.byteLength(file.content, 'utf8'), 0);
        const checksum = this.generateChecksum(files);
        return {
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            size: totalSize,
            checksum,
            exports,
            props
        };
    }
    async extractProps(content) {
        const props = [];
        // Basic regex patterns to extract prop types from TypeScript interfaces
        // This is a simplified implementation - in production, you might want to use TypeScript compiler API
        const interfacePattern = /interface\s+(\w+Props)\s*{([^}]+)}/g;
        const typePattern = /type\s+(\w+Props)\s*=\s*{([^}]+)}/g;
        let match;
        // Extract from interfaces
        while ((match = interfacePattern.exec(content)) !== null) {
            const propsContent = match[2];
            const extractedProps = this.parsePropsFromTypeDefinition(propsContent);
            props.push(...extractedProps);
        }
        // Extract from type definitions
        while ((match = typePattern.exec(content)) !== null) {
            const propsContent = match[2];
            const extractedProps = this.parsePropsFromTypeDefinition(propsContent);
            props.push(...extractedProps);
        }
        return props;
    }
    parsePropsFromTypeDefinition(propsContent) {
        const props = [];
        const propPattern = /(\w+)\??\s*:\s*([^;,\n]+)(?:\s*\/\*\*\s*([^*]+)\s*\*\/)?/g;
        let match;
        while ((match = propPattern.exec(propsContent)) !== null) {
            const [, name, type, description] = match;
            const required = !name.includes('?');
            props.push({
                name: name.replace('?', ''),
                type: type.trim(),
                required,
                description: description?.trim()
            });
        }
        return props;
    }
    async extractExports(files) {
        const exports = [];
        for (const file of files) {
            if (file.type === 'tsx' || file.type === 'ts') {
                const exportPattern = /export\s+(?:const|function|class|interface|type)\s+(\w+)/g;
                let match;
                while ((match = exportPattern.exec(file.content)) !== null) {
                    const exportName = match[1];
                    if (!exports.includes(exportName)) {
                        exports.push(exportName);
                    }
                }
            }
        }
        return exports;
    }
    async extractDependencies(files) {
        const dependencies = {};
        for (const file of files) {
            if (file.type === 'tsx' || file.type === 'ts') {
                const importPattern = /import\s+.*?from\s+['"]([^'"]+)['"]/g;
                let match;
                while ((match = importPattern.exec(file.content)) !== null) {
                    const importPath = match[1];
                    // Only include external dependencies (not relative imports)
                    if (!importPath.startsWith('./') && !importPath.startsWith('../')) {
                        const packageName = this.extractPackageName(importPath);
                        if (packageName && !dependencies[packageName]) {
                            dependencies[packageName] = '*'; // Version would need to be resolved from package.json
                        }
                    }
                }
            }
        }
        return dependencies;
    }
    async extractPeerDependencies(componentPath) {
        const packageJsonPath = path_1.default.join(componentPath, '../../package.json');
        try {
            if (await fs_extra_1.default.pathExists(packageJsonPath)) {
                const packageJson = await fs_extra_1.default.readJson(packageJsonPath);
                return packageJson.peerDependencies || {};
            }
        }
        catch (error) {
            console.warn('Could not read package.json for peer dependencies:', error);
        }
        return {};
    }
    extractPackageName(importPath) {
        // Handle scoped packages like @mui/material
        if (importPath.startsWith('@')) {
            const parts = importPath.split('/');
            return parts.slice(0, 2).join('/');
        }
        // Handle regular packages
        const parts = importPath.split('/');
        return parts[0];
    }
    generateChecksum(files) {
        const content = files
            .sort((a, b) => a.path.localeCompare(b.path))
            .map(f => `${f.path}:${f.content}`)
            .join('');
        return crypto_1.default.createHash('sha256').update(content).digest('hex');
    }
    generateVersion() {
        const now = new Date();
        const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
        return `1.0.0-${timestamp}`;
    }
    async validateComponent(component) {
        const errors = [];
        if (!component.name || component.name.trim() === '') {
            errors.push('Component name is required');
        }
        if (!component.version || component.version.trim() === '') {
            errors.push('Component version is required');
        }
        if (!component.files || component.files.length === 0) {
            errors.push('Component must have at least one file');
        }
        // Check for main component file
        const hasMainFile = component.files.some(f => f.type === 'tsx' && !f.path.includes('.stories') && !f.path.includes('.test'));
        if (!hasMainFile) {
            errors.push('Component must have a main .tsx file');
        }
        return {
            valid: errors.length === 0,
            errors
        };
    }
}
exports.ComponentParser = ComponentParser;
//# sourceMappingURL=component-parser.js.map