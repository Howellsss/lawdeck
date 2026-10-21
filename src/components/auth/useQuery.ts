"use client";

import { useSyncExternalStore } from "react";

// The page address (?next=… and ?error=…), read in the browser so sign-in forms never have to
// wait for the server or be swapped out while the student is typing.
const noSubscribe = () => () => {};

export function useQuery() {
  const search = useSyncExternalStore(noSubscribe, () => window.location.search, () => "");
  return new URLSearchParams(search);
}
