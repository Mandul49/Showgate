import { useState } from "react";

type Toast = {
  id: string;
  title?: string;
  description?: string;
};

export function useToast() {
  const [toasts] = useState<Toast[]>([]);
  return { toasts, toast: (_: Omit<Toast, "id">) => {} };
}
