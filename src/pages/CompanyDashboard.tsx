import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Zap, Building2, Search, Filter, LogOut, Megaphone, Bookmark, BarChart3 } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";

const CompanyDashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate("/login"); return; }
      if (session.user.user_metadata?.role !== "company") { navigate("/dashboard/innovator"); return; }
      setUser(session.user);
    };
    getUser();
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 bottom-0 w-64 bg-card border-r border-border p-6 flex flex-col">
        <Link to="/" className="flex items-center gap-2 mb-8">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Zap className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-display font-bold text-foreground">Idemark</span>
        </Link>

        <nav className="flex-1 space-y-1">
          <SidebarLink icon={Search} label="Smart Match Feed" active />
          <SidebarLink icon={Filter} label="Innovation Filter" />
          <SidebarLink icon={Megaphone} label="Challenges" />
          <SidebarLink icon={Bookmark} label="Bookmarked" />
          <SidebarLink icon={BarChart3} label="Analytics" />
        </nav>

        <div className="pt-4 border-t border-border space-y-2">
          <div className="flex items-center justify-between">
            <div className="truncate">
              <p className="text-sm font-medium text-foreground truncate">{user.user_metadata?.company_name || "Company"}</p>
              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
            </div>
            <ThemeToggle />
          </div>
          <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Main */}
      <main className="ml-64 p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-display font-bold text-foreground">
            {user.user_metadata?.company_name || "Company"} Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">Discover and evaluate innovations that match your criteria.</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {[
            { label: "Matched Ideas", value: "0", icon: Search },
            { label: "Bookmarked", value: "0", icon: Bookmark },
            { label: "Active Challenges", value: "0", icon: Megaphone },
          ].map((stat) => (
            <div key={stat.label} className="bg-card border border-border rounded-xl p-6 card-glow">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">{stat.label}</span>
                <stat.icon className="w-4 h-4 text-muted-foreground" />
              </div>
              <p className="text-3xl font-display font-bold text-foreground">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Empty state */}
        <div className="bg-card border border-border rounded-xl p-12 text-center card-glow">
          <Filter className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
          <h3 className="text-lg font-display font-semibold text-foreground mb-2">Set up your Innovation Filter</h3>
          <p className="text-muted-foreground text-sm mb-6">Define your criteria to start receiving matched ideas from innovators.</p>
          <Button>
            <Filter className="w-4 h-4 mr-2" />
            Create Filter Profile
          </Button>
        </div>
      </main>
    </div>
  );
};

const SidebarLink = ({ icon: Icon, label, active }: { icon: any; label: string; active?: boolean }) => (
  <button
    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
      active
        ? "bg-primary/10 text-primary font-medium"
        : "text-muted-foreground hover:bg-secondary hover:text-foreground"
    }`}
  >
    <Icon className="w-4 h-4" />
    {label}
  </button>
);

export default CompanyDashboard;
