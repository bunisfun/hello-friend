import React, { useEffect, useMemo, useRef, useState } from "react";
import { useAccount } from "wagmi";
import { ethers, BrowserProvider, Contract, formatEther, parseEther } from "ethers";
import { motion, AnimatePresence } from "framer-motion";
import {
  Globe, Users, Store, Send, Heart, MessageCircle, Share2, Plus,
  Sparkles, X, Check, ArrowRight, Loader2, Wallet, Tag,
  Search, Settings, SquarePen, ListFilter, Menu, ArrowLeft,
} from "lucide-react";
import { showSuccess, showError, showInfo } from "@/lib/feedback";

// ============ CONTRACT ADDRESSES ============
const LIT_NAME_REGISTRY = "0x3E3aEE6d154f881A7418b2dA50c915C34664C2A8";
const HUB_POSTS = "0x33690545061cF3759350dd2C5A0d1080D9A14D73";
const LIT_MARKETPLACE = "0x9cc6e4BB66EC19475d9db8082482Eb272cf6eA02";
const LIT_MESSENGER = "0x69405b51963D592C6CA9350F774045d4E76c89B8";
const LIT_TRANSFER = "0xaA6154Fa2E03A2dFf6b4Ca85f31334652C2dcF11";
const BACKEND_URL = "https://hub.test-hub.xyz";
const LITVM_CHAIN_ID = 4441;
const LITVM_CHAIN_HEX = "0x1159";
const EXPLORER = "https://liteforge.explorer.caldera.xyz";

// ============ ABIs ============
const REGISTRY_ABI = [
  "function register(string name, uint8 duration) external payable",
  "function isAvailable(string name) external view returns (bool)",
  "function resolve(string name) external view returns (address)",
  "function reverseResolve(address wallet) external view returns (string)",
  "function getPrice(uint8 duration) external view returns (uint256)",
  "function setProfile(string name, string avatar, string bio) external",
  "function transfer(string name, address to) external",
  "function setOperatorApproval(address operator, bool approved) external",
];
const POSTS_ABI = [
  "function createPost(string content, uint256 likeReward, uint256 commentReward) payable returns (uint256)",
  "function likePost(uint256 postId)",
  "function commentPost(uint256 postId, string text)",
  "function rechargeBounty(uint256 postId) payable",
  "function withdrawBounty(uint256 postId)",
  "function hasLiked(uint256, address) view returns (bool)",
  "function hasCommented(uint256, address) view returns (bool)",
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
  "function blockUser(address user)",
  "function isFriend(address, address) view returns (bool)",
];
const TRANSFER_ABI = [
  "function sendToName(string toLitName, string note) payable",
  "function sendToAddress(address to, string note) payable",
  "function multiSendToNames(string[] names, uint256[] amounts, string note) payable",
];

// Duration enum mapping
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
        params: [{ chainId: "0x" + LITVM_CHAIN_ID.toString(16) }],
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

