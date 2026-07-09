// Lightweight event emitter to invalidate the Rani thread sidebar
// after mutations in child routes (new/rename/delete thread, new message).

type Listener = () => void;
const listeners = new Set<Listener>();

export function subscribeRaniThreads(fn: Listener) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function emitRaniThreadsChanged() {
  listeners.forEach((fn) => fn());
}

export type RaniAttachment = {
  name: string;
  path: string;
  size: number;
  mime: string | null;
};

export type RaniThread = {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
};

export type RaniMessage = {
  id: string;
  thread_id: string;
  user_id: string;
  role: "user" | "assistant";
  content: string;
  attachments: RaniAttachment[];
  created_at: string;
};

export const RANI_SUGGESTIONS = [
  "Quanto faturei este mês?",
  "Quais são os gastos do projeto ativo mais caro?",
  "Como está o progresso das etapas?",
  "Quais vendas ainda estão pendentes?",
];