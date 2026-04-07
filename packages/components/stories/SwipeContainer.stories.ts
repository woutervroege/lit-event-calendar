import type { Meta, StoryObj } from "@storybook/web-components-vite";
import "../src/SwipeContainer/SwipeContainer.js";

type StorySwipeContainer = HTMLElement & {
  currentIndex: number;
  scrollSnapStop: "always" | "normal";
  dir: string;
  disabled: boolean;
};

type StoryArgs = {
  currentIndex: number;
  scrollSnapStop: "always" | "normal";
  dir: "ltr" | "rtl";
};

const pageColors = ["#f8fafc", "#f1f5f9", "#e2e8f0", "#cbd5e1"];

const createPage = (label: string, description: string, color: string): HTMLElement => {
  const page = document.createElement("section");
  page.style.boxSizing = "border-box";
  page.style.padding = "1rem";
  page.style.height = "100%";
  page.style.background = color;
  page.style.border = "1px solid #cbd5e1";
  page.style.borderRadius = "0.75rem";
  page.style.display = "flex";
  page.style.flexDirection = "column";
  page.style.gap = "0.5rem";
  page.style.alignItems = "flex-start";
  page.style.justifyContent = "center";

  const heading = document.createElement("h3");
  heading.textContent = label;
  heading.style.margin = "0";
  heading.style.fontSize = "1rem";
  heading.style.fontWeight = "700";
  heading.style.color = "#0f172a";

  const body = document.createElement("p");
  body.textContent = description;
  body.style.margin = "0";
  body.style.fontSize = "0.875rem";
  body.style.color = "#334155";

  page.append(heading, body);
  return page;
};

const meta: Meta<StoryArgs> = {
  title: "UI/SwipeContainer",
  component: "swipe-container",
  tags: ["autodocs"],
  argTypes: {
    currentIndex: { control: { type: "number", min: 0, max: 3, step: 1 } },
    scrollSnapStop: {
      control: "inline-radio",
      options: ["normal", "always"],
    },
    dir: {
      control: "inline-radio",
      options: ["ltr", "rtl"],
    },
  },
  args: {
    currentIndex: 0,
    scrollSnapStop: "normal",
    dir: "ltr",
  },
  render: (args) => {
    const el = document.createElement("swipe-container") as StorySwipeContainer;
    el.style.display = "block";
    el.style.width = "100%";
    el.style.height = "18rem";
    el.style.border = "1px solid #e2e8f0";
    el.style.borderRadius = "0.75rem";

    el.currentIndex = typeof args.currentIndex === "number" ? args.currentIndex : 0;
    el.scrollSnapStop = args.scrollSnapStop ?? "normal";
    el.dir = args.dir ?? "ltr";

    const pages = [
      createPage("Page 1", "Swipe horizontally to move between pages.", pageColors[0]),
      createPage("Page 2", "This element keeps vertical scrolling available.", pageColors[1]),
      createPage("Page 3", "Use currentIndex in controls to jump directly.", pageColors[2]),
      createPage("Page 4", "Set dir=rtl to test reverse swipe direction.", pageColors[3]),
    ];

    pages.forEach((page) => {
      el.append(page);
    });
    return el;
  },
};

export default meta;

type Story = StoryObj<StoryArgs>;

export const Default: Story = {};

export const StartOnSecondPage: Story = {
  args: {
    currentIndex: 1,
  },
};

export const SnapStopAlways: Story = {
  args: {
    scrollSnapStop: "always",
  },
};

export const RightToLeft: Story = {
  args: {
    dir: "rtl",
  },
};

export const VirtualColumnsSingleChild: Story = {
  args: {
    currentIndex: 0,
    scrollSnapStop: "normal",
    dir: "ltr",
  },
  render: (args) => {
    const el = document.createElement("swipe-container") as StorySwipeContainer;
    el.style.display = "block";
    el.style.width = "100%";
    el.style.height = "18rem";
    el.style.border = "1px solid #e2e8f0";
    el.style.borderRadius = "0.75rem";
    el.style.setProperty("--column-width", "14rem");

    el.currentIndex = typeof args.currentIndex === "number" ? args.currentIndex : 0;
    el.scrollSnapStop = args.scrollSnapStop ?? "normal";
    el.dir = args.dir ?? "ltr";

    const timeline = document.createElement("section");
    timeline.style.height = "100%";
    timeline.style.width = "112rem";
    timeline.style.flex = "0 0 auto";
    timeline.style.boxSizing = "border-box";
    timeline.style.padding = "1rem";
    timeline.style.borderRadius = "0.75rem";
    timeline.style.border = "1px solid #cbd5e1";
    timeline.style.background =
      "repeating-linear-gradient(90deg, #e2e8f0 0, #e2e8f0 1px, #f8fafc 1px, #f8fafc calc(14rem - 1px))";
    timeline.style.display = "flex";
    timeline.style.alignItems = "flex-start";

    const label = document.createElement("p");
    label.textContent =
      "Single wide child. Swipe snaps in 14rem virtual columns via --column-width.";
    label.style.margin = "0";
    label.style.fontSize = "0.875rem";
    label.style.color = "#0f172a";
    label.style.background = "rgba(255, 255, 255, 0.85)";
    label.style.padding = "0.25rem 0.5rem";
    label.style.borderRadius = "0.375rem";
    label.style.position = "sticky";
    label.style.top = "0";
    label.style.left = "0";

    timeline.append(label);
    el.append(timeline);
    return el;
  },
};
