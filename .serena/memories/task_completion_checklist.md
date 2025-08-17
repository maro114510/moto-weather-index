# Task Completion Checklist

## Always Run After Code Changes

### 1. Code Quality (Mandatory)
```bash
# Fix formatting and lint issues automatically
task lint:fix

# Verify linting passes
task lint
```

### 2. Testing (Mandatory)
```bash
# Verify all tests pass
task test
# Alternative: bun test
```

### 3. Type Checking (Implicit)
TypeScript checking is handled by:
- Bun runtime during development
- Biome linter for type-related issues
- Build process during deployment

## Additional Checks (When Relevant)

### For API Changes
- Test endpoints manually or with Swagger UI at `/doc`
- Verify OpenAPI spec generation at `/specification`
- Check backwards compatibility

### For Database Changes
- Verify D1 database migrations if applicable
- Test database operations in development

### For Cloudflare Workers
- Test with `task wrangler:dev` before deployment
- Verify environment variables are properly configured

## Deployment Checklist
1. All tests pass (`task test`)
2. Linting is clean (`task lint`)
3. Code is properly formatted (`task format`)
4. Local development server works (`task dev`)
5. Workers development server works (`task wrangler:dev`)
6. Ready for deployment (`task wrangler:deploy`)

## Git Workflow
1. Run task completion checklist
2. Stage changes: `git add .`
3. Commit with descriptive message: `git commit -m "..."`
4. Push changes: `git push`

## Important Notes
- Never commit without running `task lint:fix` and `task test`
- Use `task dev` for local Node.js/Bun development
- Use `task wrangler:dev` for Cloudflare Workers testing
- Both development servers should be tested before deployment