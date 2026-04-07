import type { Meta, StoryObj } from "@storybook/web-components-vite";
import "../src/Button/Button.js";

const meta: Meta = {
  title: "UI/Button",
  component: "lc-button",
  tags: ["autodocs"],
  argTypes: {
    disabled: { control: "boolean" },
    compact: { control: "boolean" },
    type: { control: "text" },
    label: { control: "text" },
    hotkey: { control: "text" },
  },
  args: {
    disabled: false,
    compact: false,
    type: "button",
    label: "",
    hotkey: "",
  },
  render: (args) => {
    const el = document.createElement("lc-button") as HTMLElement & {
      disabled: boolean;
      compact: boolean;
      type: "button" | "submit" | "reset";
      label: string;
      hotkey: string;
    };

    el.disabled = args.disabled ?? false;
    el.compact = args.compact ?? false;
    el.type = args.type ?? "button";
    el.label = args.label ?? "";
    el.hotkey = args.hotkey ?? "";
    el.textContent = "Action";
    return el;
  },
};

export default meta;

type Story = StoryObj;

export const Default: Story = {};

export const Disabled: Story = {
  args: {
    disabled: true,
  },
};

export const WithHotkey: Story = {
  args: {
    label: "Action",
    hotkey: "a",
  },
};
