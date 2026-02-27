import { useEffect, useState, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Zap, Building2, Search, Filter, LogOut, Menu, X, Bell, Plus, Trash2, MessageCircle, Send } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import { useToast } from "@/hooks/use-toast";

const INDUSTRIES = [
  "Healthcare", "FinTech", "EdTech", "CleanTech", "AgriTech",
  "AI / ML", "IoT", "Cybersecurity", "Logistics", "E-commerce", "Other",
];

const STAGES = [
  { value: "concept", label: "Concept" },
  { value: "prototype", label: "Prototype" },
  { value: "mvp", label: "MVP" },
  { value: "revenue", label: "Revenue" },
];

type ActiveView = "feed" | "filter" | "notifications" | "messages";

const CompanyDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeView, setActiveView] = useState<ActiveView>("feed");

  // Filter state
  const [filters, setFilters] = useState<any[]>([]);
  const [filterLoading, setFilterLoading] = useState(false);
  const [filterDialogOpen, setFilterDialogOpen] = useState(false);
  const [newFilterIndustries, setNewFilterIndustries] = useState<string[]>([]);
  const [newFilterStages, setNewFilterStages] = useState<string[]>([]);
  const [newFilterRegion, setNewFilterRegion] = useState("");
  const [newFilterFundingMin, setNewFilterFundingMin] = useState("");
  const [newFilterFundingMax, setNewFilterFundingMax] = useState("");

  // Matched ideas
  const [matchedIdeas, setMatchedIdeas] = useState<any[]>([]);

  // Notifications
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Messaging
  const [conversations, setConversations] = useState<any[]>([]);
  const [activeConversation, setActiveConversation] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [chatPartnerName, setChatPartnerName] = useState("");

  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate("/login"); return; }
      if (session.user.user_metadata?.role !== "company") { navigate("/dashboard/innovator"); return; }
      setUser(session.user);
    };
    getUser();
  }, [navigate]);

  useEffect(() => {
    if (!user) return;
    fetchFilters();
    fetchNotifications();
    fetchConversations();
  }, [user]);

  useEffect(() => {
    if (!user || filters.length === 0) { setMatchedIdeas([]); return; }
    fetchMatchedIdeas();
  }, [filters, user]);

  // Realtime messages
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('company-messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const msg = payload.new as any;
        if (msg.sender_id === user.id || msg.receiver_id === user.id) {
          fetchConversations();
          if (activeConversation && (msg.sender_id === activeConversation || msg.receiver_id === activeConversation)) {
            setChatMessages(prev => [...prev, msg]);
          }
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, activeConversation]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const fetchFilters = async () => {
    const { data } = await supabase.from("company_filters").select("*").eq("company_id", user.id);
    setFilters(data || []);
  };

  const fetchMatchedIdeas = async () => {
    // RLS now restricts to only matched ideas - just fetch all visible ideas
    const { data } = await supabase.from("ideas").select("*").order("created_at", { ascending: false });
    setMatchedIdeas(data || []);
  };

  const fetchNotifications = async () => {
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setNotifications(data || []);
    setUnreadCount((data || []).filter((n: any) => !n.read).length);
  };

  const fetchConversations = async () => {
    const { data: msgs } = await supabase
      .from("messages")
      .select("*")
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .order("created_at", { ascending: false });

    if (!msgs || msgs.length === 0) { setConversations([]); return; }

    const partnerMap = new Map<string, any>();
    for (const m of msgs) {
      const partnerId = m.sender_id === user.id ? m.receiver_id : m.sender_id;
      if (!partnerMap.has(partnerId)) {
        partnerMap.set(partnerId, { partnerId, lastMessage: m, unread: 0 });
      }
      if (m.receiver_id === user.id && !m.read) {
        partnerMap.get(partnerId)!.unread++;
      }
    }

    const partnerIds = Array.from(partnerMap.keys());
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, name, company_name, role")
      .in("user_id", partnerIds);

    const convs = Array.from(partnerMap.values()).map(c => {
      const profile = profiles?.find(p => p.user_id === c.partnerId);
      return { ...c, partnerName: profile?.name || profile?.company_name || "Unknown", partnerRole: profile?.role };
    });

    setConversations(convs);
  };

  const openChat = async (partnerId: string, partnerName: string) => {
    setActiveConversation(partnerId);
    setChatPartnerName(partnerName);

    const { data } = await supabase
      .from("messages")
      .select("*")
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${user.id})`)
      .order("created_at", { ascending: true });

    setChatMessages(data || []);
    await supabase.from("messages").update({ read: true }).eq("sender_id", partnerId).eq("receiver_id", user.id).eq("read", false);
    fetchConversations();
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !activeConversation) return;
    setSendingMessage(true);
    const { error } = await supabase.from("messages").insert({
      sender_id: user.id,
      receiver_id: activeConversation,
      content: newMessage.trim(),
    });
    if (error) {
      toast({ title: "Failed to send", description: error.message, variant: "destructive" });
    } else {
      setNewMessage("");
    }
    setSendingMessage(false);
  };

  const startConversation = async (innovatorId: string) => {
    const { data: profile } = await supabase.from("profiles").select("name, company_name, role").eq("user_id", innovatorId).maybeSingle();
    const name = profile?.name || "Innovator";
    setActiveView("messages");
    setSidebarOpen(false);
    openChat(innovatorId, name);
  };

  const markAllRead = async () => {
    await supabase.from("notifications").update({ read: true }).eq("user_id", user.id).eq("read", false);
    fetchNotifications();
  };

  const handleCreateFilter = async () => {
    if (newFilterIndustries.length === 0) {
      toast({ title: "Select at least one industry", variant: "destructive" });
      return;
    }
    setFilterLoading(true);
    const { error } = await supabase.from("company_filters").insert({
      company_id: user.id,
      industries: newFilterIndustries,
      stage_required: newFilterStages,
      region: newFilterRegion,
      funding_min: newFilterFundingMin ? Number(newFilterFundingMin) : 0,
      funding_max: newFilterFundingMax ? Number(newFilterFundingMax) : 0,
    });
    if (error) {
      toast({ title: "Failed to create filter", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Filter created!", description: "Matching ideas will now appear in your feed." });
      setFilterDialogOpen(false);
      setNewFilterIndustries([]);
      setNewFilterStages([]);
      setNewFilterRegion("");
      setNewFilterFundingMin("");
      setNewFilterFundingMax("");
      fetchFilters();
      fetchNotifications();
    }
    setFilterLoading(false);
  };

  const handleDeleteFilter = async (id: string) => {
    await supabase.from("company_filters").delete().eq("id", id);
    toast({ title: "Filter removed" });
    fetchFilters();
  };

  const toggleIndustry = (ind: string) => {
    setNewFilterIndustries(prev =>
      prev.includes(ind) ? prev.filter(i => i !== ind) : [...prev, ind]
    );
  };

  const toggleStage = (stage: string) => {
    setNewFilterStages(prev =>
      prev.includes(stage) ? prev.filter(s => s !== stage) : [...prev, stage]
    );
  };

  const totalUnreadMessages = conversations.reduce((sum, c) => sum + c.unread, 0);

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile header */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-40 h-14 bg-card border-b border-border flex items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
            <Zap className="w-3.5 h-3.5 text-primary-foreground" />
          </div>
          <span className="font-display font-bold text-foreground text-sm">Idemark</span>
        </Link>
        <div className="flex items-center gap-2">
          <button className="relative" onClick={() => { setActiveView("notifications"); setSidebarOpen(false); }}>
            <Bell className="w-5 h-5 text-muted-foreground" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center">{unreadCount}</span>
            )}
          </button>
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setSidebarOpen(!sidebarOpen)}>
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
        </div>
      </header>

      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-black/50" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed left-0 top-0 bottom-0 w-64 bg-card border-r border-border p-6 flex flex-col z-50 transition-transform duration-200 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0`}>
        <Link to="/" className="flex items-center gap-2 mb-8">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Zap className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-display font-bold text-foreground">Idemark</span>
        </Link>

        <nav className="flex-1 space-y-1">
          <SidebarLink icon={Search} label="Smart Match Feed" active={activeView === "feed"} onClick={() => { setActiveView("feed"); setSidebarOpen(false); }} />
          <SidebarLink icon={Filter} label="Innovation Filters" active={activeView === "filter"} onClick={() => { setActiveView("filter"); setSidebarOpen(false); }} />
          <SidebarLink
            icon={Bell}
            label="Notifications"
            active={activeView === "notifications"}
            badge={unreadCount}
            onClick={() => { setActiveView("notifications"); setSidebarOpen(false); }}
          />
          <SidebarLink
            icon={MessageCircle}
            label="Messages"
            active={activeView === "messages"}
            badge={totalUnreadMessages}
            onClick={() => { setActiveView("messages"); setActiveConversation(null); setSidebarOpen(false); }}
          />
        </nav>

        <div className="pt-4 border-t border-border space-y-2">
          <div className="flex items-center justify-between">
            <div className="truncate">
              <p className="text-sm font-medium text-foreground truncate">{user.user_metadata?.company_name || "Company"}</p>
              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
            </div>
            <ThemeToggle />
          </div>
          <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground" onClick={async () => { await supabase.auth.signOut(); navigate("/"); }}>
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Main */}
      <main className="md:ml-64 pt-14 md:pt-0 p-4 sm:p-6 md:p-8">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-foreground">
            {activeView === "feed" && "Smart Match Feed"}
            {activeView === "filter" && "Innovation Filters"}
            {activeView === "notifications" && "Notifications"}
            {activeView === "messages" && "Messages"}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">
            {activeView === "feed" && "Ideas matching your innovation filters."}
            {activeView === "filter" && "Create filters to discover relevant innovations."}
            {activeView === "notifications" && "Stay updated on new matches."}
            {activeView === "messages" && "Chat with matched innovators."}
          </p>
        </div>

        {/* ===== FEED VIEW ===== */}
        {activeView === "feed" && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
              {[
                { label: "Matched Ideas", value: String(matchedIdeas.length), icon: Search },
                { label: "Active Filters", value: String(filters.length), icon: Filter },
                { label: "Notifications", value: String(unreadCount), icon: Bell },
              ].map((stat) => (
                <div key={stat.label} className="bg-card border border-border rounded-xl p-4 sm:p-6 card-glow">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground">{stat.label}</span>
                    <stat.icon className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <p className="text-2xl sm:text-3xl font-display font-bold text-foreground">{stat.value}</p>
                </div>
              ))}
            </div>

            {filters.length === 0 ? (
              <div className="bg-card border border-border rounded-xl p-8 sm:p-12 text-center card-glow">
                <Filter className="w-10 sm:w-12 h-10 sm:h-12 text-muted-foreground/40 mx-auto mb-4" />
                <h3 className="text-base sm:text-lg font-display font-semibold text-foreground mb-2">Set up your Innovation Filter</h3>
                <p className="text-muted-foreground text-sm mb-6">Define your criteria to start receiving matched ideas.</p>
                <Button onClick={() => setActiveView("filter")}>
                  <Filter className="w-4 h-4 mr-2" />
                  Create Filter Profile
                </Button>
              </div>
            ) : matchedIdeas.length === 0 ? (
              <div className="bg-card border border-border rounded-xl p-8 sm:p-12 text-center card-glow">
                <Search className="w-10 h-10 text-muted-foreground/40 mx-auto mb-4" />
                <h3 className="font-display font-semibold text-foreground mb-2">No matching ideas yet</h3>
                <p className="text-muted-foreground text-sm">When innovators submit ideas matching your filters, they'll appear here.</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {matchedIdeas.map((idea) => (
                  <div key={idea.id} className="bg-card border border-border rounded-xl p-4 sm:p-6 card-glow">
                    <div className="flex flex-col sm:flex-row gap-4">
                      {idea.media_url && (
                        <div className="sm:w-32 sm:h-32 rounded-lg overflow-hidden border border-border shrink-0">
                          {idea.media_url.match(/\.(mp4|webm|mov)$/i) ? (
                            <video src={idea.media_url} className="w-full h-40 sm:h-full object-cover" muted />
                          ) : (
                            <img src={idea.media_url} alt={idea.title} className="w-full h-40 sm:h-full object-cover" />
                          )}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-display font-semibold text-foreground text-lg">{idea.title}</h3>
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{idea.description}</p>
                        <div className="flex flex-wrap gap-2 mt-3">
                          <Badge variant="secondary">{idea.industry}</Badge>
                          <Badge variant="outline" className="capitalize">{idea.stage}</Badge>
                          {idea.region && <Badge variant="outline">{idea.region}</Badge>}
                        </div>
                        <div className="mt-3">
                          <Button variant="outline" size="sm" onClick={() => startConversation(idea.user_id)}>
                            <MessageCircle className="w-3 h-3 mr-1" />
                            Message Innovator
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ===== FILTER VIEW ===== */}
        {activeView === "filter" && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold text-foreground">Your Filters</h2>
              <Dialog open={filterDialogOpen} onOpenChange={setFilterDialogOpen}>
                <DialogTrigger asChild>
                  <Button><Plus className="w-4 h-4 mr-2" />Create Filter</Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Create Innovation Filter</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-5 pt-4">
                    <div>
                      <Label className="mb-2 block">Industries *</Label>
                      <div className="flex flex-wrap gap-2">
                        {INDUSTRIES.map(ind => (
                          <Badge
                            key={ind}
                            variant={newFilterIndustries.includes(ind) ? "default" : "outline"}
                            className="cursor-pointer"
                            onClick={() => toggleIndustry(ind)}
                          >
                            {ind}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div>
                      <Label className="mb-2 block">Stages</Label>
                      <div className="flex flex-wrap gap-2">
                        {STAGES.map(s => (
                          <Badge
                            key={s.value}
                            variant={newFilterStages.includes(s.value) ? "default" : "outline"}
                            className="cursor-pointer"
                            onClick={() => toggleStage(s.value)}
                          >
                            {s.label}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="filter-region">Region</Label>
                      <Input id="filter-region" value={newFilterRegion} onChange={e => setNewFilterRegion(e.target.value)} placeholder="e.g. Africa, North America" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Min Funding ($)</Label>
                        <Input type="number" value={newFilterFundingMin} onChange={e => setNewFilterFundingMin(e.target.value)} placeholder="0" />
                      </div>
                      <div>
                        <Label>Max Funding ($)</Label>
                        <Input type="number" value={newFilterFundingMax} onChange={e => setNewFilterFundingMax(e.target.value)} placeholder="0" />
                      </div>
                    </div>
                    <Button className="w-full" onClick={handleCreateFilter} disabled={filterLoading}>
                      {filterLoading ? "Creating…" : "Create Filter"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {filters.length === 0 ? (
              <div className="bg-card border border-border rounded-xl p-8 text-center card-glow">
                <Filter className="w-10 h-10 text-muted-foreground/40 mx-auto mb-4" />
                <p className="text-muted-foreground text-sm">No filters yet. Create one to start discovering innovations.</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {filters.map(f => (
                  <div key={f.id} className="bg-card border border-border rounded-xl p-4 sm:p-6 card-glow">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {(f.industries || []).map((ind: string) => (
                            <Badge key={ind} variant="secondary">{ind}</Badge>
                          ))}
                        </div>
                        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                          {(f.stage_required || []).length > 0 && <span>Stages: {f.stage_required.join(", ")}</span>}
                          {f.region && <span>Region: {f.region}</span>}
                          {(f.funding_min > 0 || f.funding_max > 0) && <span>Funding: ${f.funding_min || 0} – ${f.funding_max || "∞"}</span>}
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive shrink-0" onClick={() => handleDeleteFilter(f.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ===== NOTIFICATIONS VIEW ===== */}
        {activeView === "notifications" && (
          <div className="space-y-4">
            {notifications.length > 0 && unreadCount > 0 && (
              <div className="flex justify-end">
                <Button variant="ghost" size="sm" onClick={markAllRead}>Mark all as read</Button>
              </div>
            )}
            {notifications.length === 0 ? (
              <div className="bg-card border border-border rounded-xl p-8 text-center card-glow">
                <Bell className="w-10 h-10 text-muted-foreground/40 mx-auto mb-4" />
                <p className="text-muted-foreground text-sm">No notifications yet. They'll appear when ideas match your filters.</p>
              </div>
            ) : (
              notifications.map(n => (
                <div key={n.id} className={`bg-card border rounded-xl p-4 ${n.read ? "border-border" : "border-primary/50 bg-primary/5"}`}>
                  <div className="flex items-start gap-3">
                    <Bell className={`w-4 h-4 mt-0.5 shrink-0 ${n.read ? "text-muted-foreground" : "text-primary"}`} />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">{n.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{n.message}</p>
                      <p className="text-xs text-muted-foreground mt-1">{new Date(n.created_at).toLocaleDateString()}</p>
                    </div>
                    {n.type === "match" && n.idea_id && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="shrink-0 text-xs"
                        onClick={async () => {
                          const { data: idea } = await supabase.from("ideas").select("user_id").eq("id", n.idea_id).maybeSingle();
                          if (idea) startConversation(idea.user_id);
                        }}
                      >
                        <MessageCircle className="w-3 h-3 mr-1" />
                        Message
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ===== MESSAGES VIEW ===== */}
        {activeView === "messages" && (
          <div className="flex flex-col md:flex-row gap-4 h-[calc(100vh-12rem)]">
            <div className={`${activeConversation ? "hidden md:block" : ""} w-full md:w-72 shrink-0 bg-card border border-border rounded-xl overflow-hidden`}>
              <div className="p-3 border-b border-border">
                <h3 className="font-semibold text-sm text-foreground">Conversations</h3>
              </div>
              <div className="divide-y divide-border overflow-y-auto max-h-[calc(100vh-16rem)]">
                {conversations.length === 0 ? (
                  <div className="p-6 text-center text-muted-foreground text-sm">
                    <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    No conversations yet. Message an innovator from your feed or notifications.
                  </div>
                ) : (
                  conversations.map(c => (
                    <button
                      key={c.partnerId}
                      onClick={() => openChat(c.partnerId, c.partnerName)}
                      className={`w-full text-left p-3 hover:bg-secondary/50 transition-colors ${activeConversation === c.partnerId ? "bg-primary/10" : ""}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-foreground truncate">{c.partnerName}</span>
                        {c.unread > 0 && (
                          <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center shrink-0">{c.unread}</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{c.lastMessage.content}</p>
                    </button>
                  ))
                )}
              </div>
            </div>

            {activeConversation ? (
              <div className="flex-1 bg-card border border-border rounded-xl flex flex-col overflow-hidden">
                <div className="p-3 border-b border-border flex items-center gap-2">
                  <Button variant="ghost" size="icon" className="md:hidden h-8 w-8" onClick={() => setActiveConversation(null)}>
                    <X className="w-4 h-4" />
                  </Button>
                  <h3 className="font-semibold text-sm text-foreground">{chatPartnerName}</h3>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {chatMessages.map(msg => (
                    <div key={msg.id} className={`flex ${msg.sender_id === user.id ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[75%] rounded-xl px-3 py-2 text-sm ${
                        msg.sender_id === user.id
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary text-secondary-foreground"
                      }`}>
                        {msg.content}
                        <p className={`text-[10px] mt-1 ${msg.sender_id === user.id ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>
                <div className="p-3 border-t border-border flex gap-2">
                  <Input
                    value={newMessage}
                    onChange={e => setNewMessage(e.target.value)}
                    placeholder="Type a message..."
                    onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage()}
                  />
                  <Button size="icon" onClick={sendMessage} disabled={sendingMessage || !newMessage.trim()}>
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="hidden md:flex flex-1 bg-card border border-border rounded-xl items-center justify-center">
                <p className="text-muted-foreground text-sm">Select a conversation</p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

const SidebarLink = ({ icon: Icon, label, active, onClick, badge }: { icon: any; label: string; active?: boolean; onClick?: () => void; badge?: number }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
      active
        ? "bg-primary/10 text-primary font-medium"
        : "text-muted-foreground hover:bg-secondary hover:text-foreground"
    }`}
  >
    <Icon className="w-4 h-4" />
    <span className="flex-1 text-left">{label}</span>
    {badge !== undefined && badge > 0 && (
      <span className="w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center">{badge}</span>
    )}
  </button>
);

export default CompanyDashboard;
