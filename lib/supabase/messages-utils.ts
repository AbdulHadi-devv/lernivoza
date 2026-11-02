// Plain helpers (no 'use server') so they can be used from client components.

export const MAX_MESSAGE_LENGTH = 2000;

/**
 * Today -> "14:05". Other days -> "3 Nov, 14:05".
 */
export function formatMessageTime(iso: string): string {
  const d = new Date(iso);
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === new Date().toDateString()) return time;
  const day = d.toLocaleDateString([], { day: 'numeric', month: 'short' });
  return `${day}, ${time}`;
}