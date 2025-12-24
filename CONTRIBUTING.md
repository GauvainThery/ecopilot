# Contributing to EcoPilot

Thank you for your interest in contributing to EcoPilot! This document provides guidelines and information for contributors.

## Getting Started

### Prerequisites

- Node.js 18.x or higher
- Python 3.8 or higher
- VS Code 1.105.0 or higher
- Git

### Development Setup

1. **Fork and clone the repository**
   ```bash
   git clone https://github.com/your-username/ecopilot.git
   cd ecopilot
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up Python environment**
   ```bash
   python3 -m venv .venv
   .venv/bin/pip install ecologits
   ```

4. **Build the extension**
   ```bash
   npm run compile
   ```

5. **Run tests**
   ```bash
   npm test
   ```

6. **Start development**
   - Press `F5` in VS Code to launch the Extension Development Host
   - Make changes and test in the development instance


## Code Standards

### TypeScript/JavaScript

- Use TypeScript for all new code
- Follow the existing code style (enforced by Biome)
- Run `npm run lint` before committing
- Run `npm run format` to auto-format code
- Maintain strict type safety (no `any` types without justification)

### Architecture Principles

EcoPilot follows **Clean Architecture**:

```
📁 domain/       - Pure business logic, no dependencies
📁 application/  - Use cases and orchestration
📁 infrastructure/ - External services (EcoLogits, storage)
📁 adapters/     - VS Code API integration
📁 ui/          - User interface components
```

**Rules:**
- Domain layer has no external dependencies
- Dependencies point inward (domain ← application ← infrastructure/adapters)
- Use interfaces for provider contracts
- Keep business logic testable and framework-independent