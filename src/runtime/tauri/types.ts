// Rust Channel wire contract. This file intentionally contains types only so
// product code cannot accidentally grow a second IPC implementation.
export type AiStreamEvent =
  | { event: 'started'; data: { status: number; statusText: string } }
  | { event: 'chunk'; data: { bytes: number[] } }
  | { event: 'done' }
  | { event: 'error'; data: { error: unknown } }
