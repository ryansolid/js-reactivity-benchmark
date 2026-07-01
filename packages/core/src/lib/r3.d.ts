//#region src/index.d.ts
interface Disposable {
  (): void;
}
declare const enum ReactiveFlags {
  None = 0,
  Check = 1,
  Dirty = 2,
  RecomputingDeps = 4,
  InHeap = 8,
  InHeapHeight = 16,
  Zombie = 32,
}
declare const enum AsyncFlags {
  None = 0,
  Pending = 1,
  Error = 2,
  Uninitialized = 4,
}
interface Link {
  dep: Signal<unknown> | Computed<unknown>;
  sub: Computed<unknown>;
  nextDep: Link | null;
  prevSub: Link | null;
  nextSub: Link | null;
}
interface RawSignal<T> {
  subs: Link | null;
  subsTail: Link | null;
  value: T;
  error?: unknown;
  asyncFlags: AsyncFlags;
  time: number;
  pendingValue: T | typeof NOT_PENDING;
}
interface FirewallSignal<T> extends RawSignal<T> {
  owner: Computed<unknown>;
  nextChild: FirewallSignal<unknown> | null;
}
type Signal<T> = RawSignal<T> | FirewallSignal<T>;
interface Owner {
  disposal: Disposable | Disposable[] | null;
  parent: Owner | null;
  firstChild: Owner | null;
  nextSibling: Owner | null;
  pendingDisposal: Disposable | Disposable[] | null;
  pendingFirstChild: Owner | null;
}
interface Computed<T> extends RawSignal<T>, Owner {
  deps: Link | null;
  depsTail: Link | null;
  flags: ReactiveFlags;
  height: number;
  nextHeap: Computed<any> | undefined;
  prevHeap: Computed<any>;
  fn: (prev?: T) => T;
  child: FirewallSignal<any> | null;
}
declare class NotReadyError extends Error {
  cause: Computed<unknown>;
  constructor(cause: Computed<unknown>);
}
declare const NOT_PENDING: {};
declare function increaseHeapSize(n: number): void;
declare function computed<T>(fn: (prev?: T) => T): Computed<T>;
declare function computed<T>(fn: (prev: T) => T, initialValue: T): Computed<T>;
declare function asyncComputed<T>(asyncFn: (prev?: T) => T | Promise<T> | AsyncIterable<T>): Computed<T>;
declare function asyncComputed<T>(asyncFn: (prev: T) => T | Promise<T> | AsyncIterable<T>, initialValue: T): Computed<T>;
declare function signal<T>(v: T, firewall: Computed<any>): FirewallSignal<T>;
declare function signal<T>(v: T): Signal<T>;
declare function read<T>(el: Signal<T> | Computed<T>, c?: Computed<unknown> | null): T;
declare function setSignal(el: Signal<unknown>, v: unknown): void;
declare function stabilize(): void;
declare function onCleanup(fn: Disposable): Disposable;
declare function getContext(): Computed<unknown> | null;
declare function runWithOwner<T>(owner: Computed<unknown> | null, fn: () => T): T;
declare function latest<T>(fn: () => T): T;
//#endregion
export { AsyncFlags, Computed, Disposable, Link, NotReadyError, Owner, RawSignal, ReactiveFlags, Signal, asyncComputed, computed, getContext, increaseHeapSize, latest, onCleanup, read, runWithOwner, setSignal, signal, stabilize };