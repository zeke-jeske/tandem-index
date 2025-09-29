# Tandem Index

## Development

### Prerequisites

- Node.js (v20)
- Yarn

### Getting Started

1. Clone the repository.
2. Run `yarn` to install dependencies.
3. Run `yarn dev` to start the development server on [http://localhost:3000](http://localhost:3000).

### File Structure

Source files should be stored in the same directory as the code that uses them, unless
they are meant to be used in multiple places, in which case they should go in [`src/utils/`](./src/utils/) or
[`src/components/`](./src/components/). Every imported module should either consist of a single appropriately
named file, or an appropriately named directory containing an `index.ts` or `index.tsx` file.

- [`misc/`](./misc) - Miscellaneous files for testing, such as sample manuscripts
- [`public/`](./public) - Static assets like images and videos
- [`src/`](./src) - All TypeScript source code for the Next.js application
  - [`app/`](./src/app) - Main application code, including pages as well as components and utilities
    that are used by a single page
    - [`api/`](./src/app/api) - Next.js API route handlers
  - [`components/`](./src/components) - Reusable React components used across multiple pages
  - [`utils/`](./src/utils) - Shared utilities and helper functions
- [`.prettierignore`](./.prettierignore) and [`.prettierrc.json`](./.prettierrc.json) - Config files for Prettier
- [`eslint.config.mts`](./eslint.config.mts) - Config file for ESLint
- [`next.config.ts`](./next.config.ts) - Config file for Next.js
- [`postcss.config.mjs`](./postcss.config.mjs) - Config file for PostCSS
- [`tailwind.config.cjs`](./tailwind.config.cjs) - Config file for Tailwind CSS, including theme customizations

### NPM packages used by this project

| Package | Description |
|---------|-------------|
| [@anthropic-ai/sdk](https://www.npmjs.com/package/@anthropic-ai/sdk) | Official Anthropic SDK for integrating Claude AI API |
| [@tailwindcss/postcss](https://www.npmjs.com/package/@tailwindcss/postcss) | PostCSS plugin for Tailwind CSS |
| [classnames](https://www.npmjs.com/package/classnames) | Utility for conditionally joining CSS class names together |
| [mammoth](https://www.npmjs.com/package/mammoth) | Extract text (HTML) from uploaded Word manuscripts (.docx files) |
| [next](https://www.npmjs.com/package/next) | React framework with hybrid static & server rendering |
| [react](https://www.npmjs.com/package/react) | JavaScript library for building user interfaces |
| [react-dom](https://www.npmjs.com/package/react-dom) | Required for React |
| [uuid](https://www.npmjs.com/package/uuid) | Generate RFC-compliant UUIDs |
| [autoprefixer](https://www.npmjs.com/package/autoprefixer) | PostCSS plugin to parse CSS and add vendor prefixes. Used by Tailwind CSS. |
| [eslint](https://www.npmjs.com/package/eslint) | Pluggable JavaScript linter for identifying and fixing code issues |
| [globals](https://www.npmjs.com/package/globals) | Global identifiers from different JavaScript environments. Used for ESLint config. |
| [jiti](https://www.npmjs.com/package/jiti) | Required to use a TypeScript ESLint config file |
| [postcss](https://www.npmjs.com/package/postcss) | Tool for transforming CSS with JavaScript plugins. Required for Tailwind CSS. |
| [prettier](https://www.npmjs.com/package/prettier) | Opinionated code formatter for consistent code style |
| [tailwindcss](https://www.npmjs.com/package/tailwindcss) | Utility-first CSS framework for rapid UI development |

