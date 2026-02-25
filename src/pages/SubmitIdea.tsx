import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Upload, Link2 } from "lucide-react";
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

const IP_OPTIONS = [
  "No IP", "Patent Pending", "Patented", "Trade Secret", "Copyrighted",
];

const SubmitIdea = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  // Manual form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [industry, setIndustry] = useState("");
  const [stage, setStage] = useState("");
  const [fundingRequired, setFundingRequired] = useState("");
  const [region, setRegion] = useState("");
  const [ipStatus, setIpStatus] = useState("");

  // Idestrim import state
  const [idestrimLink, setIdestrimLink] = useState("");
  const [importedData, setImportedData] = useState<any>(null);

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate("/login"); return; }

      const { error } = await supabase.from("ideas").insert({
        user_id: session.user.id,
        title,
        description,
        industry,
        stage,
        funding_required: fundingRequired ? Number(fundingRequired) : 0,
        region,
        ip_status: ipStatus,
      });

      if (error) throw error;
      toast({ title: "Idea submitted!", description: "Your idea is now under review." });
      navigate("/dashboard/innovator");
    } catch (error: any) {
      toast({ title: "Submission failed", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleIdestrimImport = () => {
    if (!idestrimLink.includes("idestrim")) {
      toast({ title: "Invalid link", description: "Please paste a valid Idestrim link.", variant: "destructive" });
      return;
    }
    // Simulate import — in production this would fetch from Idestrim API
    setImportedData({
      title: "Imported Idea from Idestrim",
      description: "This idea was imported from your Idestrim post.",
      tags: ["AI", "Healthcare"],
    });
    setTitle("Imported Idea from Idestrim");
    setDescription("This idea was imported from your Idestrim post.");
    setIndustry("AI / ML");
    toast({ title: "Imported!", description: "Complete the remaining fields below." });
  };

  const handleImportedSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate("/login"); return; }

      const { error } = await supabase.from("ideas").insert({
        user_id: session.user.id,
        title,
        description,
        industry,
        stage,
        funding_required: fundingRequired ? Number(fundingRequired) : 0,
        region,
        ip_status: ipStatus,
        idestrim_link: idestrimLink,
      });

      if (error) throw error;
      toast({ title: "Idea submitted!", description: "Imported from Idestrim and now under review." });
      navigate("/dashboard/innovator");
    } catch (error: any) {
      toast({ title: "Submission failed", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto p-8">
        <Button variant="ghost" className="mb-6 text-muted-foreground" onClick={() => navigate("/dashboard/innovator")}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Button>

        <h1 className="text-3xl font-display font-bold text-foreground mb-2">Submit Your Idea</h1>
        <p className="text-muted-foreground mb-8">Share your innovation with the world.</p>

        <Tabs defaultValue="manual" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-8">
            <TabsTrigger value="manual" className="gap-2">
              <Upload className="w-4 h-4" />
              Manual Entry
            </TabsTrigger>
            <TabsTrigger value="import" className="gap-2">
              <Link2 className="w-4 h-4" />
              Import from Idestrim
            </TabsTrigger>
          </TabsList>

          {/* Manual Entry Tab */}
          <TabsContent value="manual">
            <form onSubmit={handleManualSubmit} className="space-y-5 bg-card border border-border rounded-xl p-6 card-glow">
              <div>
                <Label htmlFor="title">Idea Title *</Label>
                <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="A short, compelling title" required />
              </div>
              <div>
                <Label htmlFor="description">Description / Problem Solved *</Label>
                <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What problem does your idea solve?" rows={4} required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Industry *</Label>
                  <Select value={industry} onValueChange={setIndustry} required>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      {INDUSTRIES.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Stage *</Label>
                  <Select value={stage} onValueChange={setStage} required>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      {STAGES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="funding">Funding Required ($)</Label>
                  <Input id="funding" type="number" value={fundingRequired} onChange={(e) => setFundingRequired(e.target.value)} placeholder="0" />
                </div>
                <div>
                  <Label htmlFor="region">Region</Label>
                  <Input id="region" value={region} onChange={(e) => setRegion(e.target.value)} placeholder="e.g. North America" />
                </div>
              </div>
              <div>
                <Label>IP Status</Label>
                <Select value={ipStatus} onValueChange={setIpStatus}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {IP_OPTIONS.map((ip) => <SelectItem key={ip} value={ip}>{ip}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full" disabled={loading || !title || !description || !industry || !stage}>
                {loading ? "Submitting…" : "Submit Idea"}
              </Button>
            </form>
          </TabsContent>

          {/* Import from Idestrim Tab */}
          <TabsContent value="import">
            <div className="space-y-6">
              <div className="bg-card border border-border rounded-xl p-6 card-glow">
                <Label htmlFor="idestrim-link">Paste your Idestrim link</Label>
                <div className="flex gap-2 mt-2">
                  <Input
                    id="idestrim-link"
                    value={idestrimLink}
                    onChange={(e) => setIdestrimLink(e.target.value)}
                    placeholder="https://idestrim.com/post/..."
                  />
                  <Button type="button" onClick={handleIdestrimImport} disabled={!idestrimLink}>
                    Import
                  </Button>
                </div>
              </div>

              {importedData && (
                <form onSubmit={handleImportedSubmit} className="space-y-5 bg-card border border-border rounded-xl p-6 card-glow">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent text-accent-foreground text-xs font-medium">
                    <Link2 className="w-3 h-3" />
                    Imported from Idestrim
                  </div>
                  <div>
                    <Label htmlFor="imp-title">Idea Title</Label>
                    <Input id="imp-title" value={title} onChange={(e) => setTitle(e.target.value)} required />
                  </div>
                  <div>
                    <Label htmlFor="imp-desc">Description</Label>
                    <Textarea id="imp-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={4} required />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Industry</Label>
                      <Select value={industry} onValueChange={setIndustry}>
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          {INDUSTRIES.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Stage *</Label>
                      <Select value={stage} onValueChange={setStage} required>
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          {STAGES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="imp-funding">Funding Required ($)</Label>
                      <Input id="imp-funding" type="number" value={fundingRequired} onChange={(e) => setFundingRequired(e.target.value)} placeholder="0" />
                    </div>
                    <div>
                      <Label htmlFor="imp-region">Region</Label>
                      <Input id="imp-region" value={region} onChange={(e) => setRegion(e.target.value)} placeholder="e.g. North America" />
                    </div>
                  </div>
                  <div>
                    <Label>IP Status</Label>
                    <Select value={ipStatus} onValueChange={setIpStatus}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        {IP_OPTIONS.map((ip) => <SelectItem key={ip} value={ip}>{ip}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button type="submit" className="w-full" disabled={loading || !stage}>
                    {loading ? "Submitting…" : "Submit Imported Idea"}
                  </Button>
                </form>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default SubmitIdea;
