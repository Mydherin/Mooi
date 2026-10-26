/**
 * One edit made in the view, addressed by text rather than position so it can be replayed on a
 * newer list (another device, an agent) without touching the wrong item.
 */
export type TodoChange =
  | { kind: 'add'; text: string }
  | { kind: 'toggle'; text: string; done: boolean }
  | { kind: 'edit'; text: string; next: string }
  | { kind: 'remove'; text: string }
  | { kind: 'replace'; items: { text: string; done: boolean }[] };
