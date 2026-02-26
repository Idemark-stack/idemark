import { useEffect, useState } from "react";
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
import { Zap, Building2, Search, Filter, LogOut, Megaphone, Bookmark, BarChart3, Menu, X, Bell, Plus, Trash2, Eye } from "lucide-react";
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

type ActiveView = "feed" | "filter" | "notifications";

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
  }, [user]);

  useEffect(() => {
    if (!user || filters.length === 0) { setMatchedIdeas([]); return; }
    fetchMatchedIdeas();
  }, [filters, user]);

  const fetchFilters = async () => {
    const { data } = await supabase.from("company_filters").select("*").eq("company_id", user.id);
    setFilters(data || []);
  };

  const fetchMatchedIdeas = async () => {
    // Build a query that matches any of the company's filter criteria
    let query = supabase.from("ideas").select("*");
    
    // Get all unique industries from filters
    const allIndustries = filters.flatMap(f => f.industries || []);
    if (allIndustries.length > 0) {
      query = query.in("industry", allIndustries);
    }

    const { data } = await query.order("created_at", { ascending: false });
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
          </h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">
            {activeView === "feed" && "Ideas matching your innovation filters."}
            {activeView === "filter" && "Create filters to discover relevant innovations."}
            {activeView === "notifications" && "Stay updated on new matches."}
          </p>
        </div>

        {/* ===== FEED VIEW ===== */}
        {activeView === "feed" && (
          <>
            {/* Stats */}
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
                  <IdeaCard key={idea.id} idea={idea} />
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

const IdeaCard = ({ idea }: { idea: any }) => (
  <div className="bg-card border border-border rounded-xl p-4 sm:p-6 card-glow">
    <div className="flex flex-col sm:flex-row gap-4">
      {idea.media_url && (
        <div className="sm:w-32 sm:h-32 rounded-lg overflow-hidden border border-border shrink-0">
          <img src={idea.media_url} alt={idea.title} className="w-full h-40 sm:h-full object-cover" />
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
      </div>
    </div>
  </div>
);

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
