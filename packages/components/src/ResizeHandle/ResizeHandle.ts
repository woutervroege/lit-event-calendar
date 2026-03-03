import { html, unsafeCSS } from "lit";
import { customElement, property } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import { BaseElement } from "../BaseElement/BaseElement";
import componentStyle from "./ResizeHandle.css?inline";

@customElement("resize-handle")
export class ResizeHandle extends BaseElement {
  @property({ type: String })
  position = "";

  @property({ type: String, reflect: true })
  axis: "vertical" | "horizontal" = "vertical";

  static get styles() {
    return [...BaseElement.styles, unsafeCSS(componentStyle)];
  }

  render() {
    return html`
            <div
                class=${classMap(this.#classes)}
                aria-hidden="true"
            ></div>
        `;
  }

  get #classes() {
    return {
      "before:absolute": true,
      "before:inset-0": true,
      relative: true,
      "z-10": true,
      handle: true,
      "opacity-80": true,
      "transition-opacity": true,
      "duration-200": true,
      "ease-in-out": true,
      "hover:opacity-100": true,
      "w-full": this.axis === "vertical",
      "h-2": this.axis === "vertical",
      "cursor-ns-resize": this.axis === "vertical",
      "h-full": this.axis === "horizontal",
      "w-2": this.axis === "horizontal",
      "cursor-ew-resize": this.axis === "horizontal",
    };
  }
}
