import React, { useEffect, useMemo, useRef, useState } from "react";
import { useAccount, useDisconnect } from "wagmi";
import { ethers, BrowserProvider, Contract, parseEther } from "ethers";
import { motion, AnimatePresence } from "framer-motion";
import {
  Menu, MessageCircle, Phone, CircleFadingPlus, Settings, ChevronUp,
  Search, SquarePen, ListFilter, Video, Smile, Paperclip, Send, Mic,
  Image as ImageIcon, Camera, File as FileIcon, UserRound, Store, Plus,
  Sparkles, X, Check, Loader2, Heart, Share2, Tag, Wallet, ArrowLeft,
  Copy, LogOut, User as UserIcon, Globe,
} from "lucide-react";
import { showSuccess, showError, showInfo } from "@/lib/feedback";

// ============ CONFIG ============
const LIT_NAME_REGISTRY = "0x3E3aEE6d154f881A7418b2dA50c915C34664C2A8";
const HUB_POSTS         = "0x33690545061cF3759350dd2C5A0d1080D9A14D73";
const LIT_MARKETPLACE   = "0x9cc6e4BB66EC19475d9db8082482Eb272cf6eA02";
const LIT_MESSENGER     = "0x69405b51963D592C6CA9350F774045d4E76c89B8";
const LIT_TRANSFER      = "0xaA6154Fa2E03A2dFf6b4Ca85f31334652C2dcF11";
const BACKEND_URL       = "https://hub.test-hub.xyz";
const LITVM_CHAIN_ID    = 4441;
const LITVM_CHAIN_HEX   = "0x1159";

const REGISTRY_ABI = [
  "function register(string name, uint8 duration) external payable",
  "function isAvailable(string name) external view returns (bool)",
  "function resolve(string name) external view returns (address)",
  "function reverseResolve(address wallet) external view returns (string)",
  "function getPrice(uint8 duration) external view returns (uint256)",
  "function transfer(string name, address to) external",
  "function setOperatorApproval(address operator, bool approved) external",
];
const POSTS_ABI = [
  "function createPost(string content, uint256 likeReward, uint256 commentReward) payable returns (uint256)",
  "function likePost(uint256 postId)",
  "function commentPost(uint256 postId, string text)",
  "function hasLiked(uint256, address) view returns (bool)",
];
const MARKETPLACE_ABI = [
  "function listName(string name, uint256 price)",
  "function unlistName(string name)",
  "function buyName(string name) payable",
  "function placeBid(string name) payable",
  "function cancelBid(string name)",
  "function acceptBid(string name, address bidder)",
];
const MESSENGER_ABI = [
  "function sendFriendRequest(address to)",
  "function acceptFriendRequest(uint256 reqId)",
  "function rejectFriendRequest(uint256 reqId)",
  "function sendMessage(address to, string contentHash, string msgType)",
  "function sendZkLTC(address to, string note) payable",
];
const TRANSFER_ABI = [
  "function sendToName(string toLitName, string note) payable",
  "function sendToAddress(address to, string note) payable",
];

const DURATIONS = [
  { id: 1, label: "1 Year", price: "0.05" },
  { id: 2, label: "2 Years", price: "0.09" },
  { id: 5, label: "5 Years", price: "0.20" },
  { id: 10, label: "10 Years", price: "0.35" },
  { id: 99, label: "Forever", price: "0.50" },
];

// ============ Helpers ============
async function getSigner() {
  const eth = (window as any).ethereum;
  if (!eth) throw new Error("No wallet detected");
  const provider = new BrowserProvider(eth);
  try {
    const net = await provider.getNetwork();
    if (Number(net.chainId) !== LITVM_CHAIN_ID) {
      await eth.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: LITVM_CHAIN_HEX }],
      }).catch(() => undefined);
    }
  } catch {}
  return provider.getSigner();
}
async function writeContract(addr: string, abi: any, fn: string, args: any[], value?: bigint) {
  const signer = await getSigner();
  const c = new Contract(addr, abi, signer);
  const tx = await c[fn](...args, value ? { value } : {});
  return tx.wait();
}
async function backendGet(path: string) {
  const res = await fetch(`${BACKEND_URL}${path}`);
  if (!res.ok) throw new Error(`Backend ${res.status}`);
  return res.json();
}
const shortAddr = (a?: string) => (a ? `${a.slice(0, 6)}...${a.slice(-4)}` : "");
const letterOf = (s?: string) => ((s || "?").trim().replace(/^0x/, "")[0] || "?").toUpperCase();

// ============================================================================
// ROOT
// ============================================================================
export default function HubPage() {
  const { address, isConnected } = useAccount();
  const [myName, setMyName] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!isConnected || !address) return;
    setChecking(true);
    fetch(`${BACKEND_URL}/hub/name/reverse/${address}`)
      .then(async (r) => (r.ok ? (await r.json())?.name || null : null))
      .catch(async () => {
        try {
          const provider = new BrowserProvider((window as any).ethereum);
          const c = new Contract(LIT_NAME_REGISTRY, REGISTRY_ABI, provider);
          const n: string = await c.reverseResolve(address);
          return n && n.length > 0 ? n : null;
        } catch { return null; }
      })
      .then((n) => setMyName(n))
      .finally(() => setChecking(false));
  }, [address, isConnected]);

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
        <Sparkles className="w-12 h-12 text-white/40 mb-4" />
        <h2 className="text-2xl font-black uppercase tracking-tight text-white mb-2">Hub</h2>
        <p className="text-white/50 max-w-sm">Connect your wallet to enter the LitVM social layer.</p>
      </div>
    );
  }

  if (!checking && !myName) {
    return (
      <div className="fixed inset-0 z-[99999] bg-black/95 backdrop-blur-2xl flex items-center justify-center p-4">
        <RegisterNameModal onRegistered={setMyName} />
      </div>
    );
  }

  if (checking) {
    return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 text-white/40 animate-spin" /></div>;
  }

  return <ChatShell myAddress={address!} myName={myName!} />;
}

// ============================================================================
// SHELL: Sidebar + Resizable 3-pane (Messages / Phone / Status / .lit Market)
// ============================================================================
type SidePage = "messages" | "phone" | "status" | "market";

