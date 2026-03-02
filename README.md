## Lit Calendar

**Status: Very early stage, highly experimental, and not ready for production use.**

Calendar UI built with Lit.

### Prerequisites

- **Node.js**: Recommend the latest LTS version.
- **Package manager**: This repo is configured for **pnpm** (`packageManager` is `pnpm@10.15.0`).

If you don't have pnpm:

```bash
npm install -g pnpm
```

### Install dependencies

From the project root:

```bash
pnpm install
```

### Run the dev server

From the project root:

```bash
pnpm dev
```

This runs `turbo run dev`. Check the console output for the actual app URL (commonly `http://localhost:5173` or similar, depending on the app in the monorepo).

### Other useful scripts

- **Build**:

  ```bash
  pnpm build
  ```

- **Preview build**:

  ```bash
  pnpm preview
  ```

- **Lint**:

  ```bash
  pnpm lint
  ```

- **Format**:

  ```bash
  pnpm format
  ```

