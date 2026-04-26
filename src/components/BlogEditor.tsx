import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const SUPREME_EMAIL = "helena.gaby31@gmail.com";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ImagePlus, Loader2, Trash2, Plus, Edit3, Star } from "lucide-react";
import { toast } from "sonner";
import { blogAuthorBylineFromProfile } from "@/lib/utils";

interface BlogEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  editingPost?: any | null;
}

const CATEGORIES = ["Nutrição", "Tecnologia", "Dicas", "Performance", "Ciência", "Receitas"];

const slugify = (text: string) =>
  text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 80);

export default function BlogEditor({ open, onOpenChange, onSaved, editingPost }: BlogEditorProps) {
  const { user, profile } = useAuth();
  const isSupreme = user?.email?.toLowerCase() === SUPREME_EMAIL.toLowerCase();
  const isAdmin = isSupreme || profile?.role === "admin";
  const isContentAuthor =
    isAdmin || profile?.role === "nutritionist" || profile?.role === "personal_trainer";
  const [title, setTitle] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("Nutrição");
  const [readTime, setReadTime] = useState("5 min");
  const [coverUrl, setCoverUrl] = useState("");
  const [featured, setFeatured] = useState(false);
  const [published, setPublished] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editingPost) {
      setTitle(editingPost.title || "");
      setExcerpt(editingPost.excerpt || "");
      setContent(editingPost.content || "");
      setCategory(editingPost.category || "Nutrição");
      setReadTime(editingPost.read_time || "5 min");
      setCoverUrl(editingPost.cover_image_url || "");
      setFeatured(!!editingPost.featured);
      setPublished(editingPost.published ?? true);
    } else if (open) {
      setTitle(""); setExcerpt(""); setContent(""); setCategory("Nutrição");
      setReadTime("5 min"); setCoverUrl(""); setFeatured(false);
      setPublished(isSupreme || profile?.role === "admin");
    }
  }, [editingPost, open, isSupreme, profile?.role]);

  const uploadImage = async (file: File, kind: "cover" | "inline") => {
    if (!user) return null;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from("blog-images").upload(path, file);
      if (error) throw error;
      const { data } = supabase.storage.from("blog-images").getPublicUrl(path);
      return data.publicUrl;
    } catch (err: any) {
      toast.error(err.message || "Falha no upload");
      return null;
    } finally {
      setUploading(false);
    }
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await uploadImage(file, "cover");
    if (url) {
      setCoverUrl(url);
      toast.success("Capa enviada!");
    }
  };

  const handleInlineImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await uploadImage(file, "inline");
    if (url) {
      // Insert markdown image at end of content
      setContent((c) => `${c}\n\n![imagem](${url})\n\n`);
      toast.success("Imagem inserida no texto!");
    }
    e.target.value = "";
  };

  const handleSave = async () => {
    if (!user || !isContentAuthor) return;
    if (!title.trim() || !content.trim()) {
      toast.error("Título e conteúdo são obrigatórios.");
      return;
    }
    setSaving(true);
    try {
      const slug = editingPost?.slug || `${slugify(title)}-${Date.now().toString(36)}`;
      // Triage: admin/supremo publica direto; nutri e personal enviam p/ aprovação
      const status = isAdmin ? "published" : "pending_review";
      const { author_display_name, author_role_label } = blogAuthorBylineFromProfile(profile);
      const payload: {
        title: string;
        slug: string;
        excerpt: string;
        content: string;
        category: string;
        read_time: string;
        cover_image_url: string | null;
        featured: boolean;
        published: boolean;
        author_id: string;
        status: string;
        author_display_name: string;
        author_role_label: string;
      } = {
        title: title.trim(),
        slug,
        excerpt: excerpt.trim() || title.slice(0, 140),
        content,
        category,
        read_time: readTime,
        cover_image_url: coverUrl || null,
        featured: isAdmin ? featured : false,
        published: isAdmin ? published : false,
        author_id: user.id,
        status,
        author_display_name: author_display_name || user.email || "Autor",
        author_role_label: author_role_label || "Autor",
      };
      if (editingPost) {
        const { error } = await supabase.from("blog_posts").update(payload).eq("id", editingPost.id);
        if (error) throw error;
        toast.success(isAdmin ? "Artigo atualizado!" : "Artigo enviado para revisão da administração.");
      } else {
        const { error } = await supabase.from("blog_posts").insert(payload);
        if (error) throw error;
        toast.success(
          isAdmin
            ? "Artigo publicado!"
            : "✅ Artigo enviado para revisão da administração. Você será notificado após a aprovação."
        );
      }
      onSaved();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar artigo");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            {editingPost ? <Edit3 className="h-5 w-5 text-primary" /> : <Plus className="h-5 w-5 text-primary" />}
            {editingPost ? "Editar Artigo" : "Novo Artigo"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <div>
            <Label>Título</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Os benefícios da dieta mediterrânea" />
          </div>

          <div>
            <Label>Resumo (excerpt)</Label>
            <Textarea value={excerpt} onChange={(e) => setExcerpt(e.target.value)} rows={2} placeholder="Resumo curto que aparece nos cards do blog..." />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Categoria</Label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full mt-1 h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <Label>Tempo de leitura</Label>
              <Input value={readTime} onChange={(e) => setReadTime(e.target.value)} placeholder="5 min" />
            </div>
          </div>

          <div>
            <Label>Imagem de Capa</Label>
            <div className="mt-1 flex items-center gap-3">
              <label className="flex-1 cursor-pointer">
                <div className="flex items-center justify-center gap-2 h-24 rounded-lg border-2 border-dashed border-primary/30 bg-accent/20 hover:bg-accent/40 transition">
                  {uploading ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : <ImagePlus className="h-5 w-5 text-primary" />}
                  <span className="text-sm text-muted-foreground">{coverUrl ? "Trocar imagem" : "Clique para enviar capa"}</span>
                </div>
                <input type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} />
              </label>
              {coverUrl && (
                <div className="relative h-24 w-32 rounded-lg overflow-hidden border border-border">
                  <img src={coverUrl} alt="capa" className="w-full h-full object-cover" />
                  <button onClick={() => setCoverUrl("")} className="absolute top-1 right-1 p-1 rounded-full bg-destructive/90 text-destructive-foreground">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <Label>Conteúdo</Label>
              <label className="text-xs text-primary cursor-pointer hover:underline flex items-center gap-1">
                <ImagePlus className="h-3 w-3" /> Inserir imagem no texto
                <input type="file" accept="image/*" className="hidden" onChange={handleInlineImageUpload} />
              </label>
            </div>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={14}
              placeholder="Escreva o artigo completo. Você pode inserir imagens no meio do texto. Quebra de linha dupla cria parágrafos. Use ![alt](url) para imagens."
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground mt-1">Use linhas em branco para separar parágrafos. Imagens aparecem como <code>![alt](url)</code>.</p>
          </div>

          <div className="flex items-center gap-6 flex-wrap">
            {isAdmin && (
              <div className="flex items-center gap-2">
                <Switch checked={featured} onCheckedChange={setFeatured} />
                <Label className="cursor-pointer flex items-center gap-1">
                  <Star className="h-3.5 w-3.5 text-coin-gold-foreground" /> Destaque
                </Label>
              </div>
            )}
            {isAdmin && (
              <div className="flex items-center gap-2">
                <Switch checked={published} onCheckedChange={setPublished} />
                <Label className="cursor-pointer">Publicado</Label>
              </div>
            )}
            {!isAdmin && (
              <Badge variant="outline" className="text-xs border-primary/40 text-primary">
                ⏳ Será revisado pela administração antes de ir ao ar
              </Badge>
            )}
            {editingPost && <Badge variant="outline" className="text-xs">slug: {editingPost.slug}</Badge>}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving || uploading} className="emerald-gradient text-primary-foreground">
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {editingPost
                ? "Salvar alterações"
                : isAdmin
                  ? "Publicar artigo"
                  : "Enviar para revisão"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