// ============ Main Hub Page ============
export default function HubPage() {
  const { address, isConnected } = useAccount();
  const [myName, setMyName] = useState<string | null>(null);
  const [checkingName, setCheckingName] = useState(true);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);

  // Check if user has a .lit name
  useEffect(() => {
    if (!isConnected || !address) return;
    setCheckingName(true);
    fetch(`${BACKEND_URL}/hub/name/reverse/${address}`)
      .then(async (r) => {
        if (!r.ok) throw new Error("no name");
        const data = await r.json();
        return data?.name || null;
      })
      .catch(async () => {
        // fallback to on-chain
        try {
          const provider = new BrowserProvider((window as any).ethereum);
          const c = new Contract(LIT_NAME_REGISTRY, REGISTRY_ABI, provider);
          const n: string = await c.reverseResolve(address);
          return n && n.length > 0 ? n : null;
        } catch {
          return null;
        }
      })
      .then((name) => {
        setMyName(name);
        setShowRegisterModal(!name);
      })
      .finally(() => setCheckingName(false));
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

  // Blocking registration: hide all hub content until user registers a .lit name
  if (!checkingName && !myName) {
    return (
      <div className="fixed inset-0 z-[99999] bg-black/95 backdrop-blur-2xl flex items-center justify-center p-4 overflow-hidden">
        <RegisterNameModal onRegistered={(n) => { setMyName(n); setShowRegisterModal(false); }} />
      </div>
    );
  }

  return (
    <>
      {checkingName ? (
        <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-white/40 animate-spin" /></div>
      ) : (
        <ChatShell myAddress={address!} myName={myName} onOpenSend={() => setShowSendModal(true)} />
      )}
      <AnimatePresence>
        {showSendModal && <SendZkLTCModal onClose={() => setShowSendModal(false)} />}
      </AnimatePresence>
    </>
  );
}

// ============ Chat Shell (WhatsApp-style 3-pane layout) ============
function ChatShell({ myAddress, myName, onOpenSend }: { myAddress: string; myName: string | null; onOpenSend: () => void }) {
  const [pane, setPane] = useState<"chats" | "market">("chats");
  const [chatTab, setChatTab] = useState<"private" | "global">("private");
  const [activeDM, setActiveDM] = useState<any | null>(null);
  const [activeGlobal, setActiveGlobal] = useState(false);
  const [search, setSearch] = useState("");
  const [friends, setFriends] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  const loadFriends = async () => {
    setLoading(true);
    try {
      const [f, r] = await Promise.all([
        backendGet(`/hub/messenger/friends/${myAddress}`).catch(() => ({ friends: [] })),
        backendGet(`/hub/messenger/requests/${myAddress}`).catch(() => ({ requests: [] })),
      ]);
      const rawFriends = Array.isArray(f?.friends) ? f.friends : [];
      const rawRequests = Array.isArray(r?.requests) ? r.requests : [];
      const enrich = async (list: any[], addrKey: string, nameKey: string) =>
        Promise.all(list.map(async (item) => {
          if (item[nameKey]) return item;
          const addr = item[addrKey] || item.address || item;
          try { const d = await backendGet(`/hub/name/reverse/${addr}`); return { ...item, [nameKey]: d?.name || null }; }
          catch { return item; }
        }));
      const [fe, re] = await Promise.all([
        enrich(rawFriends, "address", "name"),
        enrich(rawRequests, "from", "fromName"),
      ]);
      setFriends(fe); setRequests(re);
    } finally { setLoading(false); }
  };

  useEffect(() => { loadFriends(); }, [myAddress]);

  const visibleFriends = friends.filter((f) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (f.name || "").toLowerCase().includes(q) || (f.address || "").toLowerCase().includes(q);
  });

  // mobile: show right pane only when an item is active
  const hasActive = activeDM || activeGlobal;

  return (
    <div className="w-full h-[calc(100vh-4rem)] flex bg-black text-white overflow-hidden">
      {/* ============ LEFT RAIL ============ */}
      <aside className="hidden md:flex w-[200px] flex-col border-r border-white/10 bg-black/40 backdrop-blur-xl">
        <div className="px-4 py-4 border-b border-white/10">
          <div className="text-[10px] uppercase tracking-[0.25em] text-white/40">Navigate</div>
        </div>
        <nav className="flex-1 px-2 py-3 space-y-1">
          <RailItem icon={Store} label=".lit Market" active={pane === "market"} onClick={() => setPane("market")} />
          <RailItem icon={MessageCircle} label="Chats" active={pane === "chats"} onClick={() => setPane("chats")} />
          <RailItem icon={Send} label="Send zkLTC" onClick={onOpenSend} />
        </nav>
        <div className="px-2 pb-3 space-y-1">
          <RailItem icon={Settings} label="Settings" onClick={() => {}} />
          <div className="mt-2 px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-white/30 to-white/5 flex items-center justify-center text-[11px] font-black">
              {(myName || myAddress).slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold truncate">{myName ? `${myName}.lit` : shortAddr(myAddress)}</div>
              <div className="text-[9px] text-white/40 uppercase tracking-wider">Online</div>
            </div>
          </div>
        </div>
      </aside>

      {/* mobile top rail */}
      <div className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-black/90 backdrop-blur-xl border-t border-white/10 flex">
        {[
          { id: "chats", label: "Chats", icon: MessageCircle },
          { id: "market", label: ".lit Market", icon: Store },
        ].map((it) => {
          const Icon = it.icon;
          const active = pane === it.id;
          return (
            <button key={it.id} onClick={() => { setPane(it.id as any); setActiveDM(null); setActiveGlobal(false); }}
              className={`flex-1 flex flex-col items-center gap-1 py-2.5 text-[10px] font-bold uppercase tracking-wider ${active ? "text-white" : "text-white/40"}`}>
              <Icon size={18} />{it.label}
            </button>
          );
        })}
        <button onClick={onOpenSend} className="flex-1 flex flex-col items-center gap-1 py-2.5 text-[10px] font-bold uppercase tracking-wider text-white/40">
          <Send size={18} />Send
        </button>
      </div>

      {/* ============ MAIN AREA ============ */}
      {pane === "market" ? (
        <main className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 pb-24 md:pb-6">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-2xl font-black uppercase tracking-tight mb-4">.lit Market</h2>
            <MarketTab myAddress={myAddress} myName={myName} />
          </div>
        </main>
      ) : (
        <>
          {/* MIDDLE PANE: contacts */}
          <section className={`${hasActive ? "hidden md:flex" : "flex"} flex-col w-full md:w-[340px] border-r border-white/10 bg-black/30 backdrop-blur-xl`}>
            {/* tabs header */}
            <div className="px-4 pt-4 pb-2 flex items-center justify-between">
              <div className="flex gap-1 bg-white/5 border border-white/10 rounded-xl p-1">
                {[
                  { id: "private", label: "Private" },
                  { id: "global", label: "Global" },
                ].map((t) => (
                  <button key={t.id} onClick={() => { setChatTab(t.id as any); setActiveDM(null); setActiveGlobal(false); }}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition ${chatTab === t.id ? "bg-white text-black" : "text-white/60 hover:text-white"}`}>
                    {t.label}
                  </button>
                ))}
              </div>
              <div className="flex gap-1">
                {chatTab === "private" && (
                  <button onClick={() => setShowAdd((s) => !s)} className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/70 hover:bg-white/10">
                    <SquarePen size={14} />
                  </button>
                )}
                <button className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/70 hover:bg-white/10">
                  <ListFilter size={14} />
                </button>
              </div>
            </div>

            {/* search */}
            <div className="px-4 pb-3">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                <input
                  value={search} onChange={(e) => setSearch(e.target.value)}
                  placeholder={chatTab === "private" ? "Search friends" : "Search rooms"}
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-sm outline-none placeholder:text-white/30 focus:border-white/30"
                />
              </div>
            </div>

            {/* add-friend inline */}
            {chatTab === "private" && showAdd && (
              <AddFriendInline myAddress={myAddress} onAdded={() => { setShowAdd(false); loadFriends(); }} />
            )}

            {/* requests */}
            {chatTab === "private" && requests.length > 0 && (
              <div className="px-4 pb-2">
                <div className="text-[10px] uppercase tracking-[0.2em] text-white/40 mb-1.5">Requests ({requests.length})</div>
                <div className="space-y-1.5">
                  {requests.map((r) => (
                    <FriendRequestRow key={r.id ?? r.reqId} req={r} onResolved={loadFriends} />
                  ))}
                </div>
              </div>
            )}

            {/* list */}
            <div className="flex-1 overflow-y-auto px-2 pb-24 md:pb-2">
              {chatTab === "private" ? (
                <>
                  {loading && <div className="flex justify-center py-10"><Loader2 className="animate-spin text-white/40" size={20} /></div>}
                  {!loading && visibleFriends.length === 0 && (
                    <div className="text-center text-white/30 text-xs py-10 px-4">
                      No friends yet. Tap <SquarePen size={12} className="inline" /> to add by .lit name.
                    </div>
                  )}
                  {visibleFriends.map((f) => (
                    <ContactRow key={f.address || f} friend={f} active={activeDM && (activeDM.address || activeDM) === (f.address || f)}
                      onClick={() => { setActiveDM(f); setActiveGlobal(false); }} />
                  ))}
                </>
              ) : (
                <GlobalRoomList active={activeGlobal} onOpen={() => { setActiveGlobal(true); setActiveDM(null); }} />
              )}
            </div>
          </section>

          {/* RIGHT PANE: active chat */}
          <section className={`${hasActive ? "flex" : "hidden md:flex"} flex-1 flex-col bg-gradient-to-br from-black via-zinc-950 to-black`}>
            {activeDM ? (
              <DMChat me={myAddress} friend={activeDM} onBack={() => setActiveDM(null)} />
            ) : activeGlobal ? (
              <GlobalRoomChat myName={myName} myAddress={myAddress} onBack={() => setActiveGlobal(false)} />
            ) : (
              <div className="flex-1 hidden md:flex flex-col items-center justify-center text-center px-6">
                <MessageCircle className="w-12 h-12 text-white/20 mb-4" />
                <div className="text-lg font-bold text-white/60">Select a conversation</div>
                <div className="text-xs text-white/30 mt-1">Your messages are signed on-chain via LIT Messenger.</div>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function RailItem({ icon: Icon, label, active, onClick }: { icon: any; label: string; active?: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition ${active ? "bg-white text-black" : "text-white/70 hover:bg-white/5"}`}>
      <Icon size={16} />{label}
    </button>
  );
}

function ContactRow({ friend, active, onClick }: { friend: any; active?: boolean; onClick: () => void }) {
  const addr = friend.address || friend;
  const name = friend.name;
  return (
    <button onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition ${active ? "bg-white/10" : "hover:bg-white/5"}`}>
      <div className="w-11 h-11 rounded-full bg-gradient-to-br from-white/25 to-white/5 flex items-center justify-center font-black text-white shrink-0">
        {((name || addr || "?") as string).slice(0, 1).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-bold truncate">{name ? `${name}.lit` : shortAddr(addr)}</div>
        <div className="text-[11px] text-white/40 truncate">{shortAddr(addr)}</div>
      </div>
    </button>
  );
}

function FriendRequestRow({ req, onResolved }: { req: any; onResolved: () => void }) {
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
        <button onClick={() => respond(true)} className="w-7 h-7 rounded-lg bg-green-500/20 text-green-300 border border-green-500/30 flex items-center justify-center"><Check size={12} /></button>
        <button onClick={() => respond(false)} className="w-7 h-7 rounded-lg bg-red-500/20 text-red-300 border border-red-500/30 flex items-center justify-center"><X size={12} /></button>
      </div>
    </div>
  );
}

function AddFriendInline({ myAddress, onAdded }: { myAddress: string; onAdded: () => void }) {
  const [val, setVal] = useState("");
  const [adding, setAdding] = useState(false);
  const add = async () => {
    if (!val.trim()) return;
    try {
      setAdding(true);
      let target = val.trim();
      if (!target.startsWith("0x")) {
        const r = await backendGet(`/hub/name/resolve/${target.replace(/\.lit$/i, "")}`).catch(() => null);
        target = r?.address || target;
        if (!target.startsWith("0x")) throw new Error("Name not found");
      }
      await writeContract(LIT_MESSENGER, MESSENGER_ABI, "sendFriendRequest", [target]);
      showSuccess({ title: "Friend request sent!", rows: [{ label: "To", value: shortAddr(target) }] });
      setVal(""); onAdded();
    } catch (e: any) { showError(e?.shortMessage || e?.message || "Failed"); }
    finally { setAdding(false); }
  };
  return (
    <div className="px-4 pb-3 flex gap-2">
      <input value={val} onChange={(e) => setVal(e.target.value)} placeholder=".lit name or 0x..." className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none placeholder:text-white/30" />
      <button onClick={add} disabled={adding} className="px-3 py-2 rounded-xl bg-white text-black text-xs font-bold disabled:opacity-40">
        {adding ? <Loader2 className="animate-spin" size={12} /> : "Add"}
      </button>
    </div>
  );
}

// ============ Global Room (placeholder shell — backend hook comes next) ============
function GlobalRoomList({ active, onOpen }: { active: boolean; onOpen: () => void }) {
  return (
    <div className="px-1 pt-1">
      <button onClick={onOpen} className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition ${active ? "bg-white/10" : "hover:bg-white/5"}`}>
        <div className="w-11 h-11 rounded-full bg-gradient-to-br from-green-400/30 to-blue-500/20 border border-white/10 flex items-center justify-center shrink-0">
          <Globe size={18} className="text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold truncate">Global Room</div>
          <div className="text-[11px] text-white/40 truncate">All .lit users · public</div>
        </div>
      </button>
    </div>
  );
}

function GlobalRoomChat({ myName, myAddress, onBack }: { myName: string | null; myAddress: string; onBack: () => void }) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-white/10 flex items-center gap-3 bg-black/40 backdrop-blur-xl">
        <button onClick={onBack} className="md:hidden text-white/60 hover:text-white"><ArrowLeft size={18} /></button>
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-400/30 to-blue-500/20 border border-white/10 flex items-center justify-center"><Globe size={16} /></div>
        <div>
          <div className="text-sm font-bold">Global Room</div>
          <div className="text-[10px] text-white/40 uppercase tracking-wider">Public · on-chain</div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 flex flex-col items-center justify-center text-center">
        <Sparkles className="w-10 h-10 text-white/20 mb-3" />
        <div className="text-sm font-bold text-white/70">Global broadcasts coming soon</div>
        <div className="text-xs text-white/40 mt-1 max-w-xs">Hook this up to the on-chain feed next. UI shell is ready.</div>
      </div>
      <div className="p-3 border-t border-white/10 flex gap-2 bg-black/40">
        <input disabled placeholder="Coming soon..." className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white/40 outline-none" />
        <button disabled className="px-4 py-2 rounded-xl bg-white/20 text-white/40 text-xs font-bold flex items-center gap-1"><Send size={12} /></button>
      </div>
    </div>
  );
}

// ============ Register .lit Name Modal ============
function RegisterNameModal({ onRegistered }: { onRegistered: (n: string) => void }) {
  const [name, setName] = useState("");
  const [available, setAvailable] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);
  const [duration, setDuration] = useState<number>(1);
  const [submitting, setSubmitting] = useState(false);
  const debounceRef = useRef<number | null>(null);
  const selectedDuration = DURATIONS.find((d) => d.id === duration) || DURATIONS[0];

  useEffect(() => {
    if (!name || name.length < 3) { setAvailable(null); return; }
    setChecking(true);
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(async () => {
      try {
        const data = await backendGet(`/hub/name/available/${name}`);
        setAvailable(!!data.available);
      } catch {
        try {
          const provider = new BrowserProvider((window as any).ethereum);
          const c = new Contract(LIT_NAME_REGISTRY, REGISTRY_ABI, provider);
          setAvailable(await c.isAvailable(name));
        } catch { setAvailable(null); }
      } finally { setChecking(false); }
    }, 400);
  }, [name]);

  const register = async () => {
    if (!name || !available) return;
    try {
      setSubmitting(true);
      console.log("Starting registration...");
      const eth = (window as any).ethereum;
      if (!eth) throw new Error("No wallet detected");

      let chainId = await eth.request({ method: "eth_chainId" });
      console.log("Chain ID:", chainId);
      console.log("Name:", name, "Duration:", duration);

      if (chainId?.toLowerCase() !== LITVM_CHAIN_HEX.toLowerCase()) {
        try {
          await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: LITVM_CHAIN_HEX }] });
        } catch (switchError: any) {
          if (switchError?.code === 4902 || switchError?.data?.originalError?.code === 4902) {
            await eth.request({
              method: "wallet_addEthereumChain",
              params: [{
                chainId: LITVM_CHAIN_HEX,
                chainName: "LitVM LiteForge",
                rpcUrls: ["https://liteforge.rpc.caldera.xyz/http"],
                nativeCurrency: { name: "zkLTC", symbol: "zkLTC", decimals: 18 },
                blockExplorerUrls: ["https://liteforge.explorer.caldera.xyz"],
              }],
            });
          } else {
            throw switchError;
          }
        }
        chainId = await eth.request({ method: "eth_chainId" });
        console.log("Chain ID:", chainId);
        if (chainId?.toLowerCase() !== LITVM_CHAIN_HEX.toLowerCase()) throw new Error("Please switch to LitVM LiteForge");
      }

      const provider = new ethers.BrowserProvider(eth);
      const signer = await provider.getSigner();
      const registry = new ethers.Contract(LIT_NAME_REGISTRY, [
        "function register(string name, uint8 duration) external payable",
        "function getPrice(uint8 duration) external view returns (uint256)",
        "function isAvailable(string name) external view returns (bool)",
      ], signer);
      const price = await registry.getPrice(duration);
      console.log("Price:", price.toString());
      const stillAvailable = await registry.isAvailable(name);
      if (!stillAvailable) throw new Error(`${name}.lit is no longer available`);
      const tx = await registry.register(name, duration, { value: price });
      console.log("Tx sent:", tx.hash);
      await tx.wait();
      console.log("Tx confirmed!");
      showSuccess({ title: `✓ ${name}.lit registered!`, rows: [{ label: "Name", value: `${name}.lit` }, { label: "Duration", value: selectedDuration.label }] });
      onRegistered(name);
    } catch (e: any) {
      showError(e?.message || e?.shortMessage || "Registration failed");
    } finally { setSubmitting(false); }
  };

  return (
    <div
      className="relative bg-zinc-900 border border-white/10 rounded-3xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="text-center mb-6">
        <Sparkles className="w-10 h-10 text-white mx-auto mb-3" />
        <h2 className="text-2xl font-black text-white uppercase tracking-tight">Claim Your .lit Name</h2>
        <p className="text-sm text-white/50 mt-2">Your identity on the LitVM social layer.</p>
      </div>

      <div className="relative mb-4">
        <input
          value={name}
          onChange={(e) => setName(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ""))}
          placeholder="yourname"
          className="w-full bg-white/5 border border-white/10 rounded-2xl pl-4 pr-20 py-4 text-white text-lg font-bold outline-none focus:border-white/30"
        />
        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 font-bold">.lit</span>
      </div>

      {name.length >= 3 && (
        <div className="mb-4 text-sm">
          {checking ? <span className="text-white/40">Checking...</span> :
            available === true ? <span className="text-green-400 font-bold">✓ Available</span> :
            available === false ? <span className="text-red-400 font-bold">✗ Taken</span> : null}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-6">
        {DURATIONS.map((d) => (
          <button
            key={d.id}
            onClick={() => setDuration(d.id)}
            className={`p-3 rounded-xl border text-xs font-bold transition-all ${
              duration === d.id ? "bg-white text-black border-white" : "bg-white/5 border-white/10 text-white/70 hover:border-white/30"
            }`}
          >
            <div className="uppercase tracking-wider">{d.label}</div>
            <div className="mt-1 opacity-80">{d.price} zkLTC</div>
          </button>
        ))}
      </div>

      <button
        onClick={register}
        disabled={!available || submitting}
        className="w-full py-4 rounded-2xl bg-white text-black font-black uppercase tracking-[0.2em] text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:scale-[1.01] transition-transform flex items-center justify-center gap-2"
      >
        {submitting ? <Loader2 className="animate-spin" size={16} /> : null}
        Register · {selectedDuration.price} zkLTC
      </button>
    </div>
  );
}