function ChatShell({ myAddress, myName }: { myAddress: string; myName: string }) {
  const [page, setPage] = useState<SidePage>("messages");
  const [collapsed, setCollapsed] = useState(false);
  const [chatTab, setChatTab] = useState<"private" | "global">("private");
  const [activeFriend, setActiveFriend] = useState<any | null>(null);
  const [activePost, setActivePost] = useState<any | null>(null);
  const [activeListing, setActiveListing] = useState<any | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Reset right pane when switching page/tab
  useEffect(() => { setActiveFriend(null); setActivePost(null); setActiveListing(null); }, [page, chatTab]);

  return (
    <div className="w-full h-[calc(100vh-4rem)] flex bg-black text-white overflow-hidden border-t border-white/5">
      {/* ===== LEFT SIDEBAR ===== */}
      <aside className={`${collapsed ? "w-16" : "w-56"} hidden md:flex flex-col border-r border-white/10 bg-black/60 backdrop-blur-xl transition-all duration-200`}>
        <div className="px-3 py-4">
          {!collapsed && <div className="text-[10px] uppercase tracking-[0.25em] text-white/40 mb-2 px-2">Navigate</div>}
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 text-white/80"
            aria-label="Toggle sidebar"
          >
            <Menu size={18} />
          </button>
        </div>
        <nav className="flex-1 px-2 space-y-1">
          <RailItem icon={MessageCircle} label="Messages" active={page === "messages"} collapsed={collapsed} onClick={() => setPage("messages")} />
          <RailItem icon={Phone} label="Phone" active={page === "phone"} collapsed={collapsed} onClick={() => setPage("phone")} />
          <RailItem icon={CircleFadingPlus} label="Status" active={page === "status"} collapsed={collapsed} onClick={() => setPage("status")} />
          <div className="h-px bg-white/10 my-2" />
          <RailItem icon={Store} label=".lit Market" active={page === "market"} collapsed={collapsed} onClick={() => setPage("market")} />
        </nav>
        <WalletFooter myName={myName} myAddress={myAddress} collapsed={collapsed} />
      </aside>

      {/* ===== MIDDLE PANE ===== */}
      <section className={`${(activeFriend || activePost || activeListing) ? "hidden md:flex" : "flex"} flex-col w-full md:w-[340px] border-r border-white/10 bg-black/30 backdrop-blur-xl`}>
        {page === "messages" && (
          <MessagesMiddle
            key={refreshKey}
            myAddress={myAddress}
            chatTab={chatTab} setChatTab={setChatTab}
            activeFriend={activeFriend} setActiveFriend={setActiveFriend}
            activePost={activePost} setActivePost={setActivePost}
          />
        )}
        {page === "market" && (
          <MarketMiddle activeListing={activeListing} setActiveListing={setActiveListing} />
        )}
        {page === "phone" && <PlaceholderMiddle title="Phone" sub="Voice & video calls coming soon" />}
        {page === "status" && <PlaceholderMiddle title="Status" sub="Ephemeral updates coming soon" />}
      </section>

      {/* ===== RIGHT PANE ===== */}
      <section className={`${(activeFriend || activePost || activeListing) ? "flex" : "hidden md:flex"} flex-1 flex-col bg-gradient-to-br from-black via-zinc-950 to-black`}>
        {page === "messages" && chatTab === "private" && activeFriend && (
          <DMChat key={activeFriend.address || activeFriend} me={myAddress} friend={activeFriend} onBack={() => setActiveFriend(null)} />
        )}
        {page === "messages" && chatTab === "global" && activePost && (
          <PostDetail post={activePost} myAddress={myAddress} onBack={() => setActivePost(null)} onChange={() => setRefreshKey((k) => k + 1)} />
        )}
        {page === "market" && activeListing && (
          <ListingDetail listing={activeListing} myAddress={myAddress} myName={myName} onBack={() => setActiveListing(null)} />
        )}
        {page === "market" && !activeListing && (
          <ListYourName myName={myName} />
        )}
        {!activeFriend && !activePost && !activeListing && page === "messages" && (
          <EmptyRight icon={MessageCircle} title="Select a conversation" sub="Your messages are signed on-chain via LIT Messenger." />
        )}
        {page === "phone" && <EmptyRight icon={Phone} title="No active call" sub="Phone module is wired but inactive." />}
        {page === "status" && <EmptyRight icon={CircleFadingPlus} title="Status feed empty" sub="No status updates from your circle." />}
      </section>
    </div>
  );
}

function RailItem({ icon: Icon, label, active, collapsed, onClick }: { icon: any; label: string; active?: boolean; collapsed?: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={`w-full flex items-center ${collapsed ? "justify-center" : "gap-3 px-3"} py-2.5 rounded-lg text-sm font-semibold transition ${active ? "bg-white text-black" : "text-white/70 hover:bg-white/5"}`}>
      <Icon size={16} />{!collapsed && <span>{label}</span>}
    </button>
  );
}

function EmptyRight({ icon: Icon, title, sub }: { icon: any; title: string; sub: string }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
      <Icon className="w-12 h-12 text-white/20 mb-4" />
      <div className="text-lg font-bold text-white/60">{title}</div>
      <div className="text-xs text-white/30 mt-1 max-w-xs">{sub}</div>
    </div>
  );
}

function PlaceholderMiddle({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
      <div className="text-lg font-bold text-white/60">{title}</div>
      <div className="text-xs text-white/30 mt-1">{sub}</div>
    </div>
  );
}

