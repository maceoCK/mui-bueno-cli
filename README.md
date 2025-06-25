# MUI Bueno CLI

A command-line tool for managing MUI Bueno components from a git repository via SSH.

## 🚀 Quick Start

Use with npx (no installation required):

```bash
npx mui-bueno-cli init
npx mui-bueno-cli list
npx mui-bueno-cli download Alert
```

Or install globally:

```bash
npm install -g mui-bueno-cli
mui-bueno init
```

## 📋 Prerequisites

- **Node.js 18+** 
- **SSH access** to the MUI Bueno component repository
- **Git** installed on your system

## 🔧 Setup

1. **Initialize the CLI** (sets up SSH git access):
   ```bash
   npx mui-bueno-cli init
   ```

2. **Configure your repository** (follow the prompts):
   - Git repository URL (SSH format)
   - Default branch
   - SSH key path (optional)
   - Download directory

## 📚 Commands

### `init`
Set up CLI with git repository access
```bash
npx mui-bueno-cli init [--install-deps] [--package-manager pnpm]
```

### `list`
Show available components
```bash
npx mui-bueno-cli list [--branch main] [--limit 50]
```

### `download`
Download components with version selection
```bash
# Interactive selection
npx mui-bueno-cli download

# Download specific component
npx mui-bueno-cli download ComponentName

# Download specific version
npx mui-bueno-cli download ComponentName --version v1.2.0
npx mui-bueno-cli download ComponentName --branch feature-branch
npx mui-bueno-cli download ComponentName --commit abc123

# Include additional files
npx mui-bueno-cli download ComponentName --include-tests --include-stories

# Install dependencies after download
npx mui-bueno-cli download ComponentName --install-deps --package-manager pnpm
```

### `search`
Search for components
```bash
npx mui-bueno-cli search button
npx mui-bueno-cli search alert --branch main
```

### `branches`
List available branches and tags
```bash
npx mui-bueno-cli branches
```

### `cache`
Manage local repository cache
```bash
npx mui-bueno-cli cache --clear
```

### `config`
Manage CLI configuration
```bash
npx mui-bueno-cli config --show
npx mui-bueno-cli config --reset
```

## 🔐 SSH Setup

Ensure you have SSH access to the repository:

1. **Test SSH connection:**
   ```bash
   ssh -T git@bitbucket.org              
   ```

2. **Add SSH key to your BitBucket account** if needed

3. **Specify custom SSH key** during init if required

## 📁 Component Structure

Downloaded components maintain their original structure:
```
components/
├── ComponentName/
│   ├── ComponentName.tsx
│   ├── ComponentName.stories.tsx (if --include-stories)
│   ├── ComponentName.test.tsx (if --include-tests)
│   └── ...other files
```

## 🎯 Features

- ✅ **SSH-based git access** for secure component management
- ✅ **Version navigation** (branches, tags, commits)
- ✅ **Interactive component selection** with search
- ✅ **Dependency analysis** and installation
- ✅ **Smart error messages** with suggestions
- ✅ **Local git caching** for performance
- ✅ **TypeScript support** out of the box

## 🛠 Development

```bash
# Clone and setup
git clone <your-repo-url>
cd mui-bueno-cli
npm install

# Development
npm run dev -- list
npm run build
npm test
```

## 📜 License

MIT

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 🐛 Issues

Report issues at: [GitHub Issues](https://github.com/maceoCK/mui-bueno-cli/issues) 