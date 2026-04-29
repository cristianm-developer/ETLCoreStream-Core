# Collaboration Guidelines

Welcome! We're excited that you're interested in contributing to the **react-import-sheet** project. This document outlines the guidelines and best practices for collaborating with us.

## 🎯 How to Contribute

We welcome contributions in the following areas:

### 1. **Bug Reports**
- Have you found a bug? Please report it by creating an issue with:
  - A clear description of the problem
  - Steps to reproduce the issue
  - Expected vs. actual behavior
  - Environment details (Node version, OS, etc.)

### 2. **Feature Expansion**
- Want to add new functionality? Great!
- Before starting, please open an issue or discussion to:
  - Describe the feature
  - Discuss the implementation approach
  - Align with project goals

### 3. **Module Creation**
- Creating specialized modules? We encourage it!
- These can extend the core functionality without modifying the existing codebase

### 4. **Forks for Specialization**
- Want to create a specialized variant?
- Feel free to fork the repository and customize it for your use case
- If your fork becomes useful for the community, let us know!

---

## 📋 Contributing to the Main Repository

If your contribution directly impacts **this repository**, please follow these guidelines:

### Unit Tests (Required)

- **All new code must include comprehensive unit tests**
- Test files should follow the naming convention: `*.test.ts`
- Use the project's testing setup (Vitest)
- Aim for reasonable code coverage of your changes
- Tests should cover:
  - Happy path scenarios
  - Edge cases
  - Error handling

Example command:
```bash
npm test
```

### Backward Compatibility

- **Do not break the existing API** without a valid justification
- If you must introduce breaking changes:
  - Document them clearly in the PR
  - Provide migration guides
  - Consider deprecation periods

**Important:** Even when refactoring or updating code, ensure that:
- Existing code using the previous API continues to work without crashes
- Deprecations are handled gracefully
- Users have a clear migration path

### Testing Checklist

Before submitting your PR, verify that:

- [ ] All new code is covered by unit tests
- [ ] Run `npm test` locally and ensure **all tests pass**
- [ ] Existing tests continue to pass without failures
- [ ] No regressions are introduced in core functionality
- [ ] Your changes don't break the build (`npm run build`)

### Code Style & Structure

- Follow the existing code style in the project
- Use TypeScript for type safety
- Write clear, maintainable code with meaningful variable/function names
- Add comments for complex logic (when the intent isn't obvious from the code)

---

## 🔄 Pull Request Process

1. **Fork or branch** from the main repository
2. **Create a feature branch** with a descriptive name (e.g., `feat/csv-export` or `fix/orchestrator-crash`)
3. **Make your changes** following the guidelines above
4. **Test thoroughly** - run the full test suite locally
5. **Commit with clear messages** that describe what and why
6. **Push to your branch** and create a pull request
7. **Describe your changes** clearly in the PR description, including:
   - What problem does this solve?
   - How does it work?
   - Any breaking changes?
   - Testing you've done

---

## 📚 Project Structure

The project is organized as follows:

```
react-import-sheet/
├── src/
│   ├── core/              # Core functionality (orchestrator, viewer, logger, etc.)
│   └── ...
├── dist/                  # Built output
├── package.json           # Dependencies and scripts
└── vite.config.ts         # Build configuration
```

### Key Technologies

- **xstate**: State machine management
- **Preact Signals**: Reactive state management
- **RxJS**: Reactive programming utilities
- **Vitest**: Unit testing framework
- **Vite**: Build tool
- **TypeScript**: Type safety

---

## ❓ Questions or Need Help?

- Open a discussion or issue on the repository
- Check existing issues before creating a new one
- Be respectful and constructive in all communications

---

## 📄 License

By contributing to this project, you agree that your contributions will be licensed under the same license as the project (ISC).

---

## 🙏 Thank You!

We appreciate your interest in contributing to **react-import-sheet**. Your efforts help make this project better for everyone. Happy coding!
