import type { EventChange } from "./change.js";
import type { DomainEffect } from "./effect.js";
import type { EventsState } from "./primitives.js";

export type ApplyResult = {
  nextState: EventsState;
  changes: EventChange[];
  effects: DomainEffect[];
};
