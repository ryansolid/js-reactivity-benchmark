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
}
interface FirewallSignal<T> extends RawSignal<T> {
  owner: Computed<unknown>;
  nextChild: FirewallSignal<unknown> | null;
}
type Signal<T> = RawSignal<T> | FirewallSignal<T>;
declare const initial: unique symbol;
type AsyncSignal<T> = Signal<Promise<T>> & {
  loaded: Signal<T | typeof initial>;
  loading: FirewallSignal<boolean>;
};
interface Owner {
  disposal: Disposable | Disposable[] | null;
  parent: Owner | null;
  firstChild: Owner | null;
  nextSibling: Owner | null;
}
interface Computed<T> extends RawSignal<T>, Owner {
  deps: Link | null;
  depsTail: Link | null;
  flags: ReactiveFlags;
  height: number;
  nextHeap: Computed<unknown> | undefined;
  prevHeap: Computed<unknown>;
  fn: () => T;
  child: FirewallSignal<unknown> | null;
}
declare function increaseHeapSize(n: number): void;
declare function computed<T>(fn: () => T): Computed<T>;
declare function asyncComputed<T>(fn: (get: <U>(signal: Signal<U>) => U) => Promise<T>): AsyncSignal<T>;
declare function readUpDefault<T>(x: AsyncSignal<T>, defaultValue: T): T;
declare function readDownDefault<T>(x: AsyncSignal<T>, defaultValue: T): T;
declare function signal<T>(v: T, firewall: Computed<unknown>): FirewallSignal<T>;
declare function signal<T>(v: T): Signal<T>;
declare function read<T>(el: Signal<T> | Computed<T>, c?: Computed<unknown> | null): T;
declare function setSignal(el: Signal<unknown>, v: unknown): void;
declare function stabilize(): void;
declare function onCleanup(fn: Disposable): Disposable;
declare function getContext(): Computed<unknown> | null;
declare function runWithOwner<T>(owner: Computed<unknown> | null, fn: () => T): T;
//#endregion
export { Computed, Disposable, Link, Owner, RawSignal, ReactiveFlags, Signal, asyncComputed, computed, getContext, increaseHeapSize, onCleanup, read, readDownDefault, readUpDefault, runWithOwner, setSignal, signal, stabilize };