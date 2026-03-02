import type { Preview } from "@storybook/web-components-vite";

const globalStyles = `
  html, body {
    margin: 0;
    padding: 0;
    height: 100%;
    text-rendering: optimizeLegibility;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
    color-scheme: light;
    background-color: light-dark(#fff, #222);
  }
  #storybook-root, #storybook-docs {
    height: 100%;
    min-height: 100vh;
  }
`;

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    layout: "padded",
  },
  decorators: [
    (Story) => {
      if (!document.getElementById("storybook-global-styles")) {
        const style = document.createElement("style");
        style.id = "storybook-global-styles";
        style.textContent = globalStyles;
        document.head.appendChild(style);
      }
      return Story();
    },
  ],
};

export default preview;
