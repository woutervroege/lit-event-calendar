import type { Meta, StoryObj } from "@storybook/web-components-vite";
import "../src/Dropdown/Dropdown.js";
import type { DropdownOption } from "../src/types/Dropdown.js";

const defaultOptions: DropdownOption[] = [
  { label: "Day", value: "day", hotkey: "d" },
  { label: "Week", value: "week", hotkey: "w" },
  { label: "Month", value: "month", hotkey: "m" },
  { label: "Year", value: "year", hotkey: "y" },
];

const meta: Meta = {
  title: "Shared/Dropdown",
  component: "lc-dropdown",
  tags: ["autodocs"],
  argTypes: {
    options: { control: "object" },
    value: { control: "text" },
    name: { control: "text" },
    placeholder: { control: "text" },
    hotkey: { control: "text" },
    disabled: { control: "boolean" },
  },
  args: {
    options: defaultOptions,
    value: defaultOptions[2].value,
    placeholder: "Select a range",
    hotkey: "v",
    disabled: false,
  },
  render: (args) => {
    const el = document.createElement("lc-dropdown") as HTMLElement & {
      options: DropdownOption[];
      value: string;
      name: string;
      placeholder: string;
      hotkey: string;
      disabled: boolean;
    };

    el.options = args.options ?? defaultOptions;
    el.value = args.value ?? "";
    el.name = args.name ?? "";
    el.placeholder = args.placeholder ?? "Select an option";
    el.hotkey = args.hotkey ?? "";
    el.disabled = args.disabled ?? false;
    return el;
  },
};

export default meta;

type Story = StoryObj;

export const Default: Story = {};

export const Hotkeys: Story = {
  args: {
    options: defaultOptions,
    value: "month",
    hotkey: "v",
  },
  parameters: {
    docs: {
      description: {
        story: "Press `V` to focus the dropdown, then press `D`, `W`, `M`, or `Y` to select an option.",
      },
    },
  },
};

export const Placeholder: Story = {
  args: {
    value: "",
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
  },
};
