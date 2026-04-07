import type { Meta, StoryObj } from "@storybook/web-components-vite";
import "../src/TabSwitch/TabSwitch.js";
import type { TabSwitchOption } from "../src/types/TabSwitch.js";

const defaultOptions: TabSwitchOption[] = [
  { label: "Day", value: "day", hotkey: "d" },
  { label: "Week", value: "week", hotkey: "w" },
  { label: "Month", value: "month", hotkey: "m" },
  { label: "Year", value: "year", hotkey: "y" },
];

const meta: Meta = {
  title: "UI/TabSwitch",
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
      options: TabSwitchOption[];
      value: string;
      name: string;
    };

    el.options = args.options ?? defaultOptions;
    el.value = args.value ?? defaultOptions[0].value;
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
