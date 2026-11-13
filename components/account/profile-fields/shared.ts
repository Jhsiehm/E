/* Helpers shared by the profile form pieces. */
import type { Profile } from "@/lib/account/profile";

export type Edit = { value: Profile; onChange: (p: Profile) => void };

export function toggle<T>(list: T[], item: T, max = Infinity) {
  if (list.includes(item)) return list.filter((x) => x !== item);
  return list.length >= max ? list : [...list, item];
}

export function move<T>(list: T[], i: number, by: number) {
  const j = i + by;
  if (j < 0 || j >= list.length) return list;
  const next = [...list];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

/** Sidebar order/visibility and dashboard cards, with a live sidebar preview. */
