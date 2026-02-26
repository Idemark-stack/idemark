import { useState, useRef } from "react";
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
import { ArrowLeft, Upload, Link2, Image, Film, X } from "lucide-react";
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [industry, setIndustry] = useState("");
  const [stage, setStage] = useState("");
  const [fundingRequired, setFundingRequired] = useState("");
  const [region, setRegion] = useState("");
  const [ipStatus, setIpStatus] = useState("");

  // Media state
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // Idestrim import state
  const [idestrimLink, setIdestrimLink] = useState("");
  const [importedData, setImportedData] = useState<any>(null);
  const [importedImage, setImportedImage] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      toast({ title: "File too large", description: "Maximum file size is 50MB.", variant: "destructive" });
      return;
    }

    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");
    if (!isImage && !isVideo) {
      toast({ title: "Invalid file type", description: "Please upload an image or video.", variant: "destructive" });
      return;
    }

    setMediaFile(file);
    setMediaPreview(URL.createObjectURL(file));
  };

  const clearMedia = () => {
    setMediaFile(null);
    if (mediaPreview) URL.revokeObjectURL(mediaPreview);
    setMediaPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const uploadMedia = async (userId: string): Promise<string | null> => {
    if (!mediaFile) return null;
    setUploading(true);
    const ext = mediaFile.name.split(".").pop();
    const path = `${userId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("idea-media").upload(path, mediaFile);
    setUploading(false);
    if (error) throw error;
    const { data: { publicUrl } } = supabase.storage.from("idea-media").getPublicUrl(path);
    return publicUrl;
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate("/login"); return; }

      const mediaUrl = await uploadMedia(session.user.id);

      const { error } = await supabase.from("ideas").insert({
        user_id: session.user.id,
        title,
        description,
        industry,
        stage,
        funding_required: fundingRequired ? Number(fundingRequired) : 0,
        region,
        ip_status: ipStatus,
        media_url: mediaUrl,
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

  const handleIdestrimImport = async () => {
    if (!idestrimLink.includes("idestrim")) {
      toast({ title: "Invalid link", description: "Please paste a valid Idestrim link.", variant: "destructive" });
      return;
    }
    setImporting(true);
    try {
      const { data, error } = await supabase.functions.invoke("fetch-idestrim-post", {
        body: { url: idestrimLink },
      });
      if (error || !data?.success) {
        toast({ title: "Import failed", description: data?.error || error?.message || "Could not fetch post.", variant: "destructive" });
        return;
      }
      const post = data.data;
      setImportedData(post);
      setTitle(post.title || "");
      setDescription(post.description || "");
      setImportedImage(post.image || null);
      if (post.tags?.length) {
        const matchedIndustry = INDUSTRIES.find((ind) =>
          post.tags.some((tag: string) => tag.toLowerCase().includes(ind.toLowerCase()) || ind.toLowerCase().includes(tag.toLowerCase()))
        );
        if (matchedIndustry) setIndustry(matchedIndustry);
      }
      toast({ title: "Imported!", description: "Complete the remaining fields below." });
    } catch (err: any) {
      toast({ title: "Import failed", description: err.message, variant: "destructive" });
    } finally {
      setImporting(false);
    }
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
        media_url: importedImage || null,
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

  const MediaUploadSection = () => (
    <div>
      <Label>Media (Photo or Video)</Label>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        className="hidden"
        onChange={handleFileSelect}
      />
      {mediaPreview ? (
        <div className="mt-2 relative rounded-lg overflow-hidden border border-border">
          {mediaFile?.type.startsWith("video/") ? (
            <video src={mediaPreview} className="w-full max-h-64 object-cover" controls />
          ) : (
            <img src={mediaPreview} alt="Preview" className="w-full max-h-64 object-cover" />
          )}
          <button
            type="button"
            onClick={clearMedia}
            className="absolute top-2 right-2 w-7 h-7 rounded-full bg-background/80 flex items-center justify-center border border-border hover:bg-destructive hover:text-destructive-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="mt-2 w-full border-2 border-dashed border-border rounded-lg p-6 flex flex-col items-center gap-2 text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
        >
          <div className="flex items-center gap-2">
            <Image className="w-5 h-5" />
            <Film className="w-5 h-5" />
          </div>
          <span className="text-sm font-medium">Click to upload photo or video</span>
          <span className="text-xs">PNG, JPG, MP4, WEBM up to 50MB</span>
        </button>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto p-4 sm:p-6 md:p-8">
        <Button variant="ghost" className="mb-4 sm:mb-6 text-muted-foreground" onClick={() => navigate("/dashboard/innovator")}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Button>

        <h1 className="text-2xl sm:text-3xl font-display font-bold text-foreground mb-2">Submit Your Idea</h1>
        <p className="text-muted-foreground mb-6 sm:mb-8 text-sm sm:text-base">Share your innovation with the world.</p>

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
              <MediaUploadSection />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              <Button type="submit" className="w-full" disabled={loading || uploading || !title || !description || !industry || !stage}>
                {uploading ? "Uploading media…" : loading ? "Submitting…" : "Submit Idea"}
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
                    placeholder="https://idestrim.site/..."
                  />
                  <Button type="button" onClick={handleIdestrimImport} disabled={!idestrimLink || importing}>
                    {importing ? "Importing…" : "Import"}
                  </Button>
                </div>
              </div>

              {importedData && (
                <form onSubmit={handleImportedSubmit} className="space-y-5 bg-card border border-border rounded-xl p-6 card-glow">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent text-accent-foreground text-xs font-medium">
                    <Link2 className="w-3 h-3" />
                    Imported from Idestrim
                  </div>
                  {importedImage && (
                    <div>
                      <Label>Imported Media</Label>
                      <div className="mt-2 rounded-lg overflow-hidden border border-border">
                        <img src={importedImage} alt={title || "Imported media"} className="w-full max-h-64 object-cover" />
                      </div>
                    </div>
                  )}
                  <div>
                    <Label htmlFor="imp-title">Idea Title</Label>
                    <Input id="imp-title" value={title} onChange={(e) => setTitle(e.target.value)} required />
                  </div>
                  <div>
                    <Label htmlFor="imp-desc">Description</Label>
                    <Textarea id="imp-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={4} required />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
