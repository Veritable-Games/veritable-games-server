# Contributing to Veritable Games Site

This is a private repository maintained by Veritable Games. These guidelines are for internal team members.

## Development Workflow

### Branch Strategy

- `main` - Production-ready code
- `develop` - Integration branch for features
- `feature/*` - Feature development branches
- `hotfix/*` - Emergency production fixes

### Commit Messages

Follow conventional commit format:

```
type(scope): description

[optional body]

[optional footer]
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, missing semicolons, etc.)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Test additions or corrections
- `build`: Build system changes
- `ci`: CI configuration changes
- `chore`: Maintenance tasks

### Pull Request Process

1. Create feature branch from `develop`
2. Make changes following code standards
3. Run tests and linting: `npm test && npm run lint`
4. Update documentation if needed
5. Create pull request with clear description
6. Ensure all CI checks pass
7. Request review from team members
8. Merge after approval

## Code Standards

### TypeScript

- Use strict mode
- Provide explicit types for function parameters and returns
- Use interfaces over type aliases where appropriate
- Avoid `any` type

### React Components

- Use functional components with hooks
- Follow naming conventions (PascalCase for components)
- Keep components focused and single-purpose
- Extract reusable logic into custom hooks

### Security

- Never commit secrets or credentials
- Use environment variables for configuration
- Validate all user inputs with Zod schemas
- Use prepared statements for database queries
- Sanitize user content with DOMPurify

### Performance

- Use React.memo for expensive components
- Implement lazy loading for routes
- Optimize images (AVIF/WebP formats)
- Monitor bundle size impact

### Testing

- Write tests for new features
- Maintain test coverage above 70%
- Use descriptive test names
- Mock external dependencies

## Database Changes

1. Create migration script in `scripts/migrations/`
2. Test migration on development database
3. Document schema changes
4. Update TypeScript types if needed

## Documentation

- Update README.md for significant changes
- Document API endpoints
- Add JSDoc comments for complex functions
- Keep CLAUDE.md updated for AI assistance

## Review Checklist

Before submitting PR, ensure:

- [ ] Code follows style guidelines
- [ ] Tests pass locally
- [ ] No TypeScript errors
- [ ] No ESLint warnings
- [ ] Documentation updated
- [ ] No sensitive data exposed
- [ ] Performance impact considered
- [ ] Security implications reviewed

## Getting Help

For questions or assistance:
- Check existing documentation
- Review similar code patterns
- Contact team lead
- Use internal communication channels

## License

This is proprietary software. All rights reserved by Veritable Games.