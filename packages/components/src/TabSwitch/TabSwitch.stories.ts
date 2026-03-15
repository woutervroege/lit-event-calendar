import type { Meta, StoryObj } from "@storybook/web-components-vite";
import "./TabSwitch.js";

const defaultOptions: string[] = ["Day", "Week", "Month", "Year"];

const meta: Meta = {
  title: "Shared/TabSwitch",
  component: "tab-switch",
  tags: ["autodocs"],
  argTypes: {
    options: { control: "object" },
    value: { control: "text" },
    name: { control: "text" },
  },
  args: {
    options: defaultOptions,
    value: defaultOptions[0],
  },
  render: (args) => {
    const el = document.createElement("tab-switch") as HTMLElement & {
      options: string[];
      value: string;
      name: string;
    };

    el.options = args.options ?? defaultOptions;
    el.value = args.value ?? defaultOptions[0];
    el.name = args.name ?? "";
    el.setAttribute("group-label", "View");
    return el;
  },
};

export default meta;

type Story = StoryObj;

export const Default: Story = {};

export const WithDisabledOption: Story = {
  args: {
    options: defaultOptions,
    value: defaultOptions[0],
  },
};
