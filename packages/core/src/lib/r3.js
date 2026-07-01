//#region src/index.ts
let ReactiveFlags = /* @__PURE__ */ (function (ReactiveFlags$1) {
  ReactiveFlags$1[(ReactiveFlags$1["None"] = 0)] = "None";
  ReactiveFlags$1[(ReactiveFlags$1["Check"] = 1)] = "Check";
  ReactiveFlags$1[(ReactiveFlags$1["Dirty"] = 2)] = "Dirty";
  ReactiveFlags$1[(ReactiveFlags$1["RecomputingDeps"] = 4)] = "RecomputingDeps";
  ReactiveFlags$1[(ReactiveFlags$1["InHeap"] = 8)] = "InHeap";
  ReactiveFlags$1[(ReactiveFlags$1["InHeapHeight"] = 16)] = "InHeapHeight";
  ReactiveFlags$1[(ReactiveFlags$1["Zombie"] = 32)] = "Zombie";
  return ReactiveFlags$1;
})({});
let AsyncFlags = /* @__PURE__ */ (function (AsyncFlags$1) {
  AsyncFlags$1[(AsyncFlags$1["None"] = 0)] = "None";
  AsyncFlags$1[(AsyncFlags$1["Pending"] = 1)] = "Pending";
  AsyncFlags$1[(AsyncFlags$1["Error"] = 2)] = "Error";
  AsyncFlags$1[(AsyncFlags$1["Uninitialized"] = 4)] = "Uninitialized";
  return AsyncFlags$1;
})({});
let context = null;
let clock = 0;
let pendingNode = null;
let pendingNodes = [];
let tracking = false;
const dirty = {
  heap: new Array(2e3).fill(void 0),
  min: 0,
  max: 0,
  marked: false,
};
const pending = {
  heap: new Array(2e3).fill(void 0),
  min: 0,
  max: 0,
  marked: false,
};
const NOT_PENDING = {};

