import type { Meta, StoryObj } from "@storybook/web-components-vite";
import "./Button.js";

const meta: Meta = {
  title: "Shared/Button",
  component: "lc-button",
  tags: ["autodocs"],
  argTypes: {
    disabled: { control: "boolean" },
    type: { control: "text" },
    label: { control: "text" },
  },
  args: {
    disabled: false,
    type: "button",
    label: "",
  },
  render: (args) => {
    const el = document.createElement("lc-button") as HTMLElement & {
      disabled: boolean;
      type: "button" | "submit" | "reset";
      label: string;
    };

    el.disabled = args.disabled ?? false;
    el.type = args.type ?? "button";
    el.label = args.label ?? "";
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
