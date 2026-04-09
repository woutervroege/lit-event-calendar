import { createContext } from "@lit/context";
import type {
  AddExceptionInput,
  AddExclusionInput,
  ApplyResult,
  CreateInput,
  EventOperation,
  EventsAPI,
  EventsState,
  MoveInput,
  RemoveExceptionInput,
  RemoveExclusionInput,
  RemoveInput,
  ResizeEndInput,
  ResizeStartInput,
  UpdateInput,
} from "@lit-calendar/events-api";

export type EventsAPIContextValue = {
  getState: () => EventsState;
  apply: (operation: EventOperation) => ApplyResult;
  getApi: () => EventsAPI;
  create: (input: CreateInput) => ApplyResult;
  update: (input: UpdateInput) => ApplyResult;
  move: (input: MoveInput) => ApplyResult;
  resizeStart: (input: ResizeStartInput) => ApplyResult;
  resizeEnd: (input: ResizeEndInput) => ApplyResult;
  remove: (input: RemoveInput) => ApplyResult;
  addExclusion: (input: AddExclusionInput) => ApplyResult;
  removeExclusion: (input: RemoveExclusionInput) => ApplyResult;
  addException: (input: AddExceptionInput) => ApplyResult;
  removeException: (input: RemoveExceptionInput) => ApplyResult;
};

export const eventsAPIContext = createContext<EventsAPIContextValue>(Symbol("events-api-context"));
