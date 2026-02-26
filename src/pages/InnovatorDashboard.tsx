import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Zap, Lightbulb, Plus, FileText, LogOut, TrendingUp, Menu, X, Bell, Trash2 } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import { useToast } from "@/hooks/use-toast";

type ActiveView = "ideas" | "notifications";

const InnovatorDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeView, setActiveView] = useState<ActiveView>("ideas");

  const [ideas, setIdeas] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

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
  }, [user]);

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
              {activeView === "ideas" ? "My Ideas" : "Notifications"}
            </h1>
            <p className="text-muted-foreground mt-1 text-sm sm:text-base">
              {activeView === "ideas" ? "Track your submitted innovations." : "Updates on your idea matches."}
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
                    <div>
                      <p className="text-sm font-medium text-foreground">{n.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{n.message}</p>
                      <p className="text-xs text-muted-foreground mt-1">{new Date(n.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                </div>
              ))
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
