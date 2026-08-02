import { useSyncExternalStore } from "react";

type NotificationStoreState = {
  unreadKitchen: number;
  unreadBilling: number;
};

let state: NotificationStoreState = {
  unreadKitchen: 0,
  unreadBilling: 0,
};

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

export const notificationStore = {
  getSnapshot() {
    return state;
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  incrementKitchen() {
    state = { ...state, unreadKitchen: state.unreadKitchen + 1 };
    notify();
  },
  incrementBilling() {
    state = { ...state, unreadBilling: state.unreadBilling + 1 };
    notify();
  },
  resetKitchen() {
    if (state.unreadKitchen !== 0) {
      state = { ...state, unreadKitchen: 0 };
      notify();
    }
  },
  resetBilling() {
    if (state.unreadBilling !== 0) {
      state = { ...state, unreadBilling: 0 };
      notify();
    }
  },
};

export function useNotificationStore() {
  const current = useSyncExternalStore(
    notificationStore.subscribe,
    notificationStore.getSnapshot,
    notificationStore.getSnapshot,
  );

  return {
    ...current,
    incrementKitchen: notificationStore.incrementKitchen,
    incrementBilling: notificationStore.incrementBilling,
    resetKitchen: notificationStore.resetKitchen,
    resetBilling: notificationStore.resetBilling,
  };
}