// ============================================================================
// WALLET FOOTER (Settings + name + ChevronUp dropdown)
// ============================================================================
function WalletFooter({ myName, myAddress, collapsed }: { myName: string | null; myAddress: string; collapsed?: boolean }) {
  const { disconnect } = useDisconnect();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as any)) setOpen(false); };
    document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h);
  }, []);

  const copy = async () => {
    try { await navigator.clipboard.writeText(myAddress); showInfo?.("Address copied"); } catch {}
    setOpen(false);
  };

  return (
    <div className="p-2 border-t border-white/10 space-y-1">
      <button className={`w-full flex items-center ${collapsed ? "justify-center" : "gap-3 px-3"} py-2 rounded-lg text-sm text-white/70 hover:bg-white/5`}>
        <Settings size={16} />{!collapsed && <span>Settings</span>}
      </button>
      <div ref={ref} className="relative">
        <button
          onClick={() => setOpen((o) => !o)}
          className={`w-full flex items-center ${collapsed ? "justify-center" : "gap-2 px-3"} py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10`}
        >
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-white/30 to-white/5 flex items-center justify-center text-[11px] font-black shrink-0">
            {letterOf(myName || myAddress)}
          </div>
          {!collapsed && (
            <>
              <div className="min-w-0 flex-1 text-left">
                <div className="text-xs font-bold truncate">{myName ? `${myName}.lit` : shortAddr(myAddress)}</div>
                <div className="text-[9px] text-white/40 uppercase tracking-wider">Connected</div>
              </div>
              <ChevronUp size={14} className="text-white/50" />
            </>
          )}
        </button>
        {open && (
          <div className="absolute bottom-full mb-2 left-0 right-0 bg-zinc-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50">
            <button className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-white/80 hover:bg-white/5">
              <UserIcon size={13} /> View Profile
            </button>
            <button onClick={copy} className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-white/80 hover:bg-white/5">
              <Copy size={13} /> Copy Address
            </button>
            <button onClick={() => { disconnect(); setOpen(false); }} className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-red-300 hover:bg-red-500/10">
              <LogOut size={13} /> Disconnect
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// MESSAGES MIDDLE: tabs (Private / Global), search, list
// ============================================================================
function MessagesMiddle({
  myAddress, chatTab, setChatTab, activeFriend, setActiveFriend, activePost, setActivePost,
}: any) {
  return (
    <>
      {/* Header */}
      <div className="h-12 px-3 flex items-center border-b border-white/10">
        <p className="text-sm font-bold">Chats</p>
        <div className="ml-auto flex gap-1">
          <button className="w-8 h-8 rounded-lg hover:bg-white/5 flex items-center justify-center text-white/60"><SquarePen size={14} /></button>
          <button className="w-8 h-8 rounded-lg hover:bg-white/5 flex items-center justify-center text-white/60"><ListFilter size={14} /></button>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-3 pt-3">
        <div className="flex gap-1 bg-white/5 border border-white/10 rounded-xl p-1">
          {[
            { id: "private", label: "Private" },
            { id: "global", label: "Global" },
          ].map((t) => (
            <button key={t.id} onClick={() => setChatTab(t.id)}
              className={`flex-1 px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition ${chatTab === t.id ? "bg-emerald-500 text-black" : "text-white/60 hover:text-white"}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {chatTab === "private"
        ? <PrivateList myAddress={myAddress} activeFriend={activeFriend} setActiveFriend={setActiveFriend} />
        : <GlobalList myAddress={myAddress} activePost={activePost} setActivePost={setActivePost} />}
    </>
  );
}

// -------- PRIVATE LIST --------
function PrivateList({ myAddress, activeFriend, setActiveFriend }: any) {
  const [friends, setFriends] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [f, r] = await Promise.all([
        backendGet(`/hub/messenger/friends/${myAddress}`).catch(() => ({ friends: [] })),
        backendGet(`/hub/messenger/requests/${myAddress}`).catch(() => ({ requests: [] })),
      ]);
      const rawF = Array.isArray(f?.friends) ? f.friends : [];
      const rawR = Array.isArray(r?.requests) ? r.requests : [];
      const enrich = async (list: any[], aKey: string, nKey: string) =>
        Promise.all(list.map(async (i) => {
          if (i[nKey]) return i;
          const addr = i[aKey] || i.address || i;
          try { const d = await backendGet(`/hub/name/reverse/${addr}`); return { ...i, [nKey]: d?.name || null }; }
          catch { return i; }
        }));
      const [fe, re] = await Promise.all([enrich(rawF, "address", "name"), enrich(rawR, "from", "fromName")]);
      setFriends(fe); setRequests(re);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [myAddress]);

  const visible = friends.filter((f) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (f.name || "").toLowerCase().includes(q) || (f.address || "").toLowerCase().includes(q);
  });

  return (
    <>
      <div className="px-3 py-3 flex gap-2 items-center">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search friends"
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-sm outline-none placeholder:text-white/30 focus:border-white/30" />
        </div>
        <button onClick={() => setShowAdd(true)} className="w-9 h-9 rounded-xl bg-emerald-500 text-black flex items-center justify-center font-bold hover:scale-105 transition" aria-label="Add friend">
          <Plus size={16} />
        </button>
      </div>

      {requests.length > 0 && (
        <div className="px-3 pb-2 relative">
          <div className="text-[10px] uppercase tracking-[0.2em] text-white/40 mb-1.5 flex items-center gap-2">
            Requests
            <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] text-[10px] font-bold bg-emerald-500 text-black rounded-full px-1.5">{requests.length}</span>
          </div>
          <div className="space-y-1.5">
            {requests.map((r) => <RequestRow key={r.id ?? r.reqId} req={r} onResolved={load} />)}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-1 pb-2">
        {loading && <div className="flex justify-center py-10"><Loader2 className="animate-spin text-white/40" size={20} /></div>}
        {!loading && visible.length === 0 && (
          <div className="text-center text-white/30 text-xs py-10 px-4">
            No friends yet. Tap + to add by .lit name.
          </div>
        )}
        {visible.map((f) => {
          const addr = f.address || f;
          const isActive = activeFriend && (activeFriend.address || activeFriend) === addr;
          return (
            <button key={addr} onClick={() => setActiveFriend(f)}
              className={`w-full flex items-center gap-3 px-3 py-3 text-left transition ${isActive ? "bg-white/10" : "hover:bg-white/5"}`}>
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500/30 to-emerald-500/5 border border-white/10 flex items-center justify-center font-black text-white shrink-0">
                {letterOf(f.name || addr)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold truncate">{f.name ? `${f.name}.lit` : shortAddr(addr)}</div>
                <div className="text-[11px] text-white/40 truncate">{f.lastMessage || "Start a conversation"}</div>
              </div>
            </button>
          );
        })}
      </div>

      <AnimatePresence>
        {showAdd && <AddFriendModal myAddress={myAddress} onClose={() => setShowAdd(false)} onAdded={() => { setShowAdd(false); load(); }} />}
      </AnimatePresence>
    </>
  );
}

function RequestRow({ req, onResolved }: { req: any; onResolved: () => void }) {
  const respond = async (accept: boolean) => {
    try {
      const id = req.id ?? req.reqId;
      await writeContract(LIT_MESSENGER, MESSENGER_ABI, accept ? "acceptFriendRequest" : "rejectFriendRequest", [id]);
      showSuccess({ title: accept ? "Friend added!" : "Request rejected", rows: [] });
      onResolved();
    } catch (e: any) { showError(e?.shortMessage || e?.message || "Failed"); }
  };
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-2.5 flex items-center justify-between gap-2">
      <div className="text-xs text-white truncate">{req.fromName ? `${req.fromName}.lit` : shortAddr(req.from)}</div>
      <div className="flex gap-1 shrink-0">
        <button onClick={() => respond(true)} className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center justify-center"><Check size={12} /></button>
        <button onClick={() => respond(false)} className="w-7 h-7 rounded-lg bg-red-500/20 text-red-300 border border-red-500/30 flex items-center justify-center"><X size={12} /></button>
      </div>
    </div>
  );
}

function AddFriendModal({ myAddress, onClose, onAdded }: { myAddress: string; onClose: () => void; onAdded: () => void }) {
  const [val, setVal] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!val.trim()) return;
    try {
      setBusy(true);
      let target = val.trim();
      if (!target.startsWith("0x")) {
        const r = await backendGet(`/hub/name/resolve/${target.replace(/\.lit$/i, "")}`).catch(() => null);
        target = r?.address || target;
        if (!target.startsWith("0x")) throw new Error("Name not found");
      }
      await writeContract(LIT_MESSENGER, MESSENGER_ABI, "sendFriendRequest", [target]);
      showSuccess({ title: "Friend request sent!", rows: [{ label: "To", value: shortAddr(target) }] });
      onAdded();
    } catch (e: any) { showError(e?.shortMessage || e?.message || "Failed"); }
    finally { setBusy(false); }
  };
  return (
    <ModalShell onClose={onClose}>
      <h2 className="text-xl font-black uppercase tracking-tight mb-4">Add Friend</h2>
      <input value={val} onChange={(e) => setVal(e.target.value)} placeholder=".lit name or 0x address"
        className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white text-sm outline-none mb-4" />
      <button onClick={submit} disabled={busy || !val.trim()}
        className="w-full py-3 rounded-2xl bg-emerald-500 text-black font-black uppercase tracking-[0.2em] text-sm disabled:opacity-40 flex items-center justify-center gap-2">
        {busy && <Loader2 className="animate-spin" size={14} />} Send Request
      </button>
    </ModalShell>
  );
}

// -------- GLOBAL LIST (posts feed) --------
function GlobalList({ myAddress, activePost, setActivePost }: any) {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const load = async () => {
    setLoading(true);
    try { const d = await backendGet("/hub/posts"); setPosts(Array.isArray(d?.posts) ? d.posts : []); }
    catch { setPosts([]); } finally { setLoading(false); }
  };
  useEffect(() => { load(); const t = setInterval(load, 20000); return () => clearInterval(t); }, []);

  return (
    <>
      <div className="px-3 py-3 flex gap-2 items-center">
        <div className="text-[10px] uppercase tracking-[0.2em] text-white/40 flex-1">{posts.length} posts</div>
        <button onClick={() => setShowCreate(true)} className="w-9 h-9 rounded-xl bg-emerald-500 text-black flex items-center justify-center hover:scale-105 transition">
          <Plus size={16} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-1 pb-2">
        {loading && <div className="flex justify-center py-10"><Loader2 className="animate-spin text-white/40" size={20} /></div>}
        {!loading && posts.length === 0 && <div className="text-center text-white/30 text-xs py-10">No posts yet.</div>}
        {posts.map((p) => {
          const id = p.id ?? p.postId;
          const isActive = activePost && (activePost.id ?? activePost.postId) === id;
          const bounty = String(p.bountyBalance ?? p.bounty ?? "0");
          const bountyActive = typeof p.bountyActive === "boolean" ? p.bountyActive : parseFloat(bounty) > 0;
          return (
            <button key={id} onClick={() => setActivePost(p)}
              className={`w-full flex items-start gap-3 px-3 py-3 text-left transition ${isActive ? "bg-white/10" : "hover:bg-white/5"}`}>
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500/30 to-blue-500/10 border border-white/10 flex items-center justify-center font-black text-white shrink-0">
                {letterOf(p.creatorName || p.creator)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <div className="text-sm font-bold truncate">{p.creatorName ? `${p.creatorName}.lit` : shortAddr(p.creator)}</div>
                  <div className="text-[9px] text-white/40 uppercase">POST #{id}</div>
                </div>
                <div className="text-[11px] text-white/50 truncate">{(p.content || "").slice(0, 60)}</div>
                {bountyActive && (
                  <span className="inline-block mt-1 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    {bounty} zkLTC
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
      <AnimatePresence>
        {showCreate && <CreatePostModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); setTimeout(load, 1500); }} />}
      </AnimatePresence>
    </>
  );
}

// ============================================================================
// DM CHAT (right pane)
// ============================================================================
function DMChat({ me, friend, onBack }: { me: string; friend: any; onBack: () => void }) {
  const other = friend.address || friend;
  const [msgs, setMsgs] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showZk, setShowZk] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const load = async () => {
    try {
      const d = await backendGet(`/hub/messenger/conversation/${me}/${other}`);
      setMsgs(Array.isArray(d?.messages) ? d.messages : []);
    } catch { setMsgs([]); }
    finally { setLoading(false); }
  };
  useEffect(() => { setLoading(true); load(); const t = setInterval(load, 10000); return () => clearInterval(t); }, [me, other]);
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }); }, [msgs.length]);

  const send = async () => {
    if (!text.trim()) return;
    try {
      setSending(true);
      await writeContract(LIT_MESSENGER, MESSENGER_ABI, "sendMessage", [other, text, "text"]);
      setText(""); setTimeout(load, 1500);
    } catch (e: any) { showError(e?.shortMessage || e?.message || "Send failed"); }
    finally { setSending(false); }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="h-16 px-3 border-b border-white/10 flex items-center gap-3 bg-black/40 backdrop-blur-xl">
        <button onClick={onBack} className="md:hidden text-white/60 hover:text-white"><ArrowLeft size={18} /></button>
        <div className="w-11 h-11 rounded-full bg-gradient-to-br from-emerald-500/30 to-emerald-500/5 border border-white/10 flex items-center justify-center font-black">
          {letterOf(friend.name || other)}
        </div>
        <div className="min-w-0">
          <div className="text-sm font-bold truncate">{friend.name ? `${friend.name}.lit` : shortAddr(other)}</div>
          <div className="text-[10px] text-white/40 uppercase tracking-wider">LitVM · Chain 4441</div>
        </div>
        <div className="ml-auto flex gap-1">
          <button className="w-9 h-9 rounded-lg hover:bg-white/5 flex items-center justify-center text-white/60"><Video size={16} /></button>
          <button className="w-9 h-9 rounded-lg hover:bg-white/5 flex items-center justify-center text-white/60"><Phone size={16} /></button>
          <button className="w-9 h-9 rounded-lg hover:bg-white/5 flex items-center justify-center text-white/60"><Search size={16} /></button>
        </div>
      </div>

      {/* Message area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2">
        {loading && <Loader2 className="mx-auto animate-spin text-white/40" size={20} />}
        {!loading && msgs.length === 0 && (
          <div className="text-center text-white/40 mt-20">No messages yet. Say hi! 👋</div>
        )}
        {msgs.map((m, i) => {
          const mine = (m.from || "").toLowerCase() === me.toLowerCase();
          const isTransfer = m.msgType === "transfer";
          const amount = m.amount || m.value;
          if (isTransfer) {
            return (
              <div key={i} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div className="max-w-[75%] px-4 py-3 rounded-2xl border border-emerald-500/40 bg-emerald-500/15 text-emerald-100">
                  <div className="text-xs font-bold uppercase tracking-wider opacity-70 mb-1">💸 zkLTC Transfer</div>
                  <div className="text-lg font-black">{String(amount || "0")} zkLTC sent</div>
                  {m.contentHash && <div className="text-[11px] mt-1 opacity-80">"{m.contentHash}"</div>}
                </div>
              </div>
            );
          }
          return (
            <div key={i} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm ${mine ? "bg-emerald-500 text-black" : "bg-white/10 text-white"}`}>
                {m.content || m.contentHash}
              </div>
            </div>
          );
        })}
      </div>

      {/* Input bar */}
      <div className="flex items-center gap-1 px-2 py-2 border-t border-white/10 bg-black/40">
        <button className="w-9 h-9 rounded-lg hover:bg-white/5 flex items-center justify-center text-white/60"><Smile size={18} /></button>
        <div className="relative">
          <button onClick={() => setAttachOpen((o) => !o)} className="w-9 h-9 rounded-lg hover:bg-white/5 flex items-center justify-center text-white/60"><Paperclip size={18} /></button>
          {attachOpen && (
            <div className="absolute bottom-full mb-2 left-0 bg-zinc-900 border border-white/10 rounded-xl shadow-2xl min-w-[160px] overflow-hidden z-20">
              {[{i:ImageIcon,l:"Photos"},{i:Camera,l:"Camera"},{i:FileIcon,l:"File"},{i:UserRound,l:"Contact"}].map(({i:Ic,l}) => (
                <button key={l} onClick={() => setAttachOpen(false)} className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-white/80 hover:bg-white/5"><Ic size={13} /> {l}</button>
              ))}
            </div>
          )}
        </div>
        <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Type a message"
          className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-white/30" />
        <button onClick={() => setShowZk(true)} className="px-3 h-9 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold flex items-center gap-1 hover:bg-emerald-500/30">💸</button>
        <button onClick={send} disabled={sending || !text.trim()} className="w-9 h-9 rounded-lg bg-emerald-500 text-black flex items-center justify-center disabled:opacity-40">
          {sending ? <Loader2 className="animate-spin" size={14} /> : <Send size={16} />}
        </button>
        <button className="w-9 h-9 rounded-lg hover:bg-white/5 flex items-center justify-center text-white/60"><Mic size={18} /></button>
      </div>

      <AnimatePresence>
        {showZk && <SendZkMiniModal to={other} onClose={() => setShowZk(false)} onSent={() => { setShowZk(false); setTimeout(load, 1500); }} />}
      </AnimatePresence>
    </div>
  );
}

function SendZkMiniModal({ to, onClose, onSent }: { to: string; onClose: () => void; onSent: () => void }) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const send = async () => {
    if (!amount || isNaN(Number(amount))) return;
    try {
      setBusy(true);
      await writeContract(LIT_MESSENGER, MESSENGER_ABI, "sendZkLTC", [to, note || "DM gift"], parseEther(amount));
      showSuccess({ title: "zkLTC sent!", rows: [{ label: "Amount", value: `${amount} zkLTC` }, { label: "To", value: shortAddr(to) }] });
      onSent();
    } catch (e: any) { showError(e?.shortMessage || e?.message || "Send failed"); }
    finally { setBusy(false); }
  };
  return (
    <ModalShell onClose={onClose}>
      <h2 className="text-lg font-black uppercase tracking-tight mb-4">Send zkLTC</h2>
      <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount" className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm outline-none mb-2" />
      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm outline-none mb-4" />
      <button onClick={send} disabled={busy || !amount} className="w-full py-3 rounded-2xl bg-emerald-500 text-black font-black uppercase tracking-[0.2em] text-sm disabled:opacity-40 flex items-center justify-center gap-2">
        {busy && <Loader2 className="animate-spin" size={14} />} Send
      </button>
    </ModalShell>
  );
}

// ============================================================================
// GLOBAL POST DETAIL (right pane)
// ============================================================================
function PostDetail({ post, myAddress, onBack, onChange }: { post: any; myAddress: string; onBack: () => void; onChange: () => void }) {
  const postId = post.id ?? post.postId;
  const creator = post.creator || "";
  const creatorName = post.creatorName;
  const content = post.content || "";
  const likes = String(post.likeCount ?? post.likes ?? "0");
  const comments = String(post.commentCount ?? post.comments ?? "0");
  const bounty = String(post.bountyBalance ?? post.bounty ?? "0");
  const bountyActive = typeof post.bountyActive === "boolean" ? post.bountyActive : parseFloat(bounty) > 0;
  const [hasLiked, setHasLiked] = useState(false);
  const [liking, setLiking] = useState(false);
  const [commentList, setCommentList] = useState<any[]>([]);
  const [commentText, setCommentText] = useState("");
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const provider = new BrowserProvider((window as any).ethereum);
        const c = new Contract(HUB_POSTS, POSTS_ABI, provider);
        setHasLiked(await c.hasLiked(postId, myAddress));
      } catch {}
      try {
        const d = await backendGet(`/hub/posts/${postId}/comments`).catch(() => null);
        if (d && Array.isArray(d.comments)) setCommentList(d.comments);
      } catch {}
    })();
  }, [postId, myAddress]);

  const like = async () => {
    if (hasLiked) return;
    try { setLiking(true); await writeContract(HUB_POSTS, POSTS_ABI, "likePost", [postId]); setHasLiked(true); onChange(); }
    catch (e: any) { showError(e?.shortMessage || e?.message || "Like failed"); }
    finally { setLiking(false); }
  };
  const comment = async () => {
    if (!commentText.trim()) return;
    try { setPosting(true); await writeContract(HUB_POSTS, POSTS_ABI, "commentPost", [postId, commentText]); setCommentText(""); onChange(); }
    catch (e: any) { showError(e?.shortMessage || e?.message || "Comment failed"); }
    finally { setPosting(false); }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="h-16 px-3 border-b border-white/10 flex items-center gap-3 bg-black/40 backdrop-blur-xl">
        <button onClick={onBack} className="md:hidden text-white/60 hover:text-white"><ArrowLeft size={18} /></button>
        <div className="w-11 h-11 rounded-full bg-gradient-to-br from-emerald-500/30 to-blue-500/10 border border-white/10 flex items-center justify-center font-black">
          {letterOf(creatorName || creator)}
        </div>
        <div>
          <div className="text-sm font-bold">{creatorName ? `${creatorName}.lit` : shortAddr(creator)}</div>
          <div className="text-[10px] text-white/40 uppercase tracking-wider">Post #{postId}</div>
        </div>
        {bountyActive && (
          <span className="ml-auto text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            {bounty} zkLTC
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        <p className="text-white/90 whitespace-pre-wrap text-base leading-relaxed mb-5">{content}</p>
        <div className="flex gap-2 mb-6">
          <button onClick={like} disabled={liking || hasLiked}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold border transition ${hasLiked ? "bg-red-500/20 text-red-300 border-red-500/30" : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10"} disabled:opacity-50`}>
            <Heart size={14} fill={hasLiked ? "currentColor" : "none"} /> {likes}
          </button>
          <div className="px-4 py-2 rounded-xl text-xs font-bold bg-white/5 border border-white/10 text-white/70 flex items-center gap-2">
            <MessageCircle size={14} /> {comments}
          </div>
        </div>

        <div className="text-[10px] uppercase tracking-[0.2em] text-white/40 mb-2">Comments</div>
        <div className="space-y-2 mb-4">
          {commentList.length === 0 && <div className="text-xs text-white/30">No comments yet.</div>}
          {commentList.map((c, i) => (
            <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-3">
              <div className="text-[11px] text-white/40 mb-1">{c.authorName ? `${c.authorName}.lit` : shortAddr(c.author)}</div>
              <div className="text-sm text-white/90">{c.text || c.content}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="p-3 border-t border-white/10 flex gap-2 bg-black/40">
        <input value={commentText} onChange={(e) => setCommentText(e.target.value)} placeholder="Write a comment..."
          className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm outline-none focus:border-white/30" />
        <button onClick={comment} disabled={posting || !commentText.trim()} className="px-4 rounded-xl bg-emerald-500 text-black text-xs font-bold disabled:opacity-40">
          {posting ? <Loader2 className="animate-spin" size={14} /> : "Post"}
        </button>
      </div>
    </div>
  );
}

function CreatePostModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [content, setContent] = useState("");
  const [withBounty, setWithBounty] = useState(false);
  const [likeR, setLikeR] = useState("0.01");
  const [commentR, setCommentR] = useState("0.01");
  const [budget, setBudget] = useState("0.1");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!content.trim()) return;
    try {
      setBusy(true);
      const lr = withBounty ? parseEther(likeR || "0") : 0n;
      const cr = withBounty ? parseEther(commentR || "0") : 0n;
      const val = withBounty ? parseEther(budget || "0") : 0n;
      await writeContract(HUB_POSTS, POSTS_ABI, "createPost", [content, lr, cr], val);
      showSuccess({ title: "Post created!", rows: [] });
      onCreated();
    } catch (e: any) { showError(e?.shortMessage || e?.message || "Post failed"); }
    finally { setBusy(false); }
  };
  return (
    <ModalShell onClose={onClose}>
      <h2 className="text-xl font-black uppercase tracking-tight mb-4">Create Post</h2>
      <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Share something..." rows={4}
        className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white text-sm outline-none focus:border-white/30 mb-4" />
      <label className="flex items-center gap-2 mb-4 cursor-pointer">
        <input type="checkbox" checked={withBounty} onChange={(e) => setWithBounty(e.target.checked)} className="accent-emerald-500" />
        <span className="text-sm text-white/80">Add bounty</span>
      </label>
      {withBounty && (
        <div className="grid grid-cols-3 gap-2 mb-4">
          <input value={likeR} onChange={(e) => setLikeR(e.target.value)} placeholder="Like" className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm outline-none" />
          <input value={commentR} onChange={(e) => setCommentR(e.target.value)} placeholder="Comment" className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm outline-none" />
          <input value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="Budget" className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm outline-none" />
        </div>
      )}
      <button onClick={submit} disabled={busy || !content.trim()}
        className="w-full py-3 rounded-2xl bg-emerald-500 text-black font-black uppercase tracking-[0.2em] text-sm disabled:opacity-40 flex items-center justify-center gap-2">
        {busy && <Loader2 className="animate-spin" size={14} />} Post
      </button>
    </ModalShell>
  );
}

// ============================================================================
// .LIT MARKET
// ============================================================================
function MarketMiddle({ activeListing, setActiveListing }: any) {
  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    try { const d = await backendGet("/hub/marketplace/listings"); setListings(Array.isArray(d?.listings) ? d.listings : []); }
    catch { setListings([]); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const visible = listings.filter((l) => !search.trim() || (l.name || "").toLowerCase().includes(search.toLowerCase()));

  const timeAgo = (ts?: number) => {
    if (!ts) return "Recently";
    const sec = Math.floor((Date.now() - ts * 1000) / 1000);
    if (sec < 60) return `${sec}s ago`;
    if (sec < 3600) return `${Math.floor(sec/60)} mins ago`;
    if (sec < 86400) return `${Math.floor(sec/3600)} hrs ago`;
    return `${Math.floor(sec/86400)}d ago`;
  };

  return (
    <>
      <div className="h-12 px-3 flex items-center border-b border-white/10">
        <p className="text-sm font-bold">Marketplace</p>
        <button onClick={load} className="ml-auto w-8 h-8 rounded-lg hover:bg-white/5 flex items-center justify-center text-white/60"><ListFilter size={14} /></button>
      </div>
      <div className="px-3 py-3">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search listings"
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-sm outline-none placeholder:text-white/30 focus:border-white/30" />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-1 pb-2">
        {loading && <div className="flex justify-center py-10"><Loader2 className="animate-spin text-white/40" size={20} /></div>}
        {!loading && visible.length === 0 && <div className="text-center text-white/30 text-xs py-10">No active listings.</div>}
        {visible.map((l) => {
          const isActive = activeListing?.name === l.name;
          return (
            <button key={l.name} onClick={() => setActiveListing(l)}
              className={`w-full flex items-center gap-3 px-3 py-3 text-left transition ${isActive ? "bg-white/10" : "hover:bg-white/5"}`}>
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500/30 to-emerald-500/5 border border-white/10 flex items-center justify-center font-black">
                {letterOf(l.name)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold truncate">{l.name}.lit</div>
                <div className="text-[11px] text-emerald-300">{String(l.price ?? "0")} zkLTC</div>
                <div className="text-[10px] text-white/40">Listed {timeAgo(l.listedAt)}</div>
              </div>
            </button>
          );
        })}
      </div>
    </>
  );
}

function ListingDetail({ listing, myAddress, myName, onBack }: { listing: any; myAddress: string; myName: string; onBack: () => void }) {
  const [bidAmt, setBidAmt] = useState("");
  const [bids, setBids] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    backendGet(`/hub/marketplace/bids/${listing.name}`)
      .then((d) => setBids(Array.isArray(d?.bids) ? d.bids : []))
      .catch(() => setBids([]));
  }, [listing.name]);

  const buy = async () => {
    try { setBusy(true); await writeContract(LIT_MARKETPLACE, MARKETPLACE_ABI, "buyName", [listing.name], parseEther(String(listing.price || "0")));
      showSuccess({ title: "Name purchased!", rows: [{ label: "Name", value: `${listing.name}.lit` }] }); onBack(); }
    catch (e: any) { showError(e?.shortMessage || e?.message || "Buy failed"); }
    finally { setBusy(false); }
  };
  const bid = async () => {
    if (!bidAmt) return;
    try { setBusy(true); await writeContract(LIT_MARKETPLACE, MARKETPLACE_ABI, "placeBid", [listing.name], parseEther(bidAmt));
      showSuccess({ title: "Bid placed!", rows: [{ label: "Amount", value: `${bidAmt} zkLTC` }] }); setBidAmt(""); }
    catch (e: any) { showError(e?.shortMessage || e?.message || "Bid failed"); }
    finally { setBusy(false); }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="h-16 px-3 border-b border-white/10 flex items-center gap-3 bg-black/40 backdrop-blur-xl">
        <button onClick={onBack} className="md:hidden text-white/60 hover:text-white"><ArrowLeft size={18} /></button>
        <Store size={20} className="text-emerald-300" />
        <div className="text-sm font-bold">Listing Detail</div>
      </div>
      <div className="flex-1 overflow-y-auto p-6">
        <div className="text-center mb-6">
          <div className="text-4xl font-black tracking-tight mb-2">{listing.name}.lit</div>
          <div className="text-xs text-white/40">Seller: {shortAddr(listing.seller)}</div>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-3xl p-5 mb-4">
          <div className="text-[10px] uppercase tracking-[0.2em] text-white/40 mb-1">Price</div>
          <div className="text-3xl font-black text-emerald-300">{String(listing.price ?? "0")} zkLTC</div>
        </div>
        <div className="flex gap-2 mb-6">
          <button onClick={buy} disabled={busy} className="flex-1 py-3 rounded-2xl bg-emerald-500 text-black font-black uppercase tracking-[0.2em] text-sm disabled:opacity-40 flex items-center justify-center gap-2">
            {busy && <Loader2 className="animate-spin" size={14} />} Buy Now
          </button>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-4 flex gap-2">
          <input value={bidAmt} onChange={(e) => setBidAmt(e.target.value)} placeholder="Bid amount (zkLTC)" className="flex-1 bg-transparent text-sm outline-none placeholder:text-white/30" />
          <button onClick={bid} disabled={busy || !bidAmt} className="px-4 py-2 rounded-xl bg-white/10 border border-white/10 text-xs font-bold disabled:opacity-40">Place Bid</button>
        </div>
        <div className="text-[10px] uppercase tracking-[0.2em] text-white/40 mb-2">Bids ({bids.length})</div>
        <div className="space-y-2">
          {bids.length === 0 && <div className="text-xs text-white/30">No bids yet.</div>}
          {bids.map((b, i) => (
            <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center justify-between">
              <div className="text-xs text-white/70">{shortAddr(b.bidder)}</div>
              <div className="text-sm font-bold text-emerald-300">{String(b.amount)} zkLTC</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ListYourName({ myName }: { myName: string }) {
  const [price, setPrice] = useState("");
  const [busy, setBusy] = useState(false);
  const listMine = async () => {
    if (!myName || !price) return;
    try {
      setBusy(true);
      showInfo?.("Approving marketplace...");
      await writeContract(LIT_NAME_REGISTRY, REGISTRY_ABI, "setOperatorApproval", [LIT_MARKETPLACE, true]);
      await writeContract(LIT_MARKETPLACE, MARKETPLACE_ABI, "listName", [myName, parseEther(price)]);
      showSuccess({ title: "Listed!", rows: [{ label: "Name", value: `${myName}.lit` }, { label: "Price", value: `${price} zkLTC` }] });
      setPrice("");
    } catch (e: any) { showError(e?.shortMessage || e?.message || "List failed"); }
    finally { setBusy(false); }
  };
  return (
    <div className="flex flex-col h-full">
      <div className="h-16 px-4 border-b border-white/10 flex items-center bg-black/40 backdrop-blur-xl">
        <Store size={20} className="text-emerald-300 mr-2" />
        <div className="text-sm font-bold">.lit Market</div>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        <div className="w-full max-w-md bg-white/5 border border-white/10 rounded-3xl p-6">
          <div className="text-[10px] uppercase tracking-[0.2em] text-white/40 mb-2">List Your Name</div>
          <div className="text-2xl font-black mb-4">{myName}.lit</div>
          <input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Price (zkLTC)"
            className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm outline-none mb-4" />
          <button onClick={listMine} disabled={busy || !price}
            className="w-full py-3 rounded-2xl bg-emerald-500 text-black font-black uppercase tracking-[0.2em] text-sm disabled:opacity-40 flex items-center justify-center gap-2">
            {busy && <Loader2 className="animate-spin" size={14} />} <Tag size={14} /> List for Sale
          </button>
        </div>
        <p className="text-xs text-white/30 mt-4">Select a listing from the left to view details</p>
      </div>
    </div>
  );
}

// ============================================================================
// REGISTER NAME (unchanged behavior)
// ============================================================================
function RegisterNameModal({ onRegistered }: { onRegistered: (n: string) => void }) {
  const [name, setName] = useState("");
  const [available, setAvailable] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);
  const [duration, setDuration] = useState<number>(1);
  const [submitting, setSubmitting] = useState(false);
  const debounceRef = useRef<number | null>(null);
  const selected = DURATIONS.find((d) => d.id === duration) || DURATIONS[0];

  useEffect(() => {
    if (!name || name.length < 3) { setAvailable(null); return; }
    setChecking(true);
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(async () => {
      try { const d = await backendGet(`/hub/name/available/${name}`); setAvailable(!!d.available); }
      catch {
        try { const provider = new BrowserProvider((window as any).ethereum);
          const c = new Contract(LIT_NAME_REGISTRY, REGISTRY_ABI, provider);
          setAvailable(await c.isAvailable(name)); } catch { setAvailable(null); }
      } finally { setChecking(false); }
    }, 400);
  }, [name]);

  const register = async () => {
    if (!name || !available) return;
    try {
      setSubmitting(true);
      const eth = (window as any).ethereum;
      let chainId = await eth.request({ method: "eth_chainId" });
      if (chainId?.toLowerCase() !== LITVM_CHAIN_HEX.toLowerCase()) {
        try { await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: LITVM_CHAIN_HEX }] }); }
        catch (e: any) {
          if (e?.code === 4902) await eth.request({ method: "wallet_addEthereumChain", params: [{ chainId: LITVM_CHAIN_HEX, chainName: "LitVM LiteForge", rpcUrls: ["https://liteforge.rpc.caldera.xyz/http"], nativeCurrency: { name: "zkLTC", symbol: "zkLTC", decimals: 18 }, blockExplorerUrls: ["https://liteforge.explorer.caldera.xyz"] }] });
          else throw e;
        }
      }
      const provider = new ethers.BrowserProvider(eth);
      const signer = await provider.getSigner();
      const registry = new ethers.Contract(LIT_NAME_REGISTRY, REGISTRY_ABI, signer);
      const price = await registry.getPrice(duration);
      const tx = await registry.register(name, duration, { value: price });
      await tx.wait();
      showSuccess({ title: `✓ ${name}.lit registered!`, rows: [{ label: "Name", value: `${name}.lit` }, { label: "Duration", value: selected.label }] });
      onRegistered(name);
    } catch (e: any) { showError(e?.message || "Registration failed"); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="relative bg-zinc-900 border border-white/10 rounded-3xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
      <div className="text-center mb-6">
        <Sparkles className="w-10 h-10 text-emerald-300 mx-auto mb-3" />
        <h2 className="text-2xl font-black uppercase tracking-tight">Claim Your .lit Name</h2>
        <p className="text-sm text-white/50 mt-2">Your identity on the LitVM social layer.</p>
      </div>
      <div className="relative mb-4">
        <input value={name} onChange={(e) => setName(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ""))} placeholder="yourname"
          className="w-full bg-white/5 border border-white/10 rounded-2xl pl-4 pr-20 py-4 text-lg font-bold outline-none focus:border-white/30" />
        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 font-bold">.lit</span>
      </div>
      {name.length >= 3 && (
        <div className="mb-4 text-sm">
          {checking ? <span className="text-white/40">Checking...</span> :
            available === true ? <span className="text-emerald-400 font-bold">✓ Available</span> :
            available === false ? <span className="text-red-400 font-bold">✗ Taken</span> : null}
        </div>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-6">
        {DURATIONS.map((d) => (
          <button key={d.id} onClick={() => setDuration(d.id)}
            className={`p-3 rounded-xl border text-xs font-bold ${duration === d.id ? "bg-emerald-500 text-black border-emerald-500" : "bg-white/5 border-white/10 text-white/70 hover:border-white/30"}`}>
            <div className="uppercase tracking-wider">{d.label}</div>
            <div className="mt-1 opacity-80">{d.price} zkLTC</div>
          </button>
        ))}
      </div>
      <button onClick={register} disabled={!available || submitting}
        className="w-full py-4 rounded-2xl bg-emerald-500 text-black font-black uppercase tracking-[0.2em] text-sm disabled:opacity-40 flex items-center justify-center gap-2">
        {submitting && <Loader2 className="animate-spin" size={16} />} Register · {selected.price} zkLTC
      </button>
    </div>
  );
}

// ============================================================================
// MODAL SHELL
// ============================================================================
function ModalShell({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[10000] bg-black/80 backdrop-blur-xl flex items-center justify-center p-4" onClick={onClose}>
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="relative bg-zinc-900 border border-white/10 rounded-3xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/60 hover:text-white">
          <X size={16} />
        </button>
        {children}
      </motion.div>
    </motion.div>
  );
}