// ============ Global Feed ============
function GlobalFeed({ myName, myAddress }: { myName: string | null; myAddress: string }) {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await backendGet("/hub/posts");
      setPosts(Array.isArray(data?.posts) ? data.posts : []);
    } catch (e) { console.error("[Hub] posts fetch failed", e); setPosts([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t); }, []);

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div className="text-xs uppercase tracking-[0.2em] text-white/40">{posts.length} posts</div>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 rounded-full bg-white text-black font-bold text-xs uppercase tracking-[0.15em] flex items-center gap-2 hover:scale-105 transition-transform"
        ><Plus size={14} /> New Post</button>
      </div>

      {loading && <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-white/40 animate-spin" /></div>}
      {!loading && posts.length === 0 && (
        <div className="text-center py-20 text-white/40">No posts yet. Be the first.</div>
      )}

      <div className="space-y-4">
        {posts.map((p) => <PostCard key={p.id || p.postId} post={p} myAddress={myAddress} onChange={load} />)}
      </div>

      <AnimatePresence>
        {showCreate && (
          <CreatePostModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); setTimeout(load, 1500); }} />
        )}
      </AnimatePresence>
    </div>
  );
}

function PostCard({ post, myAddress, onChange }: { post: any; myAddress: string; onChange: () => void }) {
  const postId = post.id ?? post.postId;
  const creator = post.creator || post.author || "";
  const creatorName = post.creatorName || post.litName;
  const content = post.content || "";
  // API returns these as already-formatted strings (e.g. "0.01" zkLTC). Do NOT pass to ethers/BigInt.
  const likeReward = String(post.likeReward ?? "0");
  const commentReward = String(post.commentReward ?? "0");
  const bounty = String(post.bountyBalance ?? post.bounty ?? "0");
  const likes = String(post.likeCount ?? post.likes ?? "0");
  const comments = String(post.commentCount ?? post.comments ?? "0");
  const bountyActive = typeof post.bountyActive === "boolean"
    ? post.bountyActive
    : (parseFloat(bounty) > 0);

  const [liking, setLiking] = useState(false);
  const [commenting, setCommenting] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [showComment, setShowComment] = useState(false);
  const [hasLiked, setHasLiked] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const provider = new BrowserProvider((window as any).ethereum);
        const c = new Contract(HUB_POSTS, POSTS_ABI, provider);
        setHasLiked(await c.hasLiked(postId, myAddress));
      } catch {}
    })();
  }, [postId, myAddress]);

  const like = async () => {
    if (hasLiked) return;
    try {
      setLiking(true);
      await writeContract(HUB_POSTS, POSTS_ABI, "likePost", [postId]);
      showSuccess({ title: "Liked!", rows: [{ label: "Post", value: `#${postId}` }] });
      setHasLiked(true);
      onChange();
    } catch (e: any) { showError(e?.shortMessage || e?.message || "Like failed"); }
    finally { setLiking(false); }
  };

  const comment = async () => {
    if (!commentText.trim()) return;
    try {
      setCommenting(true);
      await writeContract(HUB_POSTS, POSTS_ABI, "commentPost", [postId, commentText]);
      showSuccess({ title: "Comment posted!", rows: [] });
      setCommentText(""); setShowComment(false); onChange();
    } catch (e: any) { showError(e?.shortMessage || e?.message || "Comment failed"); }
    finally { setCommenting(false); }
  };

  const share = () => {
    const text = encodeURIComponent(`${content}\n\nvia LitDEX Hub`);
    const url = encodeURIComponent("https://litdex.test-hub.xyz");
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, "_blank");
  };

  return (
    <div className="bg-white/5 border border-white/10 rounded-3xl p-5 backdrop-blur-xl hover:bg-white/[0.08] transition-all">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-white/20 to-white/5 flex items-center justify-center font-black text-white">
            {(creatorName || creator || "?").slice(0, 1).toUpperCase()}
          </div>
          <div>
            <div className="text-sm font-bold text-white">{creatorName ? `${creatorName}.lit` : shortAddr(creator)}</div>
            <div className="text-[10px] text-white/40 uppercase tracking-wider">Post #{postId}</div>
          </div>
        </div>
        {bountyActive ? (
          <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-green-500/20 text-green-300 border border-green-500/30">
            {bounty} zkLTC bounty
          </span>
        ) : (
          <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-white/5 text-white/40 border border-white/10">Bounty ended</span>
        )}
      </div>

      <p className="text-white/90 whitespace-pre-wrap text-sm leading-relaxed mb-4">{content}</p>

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={like}
          disabled={liking || hasLiked}
          className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
            hasLiked ? "bg-red-500/20 text-red-300 border-red-500/30" : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10"
          } disabled:opacity-50`}
        >
          <Heart size={14} fill={hasLiked ? "currentColor" : "none"} /> {likes}
          {parseFloat(likeReward) > 0 && <span className="text-green-400">+{likeReward}</span>}
        </button>
        <button
          onClick={() => setShowComment((s) => !s)}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold bg-white/5 border border-white/10 text-white/70 hover:bg-white/10"
        >
          <MessageCircle size={14} /> {comments}
          {parseFloat(commentReward) > 0 && <span className="text-green-400">+{commentReward}</span>}
        </button>
        <button onClick={share} className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 ml-auto">
          <Share2 size={14} /> Share
        </button>
      </div>

      {showComment && (
        <div className="mt-3 flex gap-2">
          <input
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="Write a comment..."
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-white/30"
          />
          <button onClick={comment} disabled={commenting || !commentText.trim()} className="px-4 py-2 rounded-xl bg-white text-black text-xs font-bold disabled:opacity-40">
            {commenting ? <Loader2 className="animate-spin" size={14} /> : "Post"}
          </button>
        </div>
      )}
    </div>
  );
}

function CreatePostModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [content, setContent] = useState("");
  const [withBounty, setWithBounty] = useState(false);
  const [likeReward, setLikeReward] = useState("0.01");
  const [commentReward, setCommentReward] = useState("0.01");
  const [budget, setBudget] = useState("0.1");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!content.trim()) return;
    try {
      setSubmitting(true);
      const lr = withBounty ? parseEther(likeReward || "0") : 0n;
      const cr = withBounty ? parseEther(commentReward || "0") : 0n;
      const val = withBounty ? parseEther(budget || "0") : 0n;
      await writeContract(HUB_POSTS, POSTS_ABI, "createPost", [content, lr, cr], val);
      showSuccess({ title: "Post created!", rows: [{ label: "Bounty", value: withBounty ? `${budget} zkLTC` : "None" }] });
      onCreated();
    } catch (e: any) { showError(e?.shortMessage || e?.message || "Post failed"); }
    finally { setSubmitting(false); }
  };

  return (
    <ModalShell onClose={onClose}>
      <h2 className="text-xl font-black text-white uppercase tracking-tight mb-4">Create Post</h2>
      <textarea
        value={content} onChange={(e) => setContent(e.target.value)}
        placeholder="Share something..."
        rows={4}
        className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white text-sm outline-none focus:border-white/30 mb-4"
      />
      <label className="flex items-center gap-2 mb-4 cursor-pointer">
        <input type="checkbox" checked={withBounty} onChange={(e) => setWithBounty(e.target.checked)} className="accent-white" />
        <span className="text-sm text-white/80">Add bounty reward</span>
      </label>
      {withBounty && (
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div>
            <div className="text-[10px] uppercase text-white/40 mb-1">Like</div>
            <input value={likeReward} onChange={(e) => setLikeReward(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none" />
          </div>
          <div>
            <div className="text-[10px] uppercase text-white/40 mb-1">Comment</div>
            <input value={commentReward} onChange={(e) => setCommentReward(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none" />
          </div>
          <div>
            <div className="text-[10px] uppercase text-white/40 mb-1">Budget</div>
            <input value={budget} onChange={(e) => setBudget(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none" />
          </div>
        </div>
      )}
      <button onClick={submit} disabled={submitting || !content.trim()} className="w-full py-3 rounded-2xl bg-white text-black font-black uppercase tracking-[0.2em] text-sm disabled:opacity-40 flex items-center justify-center gap-2">
        {submitting && <Loader2 className="animate-spin" size={16} />} Post
      </button>
    </ModalShell>
  );
}

// ============ Private Tab (friends + DM) ============
function PrivateTab({ myAddress }: { myAddress: string }) {
  const [friends, setFriends] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [addInput, setAddInput] = useState("");
  const [adding, setAdding] = useState(false);
  const [activeDM, setActiveDM] = useState<any | null>(null);

  const enrichNames = async (list: any[], addrKey: string, nameKey: string) => {
    return Promise.all(list.map(async (item) => {
      const addr = item[addrKey] || item.address || item;
      if (item[nameKey]) return item;
      try {
        const d = await backendGet(`/hub/name/reverse/${addr}`);
        return { ...item, [nameKey]: d?.name || null };
      } catch { return item; }
    }));
  };

  const load = async () => {
    setLoading(true);
    try {
      const [f, r] = await Promise.all([
        backendGet(`/hub/messenger/friends/${myAddress}`).catch(() => ({ friends: [] })),
        backendGet(`/hub/messenger/requests/${myAddress}`).catch(() => ({ requests: [] })),
      ]);
      const rawFriends = Array.isArray(f?.friends) ? f.friends : [];
      const rawRequests = Array.isArray(r?.requests) ? r.requests : [];
      const [friendsEnriched, requestsEnriched] = await Promise.all([
        enrichNames(rawFriends, "address", "name"),
        enrichNames(rawRequests, "from", "fromName"),
      ]);
      setFriends(friendsEnriched);
      setRequests(requestsEnriched);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [myAddress]);

  const addFriend = async () => {
    if (!addInput.trim()) return;
    try {
      setAdding(true);
      let target = addInput.trim();
      if (!target.startsWith("0x")) {
        const r = await backendGet(`/hub/name/resolve/${target.replace(/\.lit$/i, "")}`).catch(() => null);
        target = r?.address || target;
        if (!target.startsWith("0x")) throw new Error("Name not found");
      }
      await writeContract(LIT_MESSENGER, MESSENGER_ABI, "sendFriendRequest", [target]);
      showSuccess({ title: "Friend request sent!", rows: [{ label: "To", value: shortAddr(target) }] });
      setAddInput(""); load();
    } catch (e: any) { showError(e?.shortMessage || e?.message || "Failed"); }
    finally { setAdding(false); }
  };

  const respond = async (req: any, accept: boolean) => {
    try {
      const id = req.id ?? req.reqId;
      await writeContract(LIT_MESSENGER, MESSENGER_ABI, accept ? "acceptFriendRequest" : "rejectFriendRequest", [id]);
      showSuccess({ title: accept ? "Friend added!" : "Request rejected", rows: [] });
      load();
    } catch (e: any) { showError(e?.shortMessage || e?.message || "Failed"); }
  };

  if (activeDM) return <DMChat me={myAddress} friend={activeDM} onBack={() => setActiveDM(null)} />;

  return (
    <div>
      <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-4 flex gap-2">
        <input
          value={addInput} onChange={(e) => setAddInput(e.target.value)}
          placeholder="Add friend by .lit name or address"
          className="flex-1 bg-transparent text-white text-sm outline-none placeholder:text-white/30"
        />
        <button onClick={addFriend} disabled={adding} className="px-4 py-2 rounded-xl bg-white text-black text-xs font-bold disabled:opacity-40">
          {adding ? <Loader2 className="animate-spin" size={14} /> : "Add"}
        </button>
      </div>

      {requests.length > 0 && (
        <div className="mb-4">
          <div className="text-xs uppercase tracking-[0.2em] text-white/40 mb-2">Pending Requests ({requests.length})</div>
          <div className="space-y-2">
            {requests.map((r) => (
              <div key={r.id ?? r.reqId} className="bg-white/5 border border-white/10 rounded-2xl p-3 flex items-center justify-between">
                <div className="text-sm text-white">{r.fromName ? `${r.fromName}.lit` : shortAddr(r.from)}</div>
                <div className="flex gap-2">
                  <button onClick={() => respond(r, true)} className="px-3 py-1.5 rounded-lg bg-green-500/20 text-green-300 border border-green-500/30 text-xs font-bold flex items-center gap-1"><Check size={12} />Accept</button>
                  <button onClick={() => respond(r, false)} className="px-3 py-1.5 rounded-lg bg-red-500/20 text-red-300 border border-red-500/30 text-xs font-bold flex items-center gap-1"><X size={12} />Reject</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="text-xs uppercase tracking-[0.2em] text-white/40 mb-2">Friends ({friends.length})</div>
      {loading && <div className="flex justify-center py-6"><Loader2 className="animate-spin text-white/40" size={20} /></div>}
      {!loading && friends.length === 0 && <div className="text-center text-white/30 py-10">No friends yet.</div>}
      <div className="space-y-2">
        {friends.map((f) => (
          <button
            key={f.address || f}
            onClick={() => setActiveDM(f)}
            className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center justify-between hover:bg-white/10 transition"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-white/20 to-white/5 flex items-center justify-center font-black text-white">
                {((f.name || f.address || "?") as string).slice(0, 1).toUpperCase()}
              </div>
              <div className="text-left">
                <div className="text-sm font-bold text-white">{f.name ? `${f.name}.lit` : shortAddr(f.address || f)}</div>
                <div className="text-[10px] text-white/40">{shortAddr(f.address || f)}</div>
              </div>
            </div>
            <ArrowRight size={16} className="text-white/40" />
          </button>
        ))}
      </div>
    </div>
  );
}

function DMChat({ me, friend, onBack }: { me: string; friend: any; onBack: () => void }) {
  const other = friend.address || friend;
  const [msgs, setMsgs] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sendAmount, setSendAmount] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const d = await backendGet(`/hub/messenger/conversation/${me}/${other}`);
      setMsgs(Array.isArray(d?.messages) ? d.messages : []);
    } catch { setMsgs([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); const t = setInterval(load, 10000); return () => clearInterval(t); }, [me, other]);

  const send = async () => {
    if (!text.trim()) return;
    try {
      setSending(true);
      await writeContract(LIT_MESSENGER, MESSENGER_ABI, "sendMessage", [other, text, "text"]);
      setText(""); setTimeout(load, 1500);
    } catch (e: any) { showError(e?.shortMessage || e?.message || "Send failed"); }
    finally { setSending(false); }
  };

  const sendLTC = async () => {
    if (!sendAmount || isNaN(Number(sendAmount))) return;
    try {
      setSending(true);
      await writeContract(LIT_MESSENGER, MESSENGER_ABI, "sendZkLTC", [other, "DM gift"], parseEther(sendAmount));
      showSuccess({ title: "zkLTC sent!", rows: [{ label: "Amount", value: `${sendAmount} zkLTC` }, { label: "To", value: shortAddr(other) }] });
      setSendAmount(""); setTimeout(load, 1500);
    } catch (e: any) { showError(e?.shortMessage || e?.message || "Send failed"); }
    finally { setSending(false); }
  };

  return (
    <div>
      <button onClick={onBack} className="text-xs text-white/60 mb-3 hover:text-white">← Back to friends</button>
      <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden">
        <div className="p-4 border-b border-white/10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-white/20 to-white/5 flex items-center justify-center font-black text-white">
            {((friend.name || other) as string).slice(0, 1).toUpperCase()}
          </div>
          <div>
            <div className="text-sm font-bold text-white">{friend.name ? `${friend.name}.lit` : shortAddr(other)}</div>
            <div className="text-[10px] text-white/40">{shortAddr(other)}</div>
          </div>
        </div>
        <div className="h-96 overflow-y-auto p-4 space-y-2">
          {loading && <Loader2 className="mx-auto animate-spin text-white/40" size={20} />}
          {!loading && msgs.length === 0 && <div className="text-center text-white/30 mt-20">No messages yet.</div>}
          {msgs.map((m, i) => {
            const mine = (m.from || "").toLowerCase() === me.toLowerCase();
            return (
              <div key={i} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm ${mine ? "bg-white text-black" : "bg-white/10 text-white"}`}>
                  {m.content || m.contentHash}
                  {m.value && parseFloat(String(m.value)) > 0 && <div className="text-[10px] mt-1 opacity-70">💸 {String(m.value)} zkLTC</div>}
                </div>
              </div>
            );
          })}
        </div>
        <div className="p-3 border-t border-white/10 flex gap-2">
          <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Message..." className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none" />
          <button onClick={send} disabled={sending || !text.trim()} className="px-4 py-2 rounded-xl bg-white text-black text-xs font-bold disabled:opacity-40">
            {sending ? <Loader2 className="animate-spin" size={14} /> : "Send"}
          </button>
        </div>
        <div className="p-3 border-t border-white/10 flex gap-2 bg-white/[0.02]">
          <input value={sendAmount} onChange={(e) => setSendAmount(e.target.value)} placeholder="Amount (zkLTC)" className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none" />
          <button onClick={sendLTC} disabled={sending || !sendAmount} className="px-4 py-2 rounded-xl bg-green-500/20 text-green-300 border border-green-500/30 text-xs font-bold disabled:opacity-40 flex items-center gap-1">
            <Send size={12} /> zkLTC
          </button>
        </div>
      </div>
    </div>
  );
}

