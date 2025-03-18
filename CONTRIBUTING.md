# Contributing to Class Navigator

Thank you for your interest in contributing to Class Navigator! This document outlines our contribution process and guidelines.

## Branch Protection Policy

The `main` branch is protected and does not allow direct commits. All changes must be made through pull requests:

1. Create a new feature branch from `main` or `develop`:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make your changes and commit them:
   ```bash
   git add .
   git commit -m "Description of your changes"
   ```

3. Push your branch to GitHub:
   ```bash
   git push -u origin feature/your-feature-name
   ```

4. Create a pull request through the GitHub interface.

5. Wait for code review and approval.

## Development Workflow

1. Always pull the latest changes before starting work:
   ```bash
   git checkout main
   git pull
   ```

2. Make sure your feature branch is up to date with main before submitting a PR:
   ```bash
   git checkout main
   git pull
   git checkout feature/your-feature-name
   git merge main
   ```

## Commit Guidelines

* Use clear, descriptive commit messages
* Start with a verb in the present tense (e.g., "Add feature" not "Added feature")
* Reference issue numbers in commits where applicable

## Code Style

This project uses ESLint and Prettier for code formatting and style checking. Make sure to run these tools before submitting:

```bash
npm run lint
npm run format
```

## Testing

All new features should include appropriate tests. Run the test suite with:

```bash
npm test
```

Thank you for contributing to Class Navigator!
