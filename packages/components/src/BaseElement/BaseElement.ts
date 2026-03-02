import { LitElement, unsafeCSS } from "lit";
import style from "./styles.css?inline";

type PropertyDefinition = {
  observer?: (this: BaseElement, value: unknown) => void;
  [key: string]: unknown;
};

type PropertiesMap = Record<string, PropertyDefinition>;

interface BaseElementConstructor {
  properties?: PropertiesMap;
  observers?: Map<string, string[]>;
  new (): BaseElement;
}

export class BaseElement extends LitElement {
  #locale?: string;

  static get properties() {
    return {
      ...(super.properties ?? {}),
      locale: { type: String },
    } as any;
  }

  static get styles() {
    return [unsafeCSS(style)];
  }

  get locale(): string {
    return this.#locale || navigator.language;
  }

  set locale(locale: string) {
    this.#locale = locale;
  }

  updated(changedProperties: Map<string | number | symbol, unknown>) {
    super.updated(changedProperties);
    const Constructor = this.constructor as BaseElementConstructor;

    changedProperties.forEach((value: unknown, key: string | number | symbol) => {
      const property = String(key);

      Constructor.properties?.[property]?.observer?.call(this, value);

      Constructor.observers?.forEach((props: string[], methodName: string) => {
        if (props.includes(property)) {
          const method = (this as unknown as Record<string, () => void>)[methodName];
          method?.call(this);
        }
      });
    });
  }
}
