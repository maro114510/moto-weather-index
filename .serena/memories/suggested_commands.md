# Suggested Commands for Development

## Essential Development Commands

### Testing
```bash
# Run all tests
bun test

# Run specific test file
bun test src/utils/dateUtils.test.ts
bun test src/usecase/BatchCalculateTouringIndex.test.ts

# Test with watch mode during development
bun test --watch
```

### Development Servers
```bash
# Local development server with hot reload
task dev
# Alternative: bun --hot src/index.ts

# Cloudflare Workers development server
task wrangler:dev
```

### Code Quality (Run after all changes)
```bash
# Fix formatting and lint issues automatically
task lint:fix

# Check linting without fixing
task lint

# Format code
task format

# Verify all tests pass
task test
```

### Deployment
```bash
# Login to Cloudflare
task wrangler:login

# Deploy to production
task wrangler:deploy
```

## System Commands (Darwin/macOS)
```bash
# File operations
ls          # List files
find        # Find files
grep        # Search in files
cat         # Display file contents
cd          # Change directory

# Git operations
git status
git diff
git add
git commit
git push
```

## Package Management
```bash
# Install dependencies
bun install

# Add dependencies
bun add <package-name>

# Add dev dependencies
bun add -d <package-name>
```