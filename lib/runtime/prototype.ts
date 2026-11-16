import { resolveDeployment } from "./data-mode";

export const PROTOTYPE_COOKIE = "casevex-prototype";
export type CookieReader = {
  get(name: string): { value: string } | undefined;
};

/** Explicit, per-browser sample mode; never available on a pilot deployment. */
export function allowPrototype(env = process.env) {
  return resolveDeployment(env) !== "pilot";
}

export function isPrototypeSession(store: CookieReader, env = process.env) {
  return allowPrototype(env) && store.get(PROTOTYPE_COOKIE)?.value === "on";
}
