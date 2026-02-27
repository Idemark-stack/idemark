import { useEffect, useState, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Zap, Lightbulb, Plus, FileText, LogOut, TrendingUp, Menu, X, Bell, Trash2, MessageCircle, Send } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import ThemeToggle from "@/components/ThemeToggle";
import { useToast } from "@/hooks/use-toast";

type ActiveView = "ideas" | "notifications" | "messages";

const InnovatorDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeView, setActiveView] = useState<ActiveView>("ideas");

  const [ideas, setIdeas] = useState<any[]>([]);
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
      if (session.user.user_metadata?.role !== "innovator") { navigate("/dashboard/company"); return; }
      setUser(session.user);
    };
    getUser();
  }, [navigate]);

  useEffect(() => {
    if (!user) return;
    fetchIdeas();
    fetchNotifications();
    fetchConversations();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('innovator-messages')
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

  const fetchIdeas = async () => {
    const { data } = await supabase
      .from("ideas")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setIdeas(data || []);
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
    // Get all messages where user is sender or receiver, group by partner
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

    // Fetch partner profiles
    const partnerIds = Array.from(partnerMap.keys());
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, name, company_name, role")
      .in("user_id", partnerIds);

    const convs = Array.from(partnerMap.values()).map(c => {
      const profile = profiles?.find(p => p.user_id === c.partnerId);
      return { ...c, partnerName: profile?.company_name || profile?.name || "Unknown", partnerRole: profile?.role };
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

    // Mark as read
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

  const startConversation = async (partnerId: string) => {
    // Fetch partner profile name
    const { data: profile } = await supabase.from("profiles").select("name, company_name, role").eq("user_id", partnerId).maybeSingle();
    const name = profile?.company_name || profile?.name || "Unknown";
    setActiveView("messages");
    setSidebarOpen(false);
    openChat(partnerId, name);
  };

  const markAllRead = async () => {
    await supabase.from("notifications").update({ read: true }).eq("user_id", user.id).eq("read", false);
    fetchNotifications();
  };

  const handleDeleteIdea = async (id: string) => {
    const { error } = await supabase.from("ideas").delete().eq("id", id);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Idea deleted" });
      fetchIdeas();
    }
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
          <SidebarLink icon={Lightbulb} label="My Ideas" active={activeView === "ideas"} onClick={() => { setActiveView("ideas"); setSidebarOpen(false); }} />
          <SidebarLink icon={Plus} label="Submit Idea" onClick={() => { setSidebarOpen(false); navigate("/dashboard/innovator/submit"); }} />
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
            <p className="text-sm text-muted-foreground truncate">{user.email}</p>
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
        <div className="mb-6 sm:mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-display font-bold text-foreground">
              {activeView === "ideas" ? "My Ideas" : activeView === "notifications" ? "Notifications" : "Messages"}
            </h1>
            <p className="text-muted-foreground mt-1 text-sm sm:text-base">
              {activeView === "ideas" ? "Track your submitted innovations." : activeView === "notifications" ? "Updates on your idea matches." : "Chat with matched companies."}
            </p>
          </div>
          {activeView === "ideas" && (
            <Button onClick={() => navigate("/dashboard/innovator/submit")} className="shrink-0">
              <Plus className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Submit Idea</span>
              <span className="sm:hidden">New</span>
            </Button>
          )}
        </div>

        {/* Stats */}
        {activeView === "ideas" && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
            {[
              { label: "Total Ideas", value: String(ideas.length), icon: FileText },
              { label: "Matches", value: String(notifications.filter(n => n.type === "match").length), icon: TrendingUp },
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
        )}

        {/* IDEAS VIEW */}
        {activeView === "ideas" && (
          <>
            {ideas.length === 0 ? (
              <div className="bg-card border border-border rounded-xl p-8 sm:p-12 text-center card-glow">
                <Lightbulb className="w-10 sm:w-12 h-10 sm:h-12 text-muted-foreground/40 mx-auto mb-4" />
                <h3 className="text-base sm:text-lg font-display font-semibold text-foreground mb-2">No ideas yet</h3>
                <p className="text-muted-foreground text-sm mb-6">Submit your first idea to start getting matched with companies.</p>
                <Button onClick={() => navigate("/dashboard/innovator/submit")}>
                  <Plus className="w-4 h-4 mr-2" />
                  Submit an Idea
                </Button>
              </div>
            ) : (
              <div className="grid gap-4">
                {ideas.map(idea => (
                  <div key={idea.id} className="bg-card border border-border rounded-xl p-4 sm:p-6 card-glow">
                    <div className="flex flex-col sm:flex-row gap-4">
                      {idea.media_url && (
                        <div className="sm:w-28 sm:h-28 rounded-lg overflow-hidden border border-border shrink-0">
                          {idea.media_url.match(/\.(mp4|webm|mov)$/i) ? (
                            <video src={idea.media_url} className="w-full h-40 sm:h-full object-cover" muted />
                          ) : (
                            <img src={idea.media_url} alt={idea.title} className="w-full h-40 sm:h-full object-cover" />
                          )}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-display font-semibold text-foreground">{idea.title}</h3>
                          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive shrink-0 h-8 w-8" onClick={() => handleDeleteIdea(idea.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{idea.description}</p>
                        <div className="flex flex-wrap gap-2 mt-3">
                          <Badge variant="secondary">{idea.industry}</Badge>
                          <Badge variant="outline" className="capitalize">{idea.stage}</Badge>
                          <Badge variant={idea.status === "matched" ? "default" : "outline"} className="capitalize">
                            {idea.status.replace("_", " ")}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          Submitted {new Date(idea.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* NOTIFICATIONS VIEW */}
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
                <p className="text-muted-foreground text-sm">No notifications yet. When your ideas match a company's filter, you'll be notified here.</p>
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
                    {n.type === "match" && n.filter_id && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="shrink-0 text-xs"
                        onClick={async () => {
                          // Get the company who owns the filter
                          const { data: filter } = await supabase.from("company_filters").select("company_id").eq("id", n.filter_id).maybeSingle();
                          if (filter) startConversation(filter.company_id);
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

        {/* MESSAGES VIEW */}
        {activeView === "messages" && (
          <div className="flex flex-col md:flex-row gap-4 h-[calc(100vh-12rem)]">
            {/* Conversation list */}
            <div className={`${activeConversation ? "hidden md:block" : ""} w-full md:w-72 shrink-0 bg-card border border-border rounded-xl overflow-hidden`}>
              <div className="p-3 border-b border-border">
                <h3 className="font-semibold text-sm text-foreground">Conversations</h3>
              </div>
              <div className="divide-y divide-border overflow-y-auto max-h-[calc(100vh-16rem)]">
                {conversations.length === 0 ? (
                  <div className="p-6 text-center text-muted-foreground text-sm">
                    <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    No conversations yet. Message a matched company from your notifications.
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

            {/* Chat area */}
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

export default InnovatorDashboard;