function actualInsertIntoHeap(n, heap) {
  const height = n.height;
  const heapAtHeight = heap.heap[height];
  if (heapAtHeight === void 0) heap.heap[height] = n;
  else {
    const tail = heapAtHeight.prevHeap;
    tail.nextHeap = n;
    n.prevHeap = tail;
    heapAtHeight.prevHeap = n;
  }
  if (height > heap.max) heap.max = height;
}
function insertIntoHeap(n, heap) {
  let flags = n.flags;
  if (flags & (ReactiveFlags.InHeap | ReactiveFlags.RecomputingDeps)) return;
  if (flags & ReactiveFlags.Check)
    n.flags =
      (flags & ~(ReactiveFlags.Check | ReactiveFlags.Dirty)) |
      ReactiveFlags.Dirty |
      ReactiveFlags.InHeap;
  else n.flags = flags | ReactiveFlags.InHeap;
  if (!(flags & ReactiveFlags.InHeapHeight)) actualInsertIntoHeap(n, heap);
}
function insertIntoHeapHeight(n, heap) {
  let flags = n.flags;
  if (
    flags &
    (ReactiveFlags.InHeap | ReactiveFlags.RecomputingDeps | ReactiveFlags.InHeapHeight)
  )
    return;
  n.flags = flags | ReactiveFlags.InHeapHeight;
  actualInsertIntoHeap(n, heap);
}
function deleteFromHeap(n, heap) {
  const flags = n.flags;
  if (!(flags & (ReactiveFlags.InHeap | ReactiveFlags.InHeapHeight))) return;
  n.flags = flags & ~(ReactiveFlags.InHeap | ReactiveFlags.InHeapHeight);
  const height = n.height;
  if (n.prevHeap === n) heap.heap[height] = void 0;
  else {
    const next = n.nextHeap;
    const dhh = heap.heap[height];
    const end = next ?? dhh;
    if (n === dhh) heap.heap[height] = next;
    else n.prevHeap.nextHeap = next;
    end.prevHeap = n.prevHeap;
  }
  n.prevHeap = n;
  n.nextHeap = void 0;
}
function markHeap(heap) {
  if (heap.marked) return;
  heap.marked = true;
  for (let i = 0; i <= heap.max; i++) {
    for (let el = heap.heap[i]; el !== void 0; el = el.nextHeap)
      if (el.flags & ReactiveFlags.InHeap) markNode(el);
  }
}
function markNode(el, newState = ReactiveFlags.Dirty) {
  const flags = el.flags;
  if ((flags & (ReactiveFlags.Check | ReactiveFlags.Dirty)) >= newState) return;
  el.flags = (flags & ~(ReactiveFlags.Check | ReactiveFlags.Dirty)) | newState;
  for (let link$1 = el.subs; link$1 !== null; link$1 = link$1.nextSub)
    markNode(link$1.sub, ReactiveFlags.Check);
}
function runHeap(heap) {
  heap.marked = false;
  for (heap.min = 0; heap.min <= heap.max; heap.min++) {
    let el = heap.heap[heap.min];
    while (el !== void 0) {
      if (el.flags & ReactiveFlags.InHeap) recompute(el);
      else adjustHeight(el, heap);
      el = heap.heap[heap.min];
    }
  }
  heap.max = 0;
}
function adjustHeight(el, heap) {
  deleteFromHeap(el, heap);
  let newHeight = el.height;
  for (let d = el.deps; d; d = d.nextDep) {
    const dep1 = d.dep;
    const dep = dep1;
    if (dep.fn) {
      if (dep.height >= newHeight) newHeight = dep.height + 1;
    }
  }
  if (el.height !== newHeight) {
    el.height = newHeight;
    for (let s = el.subs; s !== null; s = s.nextSub)
      insertIntoHeapHeight(s.sub, heap);
  }
}
function stabilize() {
  runHeap(dirty);
  if (pendingNode !== null) {
    const n = pendingNode;
    if (n.pendingValue !== NOT_PENDING) {
      n.value = n.pendingValue;
      n.pendingValue = NOT_PENDING;
    }
    if (n.fn && (n.pendingFirstChild || n.pendingDisposal)) disposeChildren(n, true);
    pendingNode = null;
  } else {
    for (let i = 0; i < pendingNodes.length; i++) {
      const n = pendingNodes[i];
      if (n.pendingValue !== NOT_PENDING) {
        n.value = n.pendingValue;
        n.pendingValue = NOT_PENDING;
      }
      if (n.fn && (n.pendingFirstChild || n.pendingDisposal)) disposeChildren(n, true);
    }
    pendingNodes.length = 0;
  }
  clock++;
}
function pushPendingNode(n) {
  if (pendingNode === null && pendingNodes.length === 0) {
    pendingNode = n;
  } else {
    if (pendingNode !== null) {
      pendingNodes.push(pendingNode);
      pendingNode = null;
    }
    pendingNodes.push(n);
  }
}
function recompute(el, create = false) {
  deleteFromHeap(el, el.flags & ReactiveFlags.Zombie ? pending : dirty);
  if (
    el.pendingValue !== NOT_PENDING ||
    el.pendingFirstChild ||
    el.pendingDisposal
  )
    disposeChildren(el);
  else if (el.firstChild || el.disposal) {
    markDisposal(el);
    pendingNodes.push(el);
    el.pendingDisposal = el.disposal;
    el.pendingFirstChild = el.firstChild;
    el.disposal = null;
    el.firstChild = null;
  }
  const oldcontext = context;
  context = el;
  el.depsTail = null;
  el.flags = ReactiveFlags.RecomputingDeps;
  let value = el.pendingValue === NOT_PENDING ? el.value : el.pendingValue;
  let oldHeight = el.height;
  el.time = clock;
  let prevAsyncFlags = el.asyncFlags;
	let prevError = el.error;
  let prevTracking = tracking;
  clearAsyncFlags(el);
  tracking = true;
  try {
    value = el.fn(value);
  } finally {
    tracking = prevTracking;
  }
  el.flags = ReactiveFlags.None;
  context = oldcontext;
  const depsTail = el.depsTail;
  let toRemove = depsTail !== null ? depsTail.nextDep : el.deps;
  if (toRemove !== null) {
    do {
      toRemove = unlinkSubs(toRemove);
    } while (toRemove !== null);
    if (depsTail !== null) depsTail.nextDep = null;
    else el.deps = null;
  }
  const valueChanged =
    el.pendingValue === NOT_PENDING
      ? value !== el.value
      : el.pendingValue !== value;
  const asyncFlagsChanged =
		el.asyncFlags !== prevAsyncFlags || prevError !== el.error;
  if (valueChanged || asyncFlagsChanged) {
    if (valueChanged) {
      if (create || el.type) el.value = value;
      else {
        if (el.pendingValue === NOT_PENDING) pushPendingNode(el);
        el.pendingValue = value;
      }
    }
    for (let s = el.subs; s !== null; s = s.nextSub)
      insertIntoHeap(
        s.sub,
        s.sub.flags & ReactiveFlags.Zombie ? pending : dirty
      );
  } else if (el.height != oldHeight)
    for (let s = el.subs; s !== null; s = s.nextSub)
      insertIntoHeapHeight(
        s.sub,
        s.sub.flags & ReactiveFlags.Zombie ? pending : dirty
      );
}
function updateIfNecessary(el) {
  if (el.flags & ReactiveFlags.Check)
    for (let d = el.deps; d; d = d.nextDep) {
      const dep1 = d.dep;
      const dep = dep1;
      if (dep.fn) updateIfNecessary(dep);
      if (el.flags & ReactiveFlags.Dirty) break;
    }
  if (el.flags & ReactiveFlags.Dirty) recompute(el);
  el.flags = ReactiveFlags.None;
}
function unlinkSubs(link$1) {
  const dep = link$1.dep;
  const nextDep = link$1.nextDep;
  const nextSub = link$1.nextSub;
  const prevSub = link$1.prevSub;
  if (nextSub !== null) nextSub.prevSub = prevSub;
  else dep.subsTail = prevSub;
  if (prevSub !== null) prevSub.nextSub = nextSub;
  else dep.subs = nextSub;
  return nextDep;
}
function link(dep, sub) {
  const prevDep = sub.depsTail;
  if (prevDep !== null && prevDep.dep === dep) return;
  let nextDep = null;
  const isRecomputing = sub.flags & ReactiveFlags.RecomputingDeps;
  if (isRecomputing) {
    nextDep = prevDep !== null ? prevDep.nextDep : sub.deps;
    if (nextDep !== null && nextDep.dep === dep) {
      sub.depsTail = nextDep;
      return;
    }
  }
  const prevSub = dep.subsTail;
  if (
    prevSub !== null &&
    prevSub.sub === sub &&
    (!isRecomputing || isValidLink(prevSub, sub))
  )
    return;
  const newLink =
    (sub.depsTail =
    dep.subsTail =
      {
        dep,
        sub,
        nextDep,
        prevSub,
        nextSub: null,
      });
  if (prevDep !== null) prevDep.nextDep = newLink;
  else sub.deps = newLink;
  if (prevSub !== null) prevSub.nextSub = newLink;
  else dep.subs = newLink;
}
function isValidLink(checkLink, sub) {
  const depsTail = sub.depsTail;
  if (depsTail !== null) {
    let link$1 = sub.deps;
    do {
      if (link$1 === checkLink) return true;
      if (link$1 === depsTail) break;
      link$1 = link$1.nextDep;
    } while (link$1 !== null);
  }
  return false;
}
function setAsyncFlags(signal$1, flags, error = null) {
  signal$1.asyncFlags = flags;
  signal$1.error = error;
}
function clearAsyncFlags(signal$1) {
  setAsyncFlags(signal$1, AsyncFlags.None);
}
function markDisposal(el) {
  let child = el.firstChild;
  while (child) {
    child.flags |= ReactiveFlags.Zombie;
    if (child.flags & ReactiveFlags.InHeap) {
      deleteFromHeap(child, dirty);
      insertIntoHeap(child, pending);
    }
    markDisposal(child);
    child = child.nextSibling;
  }
}
function disposeChildren(node, zombie) {
  let child = zombie ? node.pendingFirstChild : node.firstChild;
  while (child) {
    const nextChild = child.nextSibling;
    if (child.deps) {
      const n = child;
      deleteFromHeap(n, n.flags & ReactiveFlags.Zombie ? pending : dirty);
      let toRemove = n.deps;
      do {
				toRemove = unlinkSubs(toRemove);
			} while (toRemove !== null);
      n.deps = null;
      n.depsTail = null;
      n.flags = ReactiveFlags.None;
    }
    disposeChildren(child);
    child = nextChild;
  }
  if (zombie) node.pendingFirstChild = null;
  else {
    node.firstChild = null;
    node.nextSibling = null;
  }
  runDisposal(node, zombie);
}
function runDisposal(node, zombie) {
  let disposal = zombie ? node.pendingDisposal : node.disposal;
  if (!disposal) return;
  if (Array.isArray(disposal))
    for (let i = 0; i < disposal.length; i++) {
      const callable = disposal[i];
      callable.call(callable);
    }
  else disposal.call(disposal);
  zombie ? (node.pendingDisposal = null) : (node.disposal = null);
}
function computed(fn, initialValue) {
  const self = {
    disposal: null,
    fn,
    value: initialValue,
    height: 0,
    nextHeap: void 0,
    prevHeap: null,
    deps: null,
    depsTail: null,
    subs: null,
    subsTail: null,
    parent: context,
    nextSibling: null,
    firstChild: null,
    flags: ReactiveFlags.None,
    asyncFlags: AsyncFlags.Uninitialized,
    time: clock,
    pendingValue: NOT_PENDING,
    pendingDisposal: null,
    pendingFirstChild: null,
  };
  self.prevHeap = self;
  if (context) {
    const lastChild = context.firstChild;
    if (lastChild === null) context.firstChild = self;
    else {
      self.nextSibling = lastChild;
      context.firstChild = self;
    }
    self.height = context.height + 1;
  }
  recompute(self, true);
  return self;
}
function signal(v) {
  return {
    value: v,
    subs: null,
    subsTail: null,
    asyncFlags: AsyncFlags.None,
    time: clock,
    pendingValue: NOT_PENDING,
  };
}
function read(el) {
	let c = context;
  if (c && tracking) {
    link(el, c);
    const owner = el;
    if (owner.fn) {
      const isZombie = el.flags & ReactiveFlags.Zombie;
      if (owner.height >= (isZombie ? pending.min : dirty.min)) {
        markNode(c);
        markHeap(isZombie ? pending : dirty);
        updateIfNecessary(owner);
      }
      const height = owner.height;
      if (height >= c.height && el.parent !== c) {
        c.height = height + 1;
      }
    }
  }
  return !c || el.pendingValue === NOT_PENDING ? el.value : el.pendingValue;
}
function setSignal(el, v) {
  const valueChanged =
    el.pendingValue === NOT_PENDING ? el.value !== v : el.pendingValue !== v;
  if (!valueChanged && !el.asyncFlags) return;
  clearAsyncFlags(el);
  el.time = clock;
  if (valueChanged) {
    if (el.pendingValue === NOT_PENDING) pushPendingNode(el);
    el.pendingValue = v;
  }
  for (let link$1 = el.subs; link$1 !== null; link$1 = link$1.nextSub)
    insertIntoHeap(
      link$1.sub,
      link$1.sub.flags & ReactiveFlags.Zombie ? pending : dirty
    );
	return v;
}
export {
  computed,
  read,
  setSignal,
  signal,
  stabilize,
};
