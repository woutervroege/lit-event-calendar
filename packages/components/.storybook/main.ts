import type { StorybookConfig } from '@storybook/web-components-vite';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import tailwindcss from '@tailwindcss/vite';

function getAbsolutePath(value: string) {
  return dirname(fileURLToPath(import.meta.resolve(`${value}/package.json`)));
}

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: [
    getAbsolutePath('@chromatic-com/storybook'),
    getAbsolutePath('@storybook/addon-docs'),
    getAbsolutePath("@storybook/addon-a11y"),
    getAbsolutePath("@ljcl/storybook-addon-cssprops")
  ],
  framework: getAbsolutePath('@storybook/web-components-vite'),
  async viteFinal(config) {
    return {
      ...config,
      server: {
        ...(config.server ?? {}),
        hmr: false,
      },
      plugins: [...(config.plugins ?? []), tailwindcss()],
    };
  },
};
export default config;