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
    color-scheme: light dark;
    background-color: var(--lg-background-color, light-dark(#fff, #222));
  }

  #storybook-root > * {
    padding: 1rem;
    max-width: calc(100dvw - 2rem);
    position: absolute;
  }
`;

const storybookViewportContent =
  "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0";

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    actions: {
      argTypesRegex: "^on.*",
      handles: ["event-create-requested", "event-update-requested", "event-delete-requested"],
    },
    layout: "fullscreen",
  },
  decorators: [
    (Story) => {
      let viewportMeta = document.querySelector('meta[name="viewport"]');
      if (!viewportMeta) {
        viewportMeta = document.createElement("meta");
        viewportMeta.setAttribute("name", "viewport");
        document.head.appendChild(viewportMeta);
      }
      viewportMeta.setAttribute("content", storybookViewportContent);

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
