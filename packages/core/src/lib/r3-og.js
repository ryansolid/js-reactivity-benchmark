//#region src/index.ts
let ReactiveFlags = /* @__PURE__ */ function(ReactiveFlags$1) {
	ReactiveFlags$1[ReactiveFlags$1["None"] = 0] = "None";
	ReactiveFlags$1[ReactiveFlags$1["Check"] = 1] = "Check";
	ReactiveFlags$1[ReactiveFlags$1["Dirty"] = 2] = "Dirty";
	ReactiveFlags$1[ReactiveFlags$1["RecomputingDeps"] = 4] = "RecomputingDeps";
	ReactiveFlags$1[ReactiveFlags$1["InHeap"] = 8] = "InHeap";
	ReactiveFlags$1[ReactiveFlags$1["InHeapHeight"] = 16] = "InHeapHeight";
	return ReactiveFlags$1;
}({});
const initial = Symbol("INITIAL");
let markedHeap = false;
let context = null;
let minDirty = 0;
let maxDirty = 0;
const dirtyHeap = new Array(2e3);
function increaseHeapSize(n) {
	if (n > dirtyHeap.length) dirtyHeap.length = n;
}
function actualInsertIntoHeap(n, f) {
	const height = n.height;
	const heapAtHeight = dirtyHeap[height];
	if (heapAtHeight === void 0) dirtyHeap[height] = n;
	else {
		const tail = heapAtHeight.prevHeap;
		tail.nextHeap = n;
		n.prevHeap = tail;
		heapAtHeight.prevHeap = n;
	}
	if (height > maxDirty) maxDirty = height;
}
function insertIntoHeap(n) {
	let flags = n.flags;
	if (flags & (ReactiveFlags.InHeap | ReactiveFlags.RecomputingDeps)) return;
	if (flags & ReactiveFlags.Check) flags = flags & ~(ReactiveFlags.Check | ReactiveFlags.Dirty) | ReactiveFlags.Dirty;
	n.flags = flags | ReactiveFlags.InHeap;
	if (!(flags & ReactiveFlags.InHeapHeight)) actualInsertIntoHeap(n, flags);
}
function insertIntoHeapHeight(n) {
	let flags = n.flags;
	if (flags & (ReactiveFlags.InHeap | ReactiveFlags.RecomputingDeps | ReactiveFlags.InHeapHeight)) return;
	n.flags = flags | ReactiveFlags.InHeapHeight;
	actualInsertIntoHeap(n, flags);
}
function deleteFromHeap(n) {
	const flags = n.flags;
	if (!(flags & (ReactiveFlags.InHeap | ReactiveFlags.InHeapHeight))) return;
	n.flags = flags & ~(ReactiveFlags.InHeap | ReactiveFlags.InHeapHeight);
	const height = n.height;
	if (n.prevHeap === n) dirtyHeap[height] = void 0;
	else {
		const next = n.nextHeap;
		const dhh = dirtyHeap[height];
		const end = next ?? dhh;
		if (n === dhh) dirtyHeap[height] = next;
		else n.prevHeap.nextHeap = next;
		end.prevHeap = n.prevHeap;
	}
	n.prevHeap = n;
	n.nextHeap = void 0;
}
function computed(fn) {
	const self = {
		disposal: null,
		fn,
		value: void 0,
		height: 0,
		child: null,
		nextHeap: void 0,
		prevHeap: null,
		deps: null,
		depsTail: null,
		subs: null,
		subsTail: null,
		parent: context,
		nextSibling: null,
		firstChild: null,
		flags: ReactiveFlags.None
	};
	self.prevHeap = self;
	if (context) {
		const lastChild = context.firstChild;
		if (lastChild === null) context.firstChild = self;
		else {
			self.nextSibling = lastChild;
			context.firstChild = self;
		}
		if (context.depsTail === null) {
			self.height = context.height;
			recompute(self);
		} else {
			self.height = context.height + 1;
			insertIntoHeap(self);
		}
	} else recompute(self);
	return self;
}
function asyncComputed(fn) {
	const self = {
		disposal: null,
		fn: void 0,
		value: void 0,
		height: 0,
		child: null,
		nextHeap: void 0,
		prevHeap: null,
		loaded: signal(initial),
		loading: null,
		deps: null,
		depsTail: null,
		subs: null,
		subsTail: null,
		parent: null,
		nextSibling: null,
		firstChild: null,
		flags: ReactiveFlags.None
	};
	self.loading = signal(true, self);
	const get = (s) => read(s, self);
	self.fn = () => {
		setSignal(self.loading, true);
		const p = fn(get);
		p.then((v) => {
			if (self.value === p) {
				setSignal(self.loaded, v);
				setSignal(self.loading, false);
			}
		});
		return p;
	};
	self.prevHeap = self;
	if (context) {
		const lastChild = context.firstChild;
		if (lastChild === null) context.firstChild = self;
		else {
			self.nextSibling = lastChild;
			context.firstChild = self;
		}
		if (context.depsTail === null) {
			self.height = context.height;
			recompute(self);
		} else {
			self.height = context.height + 1;
			insertIntoHeap(self);
		}
	} else recompute(self);
	return self;
}
function readUpDefault(x, defaultValue) {
	const p = read(x.loaded);
	return p === initial ? defaultValue : p;
}
function readDownDefault(x, defaultValue) {
	return read(x.loading) ? readUpDefault(x, defaultValue) : defaultValue;
}
function signal(v, firewall = null) {
	if (firewall !== null) return firewall.child = {
		value: v,
		subs: null,
		subsTail: null,
		owner: firewall,
		nextChild: firewall.child
	};
	else return {
		value: v,
		subs: null,
		subsTail: null
	};
}
function recompute(el) {
	deleteFromHeap(el);
	disposeChildren(el);
	const oldcontext = context;
	context = el;
	el.depsTail = null;
	el.flags = ReactiveFlags.RecomputingDeps;
	let value;
	let oldHeight = el.height;
	try {
		value = el.fn();
		el.error = void 0;
	} catch (e) {
		el.error = e;
	}
	el.flags = ReactiveFlags.None;
	context = oldcontext;
	const depsTail = el.depsTail;
	let toRemove = depsTail !== null ? depsTail.nextDep : el.deps;
	if (toRemove !== null) {
		do
			toRemove = unlinkSubs(toRemove);
		while (toRemove !== null);
		if (depsTail !== null) depsTail.nextDep = null;
		else el.deps = null;
	}
	if (value !== el.value) {
		el.value = value;
		for (let s = el.subs; s !== null; s = s.nextSub) insertIntoHeap(s.sub);
	} else if (el.height != oldHeight) for (let s = el.subs; s !== null; s = s.nextSub) insertIntoHeapHeight(s.sub);
}
function updateIfNecessary(el) {
	if (el.flags & ReactiveFlags.Check) for (let d = el.deps; d; d = d.nextDep) {
		const dep1 = d.dep;
		const dep = "owner" in dep1 ? dep1.owner : dep1;
		if ("fn" in dep) updateIfNecessary(dep);
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
	if (prevSub !== null && prevSub.sub === sub && (!isRecomputing || isValidLink(prevSub, sub))) return;
	const newLink = sub.depsTail = dep.subsTail = {
		dep,
		sub,
		nextDep,
		prevSub,
		nextSub: null
	};
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
function read(el, c = context) {
	if (c) {
		link(el, c);
		const owner = "owner" in el ? el.owner : el;
		if ("fn" in owner) {
			if (owner.height >= minDirty) {
				markNode(c);
				markHeap();
				updateIfNecessary(owner);
			}
			const height = owner.height;
			if (height >= c.height) c.height = height + 1;
		}
	}
	if (el.error) throw el.error;
	return el.value;
}
function setSignal(el, v) {
	if (el.value === v) return;
	el.value = v;
	for (let link$1 = el.subs; link$1 !== null; link$1 = link$1.nextSub) insertIntoHeap(link$1.sub);
}
function markNode(el, newState = ReactiveFlags.Dirty) {
	const flags = el.flags;
	if ((flags & (ReactiveFlags.Check | ReactiveFlags.Dirty)) >= newState) return;
	el.flags = flags & ~(ReactiveFlags.Check | ReactiveFlags.Dirty) | newState;
	for (let link$1 = el.subs; link$1 !== null; link$1 = link$1.nextSub) markNode(link$1.sub, ReactiveFlags.Check);
	if (el.child !== null) for (let child = el.child; child !== null; child = child.nextChild) for (let link$1 = child.subs; link$1 !== null; link$1 = link$1.nextSub) markNode(link$1.sub, ReactiveFlags.Check);
}
function markHeap() {
	if (markedHeap) return;
	markedHeap = true;
	for (let i = 0; i <= maxDirty; i++) for (let el = dirtyHeap[i]; el !== void 0; el = el.nextHeap) if (el.flags & ReactiveFlags.InHeap) markNode(el);
}
function adjustHeight(el) {
	deleteFromHeap(el);
	let newHeight = el.height;
	for (let d = el.deps; d; d = d.nextDep) {
		const dep1 = d.dep;
		const dep = "owner" in dep1 ? dep1.owner : dep1;
		if ("fn" in dep) {
			if (dep.height >= newHeight) newHeight = dep.height + 1;
		}
	}
	if (el.height !== newHeight) {
		el.height = newHeight;
		for (let s = el.subs; s !== null; s = s.nextSub) insertIntoHeapHeight(s.sub);
	}
}
function stabilize() {
	markedHeap = false;
	for (minDirty = 0; minDirty <= maxDirty; minDirty++) {
		let el = dirtyHeap[minDirty];
		while (el !== void 0) {
			if (el.flags & ReactiveFlags.InHeap) recompute(el);
			else adjustHeight(el);
			el = dirtyHeap[minDirty];
		}
	}
}
function onCleanup(fn) {
	if (!context) return fn;
	const node = context;
	if (!node.disposal) node.disposal = fn;
	else if (Array.isArray(node.disposal)) node.disposal.push(fn);
	else node.disposal = [node.disposal, fn];
	return fn;
}
function disposeChildren(node) {
	let child = node.firstChild;
	while (child) {
		const nextChild = child.nextSibling;
		if (child.deps) {
			const n = child;
			deleteFromHeap(n);
			let toRemove = n.deps;
			do
				toRemove = unlinkSubs(toRemove);
			while (toRemove !== null);
			n.deps = null;
			n.depsTail = null;
			n.flags = ReactiveFlags.None;
		}
		disposeChildren(child);
		child = nextChild;
	}
	node.firstChild = null;
	node.nextSibling = null;
	runDisposal(node);
}
function runDisposal(node) {
	if (!node.disposal) return;
	if (Array.isArray(node.disposal)) for (let i = 0; i < node.disposal.length; i++) {
		const callable = node.disposal[i];
		callable.call(callable);
	}
	else node.disposal.call(node.disposal);
	node.disposal = null;
}
function getContext() {
	return context;
}
function runWithOwner(owner, fn) {
	const oldContext = context;
	context = owner;
	try {
		return fn();
	} finally {
		context = oldContext;
	}
}

//#endregion
export { ReactiveFlags, asyncComputed, computed, getContext, increaseHeapSize, onCleanup, read, readDownDefault, readUpDefault, runWithOwner, setSignal, signal, stabilize };