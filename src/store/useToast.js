import { useSyncExternalStore } from "react";

let state = null; // { type: "success" | "error", message: string, id: number } | null
const listeners = new Set();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l) => (listeners.add(l), () => listeners.delete(l));
const getSnapshot = () => state;

let timer = null;

export function showToast(type, message, duration = 3500) {
  state = { type, message, id: Date.now() };
  emit();
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    state = null;
    emit();
  }, duration);
}

export function useToast() {
  return useSyncExternalStore(subscribe, getSnapshot);
}