// ============ Marketplace ============
function MarketTab({ myAddress, myName }: { myAddress: string; myName: string | null }) {
  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [listPrice, setListPrice] = useState("");
  const [transferTo, setTransferTo] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const d = await backendGet("/hub/marketplace/listings");
      setListings(Array.isArray(d?.listings) ? d.listings : []);
    } catch { setListings([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const buy = async (l: any) => {
    try {
      // l.price comes from API as already-formatted string (e.g. "0.01"). Convert to wei only for the tx.
      await writeContract(LIT_MARKETPLACE, MARKETPLACE_ABI, "buyName", [l.name], parseEther(String(l.price || "0")));
      showSuccess({ title: "Name purchased!", rows: [{ label: "Name", value: `${l.name}.lit` }] });
      setTimeout(load, 1500);
    } catch (e: any) { showError(e?.shortMessage || e?.message || "Buy failed"); }
  };

  const bid = async (l: any) => {
    const amt = prompt(`Place bid on ${l.name}.lit (zkLTC):`);
    if (!amt) return;
    try {
      await writeContract(LIT_MARKETPLACE, MARKETPLACE_ABI, "placeBid", [l.name], parseEther(amt));
      showSuccess({ title: "Bid placed!", rows: [{ label: "Amount", value: `${amt} zkLTC` }] });
    } catch (e: any) { showError(e?.shortMessage || e?.message || "Bid failed"); }
  };

  const listMine = async () => {
    if (!myName || !listPrice) return;
    try {
      showInfo?.("Approving marketplace...");
      await writeContract(LIT_NAME_REGISTRY, REGISTRY_ABI, "setOperatorApproval", [LIT_MARKETPLACE, true]);
      await writeContract(LIT_MARKETPLACE, MARKETPLACE_ABI, "listName", [myName, parseEther(listPrice)]);
      showSuccess({ title: "Listed!", rows: [{ label: "Name", value: `${myName}.lit` }, { label: "Price", value: `${listPrice} zkLTC` }] });
      setListPrice(""); setTimeout(load, 1500);
    } catch (e: any) { showError(e?.shortMessage || e?.message || "List failed"); }
  };

  const transferMine = async () => {
    if (!myName || !transferTo) return;
    try {
      await writeContract(LIT_NAME_REGISTRY, REGISTRY_ABI, "transfer", [myName, transferTo]);
      showSuccess({ title: "Transferred!", rows: [{ label: "Name", value: `${myName}.lit` }, { label: "To", value: shortAddr(transferTo) }] });
      setTransferTo("");
    } catch (e: any) { showError(e?.shortMessage || e?.message || "Transfer failed"); }
  };

  return (
    <div className="space-y-6">
      {myName && (
        <div className="bg-white/5 border border-white/10 rounded-3xl p-5">
          <div className="text-xs uppercase tracking-[0.2em] text-white/40 mb-3">My Name</div>
          <div className="text-2xl font-black text-white mb-4">{myName}.lit</div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="flex gap-2">
              <input value={listPrice} onChange={(e) => setListPrice(e.target.value)} placeholder="Price (zkLTC)" className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none" />
              <button onClick={listMine} disabled={!listPrice} className="px-4 py-2 rounded-xl bg-white text-black text-xs font-bold disabled:opacity-40 flex items-center gap-1"><Tag size={12} />List</button>
            </div>
            <div className="flex gap-2">
              <input value={transferTo} onChange={(e) => setTransferTo(e.target.value)} placeholder="Transfer to address" className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none" />
              <button onClick={transferMine} disabled={!transferTo} className="px-4 py-2 rounded-xl bg-white/10 text-white text-xs font-bold border border-white/10 disabled:opacity-40">Transfer</button>
            </div>
          </div>
        </div>
      )}

      <div>
        <div className="text-xs uppercase tracking-[0.2em] text-white/40 mb-3">Active Listings ({listings.length})</div>
        {loading && <div className="flex justify-center py-10"><Loader2 className="animate-spin text-white/40" size={20} /></div>}
        {!loading && listings.length === 0 && <div className="text-center text-white/30 py-10">No listings.</div>}
        <div className="grid sm:grid-cols-2 gap-3">
          {listings.map((l) => (
            <div key={l.name} className="bg-white/5 border border-white/10 rounded-3xl p-4">
              <div className="text-xl font-black text-white mb-1">{l.name}.lit</div>
              <div className="text-[10px] text-white/40 mb-3">{shortAddr(l.seller)}</div>
              <div className="text-lg font-bold text-white mb-3">{String(l.price ?? "0")} zkLTC</div>
              <div className="flex gap-2">
                <button onClick={() => buy(l)} className="flex-1 py-2 rounded-xl bg-white text-black text-xs font-bold">Buy</button>
                <button onClick={() => bid(l)} className="px-4 py-2 rounded-xl bg-white/10 text-white text-xs font-bold border border-white/10">Bid</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============ Send zkLTC modal ============
function SendZkLTCModal({ onClose }: { onClose: () => void }) {
  const { address: myAddr } = useAccount();
  const [target, setTarget] = useState("");
  const [resolved, setResolved] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!target || target.startsWith("0x")) { setResolved(null); return; }
    const name = target.replace(/\.lit$/i, "");
    backendGet(`/hub/name/resolve/${name}`).then((d) => setResolved(d?.address || null)).catch(() => setResolved(null));
  }, [target]);

  const fetchName = async (addr: string): Promise<string | null> => {
    try {
      const d = await backendGet(`/hub/name/reverse/${addr}`);
      return d?.name ? `${d.name}.lit` : null;
    } catch { return null; }
  };

  const send = async () => {
    if (!target || !amount) return;
    try {
      setSending(true);
      const val = parseEther(amount);
      let toAddr = target;
      if (target.startsWith("0x")) {
        await writeContract(LIT_TRANSFER, TRANSFER_ABI, "sendToAddress", [target, note], val);
      } else {
        toAddr = resolved || target;
        await writeContract(LIT_TRANSFER, TRANSFER_ABI, "sendToName", [target.replace(/\.lit$/i, ""), note], val);
      }
      // Re-fetch names independently for sender and receiver
      const [fromName, toName] = await Promise.all([
        myAddr ? fetchName(myAddr) : Promise.resolve(null),
        toAddr.startsWith("0x") ? fetchName(toAddr) : Promise.resolve(target.endsWith(".lit") ? target : `${target}.lit`),
      ]);
      showSuccess({
        title: "zkLTC sent!",
        rows: [
          { label: "From", value: fromName || shortAddr(myAddr) },
          { label: "To", value: toName || shortAddr(toAddr) },
          { label: "Amount", value: `${amount} zkLTC` },
        ],
      });
      onClose();
    } catch (e: any) { showError(e?.shortMessage || e?.message || "Send failed"); }
    finally { setSending(false); }
  };

  return (
    <ModalShell onClose={onClose}>
      <div className="text-center mb-5">
        <Wallet className="w-10 h-10 text-white mx-auto mb-3" />
        <h2 className="text-xl font-black text-white uppercase tracking-tight">Send zkLTC</h2>
      </div>
      <input value={target} onChange={(e) => setTarget(e.target.value)} placeholder=".lit name or 0x address" className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white text-sm outline-none mb-2" />
      {resolved && <div className="text-xs text-green-400 mb-3">→ {shortAddr(resolved)}</div>}
      <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount (zkLTC)" className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white text-sm outline-none mb-3" />
      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white text-sm outline-none mb-4" />
      <button onClick={send} disabled={sending || !target || !amount} className="w-full py-3 rounded-2xl bg-white text-black font-black uppercase tracking-[0.2em] text-sm disabled:opacity-40 flex items-center justify-center gap-2">
        {sending && <Loader2 className="animate-spin" size={16} />} Send
      </button>
    </ModalShell>
  );
}

// ============ Shared Modal Shell ============
function ModalShell({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[10000] bg-black/80 backdrop-blur-xl flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="relative bg-zinc-900 border border-white/10 rounded-3xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto"
      >
        <button onClick={onClose} className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/60 hover:text-white">
          <X size={16} />
        </button>
        {children}
      </motion.div>
    </motion.div>
  );
}
