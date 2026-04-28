import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Leaf, ArrowRight, Clock, User, BookOpen, Search, TrendingUp, Plus, Pencil, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import BlogEditor from "@/components/BlogEditor";
import AppHeader from "@/components/AppHeader";
import { MOCK_ARTICLES } from "@/lib/mockArticles";

const SUPREME_EMAIL = "helena.gaby31@gmail.com";

interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  content: string;
  category: string;
  cover_image_url: string | null;
  read_time: string | null;
  featured: boolean;
  published: boolean;
  author_id: string;
  created_at: string;
  status?: string;
  author_display_name?: string | null;
  author_role_label?: string | null;
  isMock?: boolean;
}

// Render content: split paragraphs and parse markdown images
function renderContent(content: string) {
  const blocks = content.split(/\n\n+/);
  return blocks.map((block, i) => {
    const imgMatch = block.trim().match(/^!\[(.*?)\]\((.+?)\)$/);
    if (imgMatch) {
      return (
        <figure key={i} className="my-6">
          <img src={imgMatch[2]} alt={imgMatch[1]} className="w-full rounded-lg border border-border" loading="lazy" />
          {imgMatch[1] && <figcaption className="text-xs text-muted-foreground text-center mt-2">{imgMatch[1]}</figcaption>}
        </figure>
      );
    }
    // Inline images mid-paragraph: simple replace
    const parts = block.split(/(!\[.*?\]\(.+?\))/g);
    return (
      <p key={i} className="text-foreground/80 leading-relaxed mb-6 text-lg">
        {parts.map((part, j) => {
          const m = part.match(/^!\[(.*?)\]\((.+?)\)$/);
          if (m) return <img key={j} src={m[2]} alt={m[1]} className="my-3 rounded-lg border border-border" loading="lazy" />;
          return <span key={j}>{part}</span>;
        })}
      </p>
    );
  });
}

export default function Blog() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedArticle, setSelectedArticle] = useState<BlogPost | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<BlogPost | null>(null);
  const [myPending, setMyPending] = useState<BlogPost[]>([]);

  const isSupreme = user?.email?.toLowerCase() === SUPREME_EMAIL.toLowerCase();
  const role = profile?.role as string | undefined;
  const canManage =
    isSupreme ||
    role === "admin" ||
    role === "nutritionist" ||
    role === "personal_trainer";
  const isAdmin = role === "admin" || isSupreme;
  const canEditOrDelete = (a: BlogPost) =>
    !a.isMock &&
    (isSupreme ||
      profile?.role === "admin" ||
      (a.author_id === user?.id && a.status === "pending_review"));

  const fetchPosts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("blog_posts")
      .select("*")
      .eq("published", true)
      .eq("status", "published")
      .order("featured", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) {
      // Don't block — fall back to mocks
      console.error(error);
    }
    // Merge real posts with mock seed articles. Real DB posts take precedence
    // (e.g. if Admin publishes one with the same slug we keep the real one).
    const realPosts = (data as BlogPost[]) || [];
    const realSlugs = new Set(realPosts.map((p) => p.slug));
    const merged = [...realPosts, ...MOCK_ARTICLES.filter((m) => !realSlugs.has(m.slug))];
    setPosts(merged);
    setLoading(false);
  };

  const fetchMyPending = useCallback(async () => {
    if (!user?.id || !canManage) {
      setMyPending([]);
      return;
    }
    if (isAdmin) {
      setMyPending([]);
      return;
    }
    const { data, error } = await supabase
      .from("blog_posts")
      .select("*")
      .eq("author_id", user.id)
      .eq("status", "pending_review")
      .order("created_at", { ascending: false });
    if (error) console.error(error);
    setMyPending((data as BlogPost[]) || []);
  }, [user?.id, canManage, isAdmin]);

  useEffect(() => {
    void fetchPosts();
  }, []);

  useEffect(() => {
    if (!user) {
      setMyPending([]);
      return;
    }
    void fetchMyPending();
  }, [user, fetchMyPending]);

  const handleDelete = async (post: BlogPost) => {
    if (post.isMock) {
      toast.info("Artigos de exemplo não podem ser excluídos.");
      return;
    }
    if (!confirm(`Excluir o artigo "${post.title}"?`)) return;
    const { error } = await supabase.from("blog_posts").delete().eq("id", post.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Artigo excluído");
      fetchPosts();
    }
  };

  const featuredArticle = posts.find((a) => a.featured);
  const filteredArticles = posts.filter(
    (a) =>
      !searchQuery ||
      a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background">
      {user ? (
        <>
          <AppHeader />
          {canManage && (
            <div className="sticky top-16 z-40 border-b border-border/50 bg-card/80 backdrop-blur-sm">
              <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-end gap-2 px-4 py-2 md:px-6">
                <Button
                  size="sm"
                  className="emerald-gradient gap-1 text-primary-foreground"
                  onClick={() => {
                    setEditingPost(null);
                    setEditorOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4" /> Novo Artigo
                </Button>
              </div>
            </div>
          )}
        </>
      ) : (
        <header className="sticky top-0 z-50 flex items-center justify-between border-b border-border/50 bg-card/50 px-6 py-4 backdrop-blur-sm">
          <div className="flex cursor-pointer items-center gap-2" onClick={() => navigate("/")}>
            <Leaf className="h-6 w-6 text-primary" />
            <span className="font-display text-xl font-bold">
              Nutr<span className="text-primary">IA</span>prova
            </span>
          </div>
          <div className="flex items-center gap-3">
            {canManage && (
              <Button size="sm" className="emerald-gradient gap-1 text-primary-foreground" onClick={() => { setEditingPost(null); setEditorOpen(true); }}>
                <Plus className="h-4 w-4" /> Novo Artigo
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => navigate("/para-nutricionistas")}>
              Sou Nutricionista
            </Button>
            <Button variant="outline" onClick={() => navigate("/auth")}>
              Entrar
            </Button>
          </div>
        </header>
      )}

      <main className="mx-auto max-w-5xl px-4 py-8 md:px-6 md:py-12">
        {selectedArticle ? (
          <motion.article initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-3xl mx-auto">
            <button onClick={() => setSelectedArticle(null)} className="text-sm text-muted-foreground hover:text-foreground mb-6 block">
              ← Voltar para o Blog
            </button>
            {selectedArticle.cover_image_url && (
              <img src={selectedArticle.cover_image_url} alt={selectedArticle.title} className="w-full rounded-xl border border-border mb-6 max-h-96 object-cover" />
            )}
            <Badge variant="outline" className="mb-4">{selectedArticle.category}</Badge>
            <h1 className="text-3xl md:text-5xl font-display font-bold mb-4 leading-tight">{selectedArticle.title}</h1>
            <div className="mb-8 flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border pb-6 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" /> {selectedArticle.read_time || "5 min"}
              </span>
              <span>{new Date(selectedArticle.created_at).toLocaleDateString("pt-BR")}</span>
              {!selectedArticle.isMock && (selectedArticle.author_display_name || selectedArticle.author_role_label) && (
                <span className="flex items-center gap-1.5 text-foreground/90">
                  <User className="h-3.5 w-3.5 shrink-0" />
                  <span>
                    {selectedArticle.author_display_name || "Autor"}
                    {selectedArticle.author_role_label ? (
                      <span className="text-muted-foreground"> · {selectedArticle.author_role_label}</span>
                    ) : null}
                  </span>
                </span>
              )}
            </div>
            <div className="prose prose-lg dark:prose-invert max-w-none">
              {renderContent(selectedArticle.content)}
            </div>

            <div className="sticky bottom-4 mt-12">
              <div className="rounded-2xl border-2 border-primary/30 bg-card/95 backdrop-blur-md shadow-xl p-6 text-center space-y-3">
                <p className="font-display font-bold text-xl">Valide sua dieta com um especialista agora</p>
                <p className="text-sm text-muted-foreground">Plano personalizado por IA + validação profissional por nutricionista com CRN.</p>
                <Button size="lg" className="emerald-gradient text-primary-foreground px-8" onClick={() => navigate("/auth")}>
                  Começar Agora — R$ 39,90 <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          </motion.article>
        ) : (
          <>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-12">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent border border-primary/20 text-sm mb-6">
                <BookOpen className="h-3.5 w-3.5 text-primary" />
                Conteúdo exclusivo sobre nutrição inteligente
              </div>
              <h1 className="text-4xl md:text-6xl font-display font-bold mb-4">
                Blog <span className="text-gradient-emerald">nutrIAprova</span>
              </h1>
              <p className="text-lg text-muted-foreground max-w-xl mx-auto mb-8">
                Dicas baseadas em ciência, tendências e novidades sobre nutrição personalizada com inteligência artificial.
              </p>

              <div className="max-w-md mx-auto relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar artigos..." className="pl-10" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
              </div>
            </motion.div>

            {canManage && !isAdmin && myPending.length > 0 && (
              <div className="mx-auto mb-10 max-w-3xl rounded-xl border border-primary/25 bg-[hsl(var(--primary)/0.06)] p-4 md:p-5">
                <p className="mb-3 text-sm font-semibold text-[hsl(var(--ink-1))]">
                  Seus artigos aguardando aprovação ({myPending.length})
                </p>
                <ul className="space-y-2">
                  {myPending.map((p) => (
                    <li
                      key={p.id}
                      className="flex flex-col gap-2 rounded-lg border border-[hsl(var(--surface-3))] bg-[hsl(var(--surface-0))] p-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-[hsl(var(--ink-1))]">{p.title}</p>
                        <p className="text-xs text-muted-foreground">
                          Enviado em {new Date(p.created_at).toLocaleDateString("pt-BR")}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="shrink-0"
                        onClick={() => {
                          setEditingPost(p);
                          setEditorOpen(true);
                        }}
                      >
                        Editar
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {loading ? (
              <div className="text-center py-16 text-muted-foreground">Carregando artigos...</div>
            ) : posts.length === 0 ? (
              <Card className="glass-card">
                <CardContent className="py-16 text-center">
                  <BookOpen className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-lg font-medium mb-1">Nenhum artigo publicado ainda</p>
                  <p className="text-sm text-muted-foreground mb-4">
                    {canManage ? "Clique em 'Novo Artigo' para criar o primeiro!" : "Volte em breve para novos conteúdos."}
                  </p>
                  {canManage && (
                    <Button className="emerald-gradient text-primary-foreground" onClick={() => { setEditingPost(null); setEditorOpen(true); }}>
                      <Plus className="h-4 w-4 mr-1" /> Criar Primeiro Artigo
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <>
                {featuredArticle && !searchQuery && (
                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mb-12">
                    <Card
                      className="glass-card overflow-hidden hover:shadow-xl transition-shadow cursor-pointer group border-primary/20"
                      onClick={() => setSelectedArticle(featuredArticle)}
                    >
                      {featuredArticle.cover_image_url ? (
                        <div className="relative h-48 md:h-64 overflow-hidden">
                          <img src={featuredArticle.cover_image_url} alt={featuredArticle.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                          <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
                          <div className="absolute bottom-0 p-6">
                            <Badge className="emerald-gradient text-primary-foreground mb-3"><TrendingUp className="h-3 w-3 mr-1" /> Destaque</Badge>
                            <h2 className="text-2xl md:text-3xl font-display font-bold leading-tight">{featuredArticle.title}</h2>
                          </div>
                        </div>
                      ) : (
                        <div className="relative h-48 md:h-64 bg-gradient-to-br from-primary/20 via-accent/40 to-primary/10 flex items-center justify-center">
                          <div className="text-center p-6">
                            <Badge className="emerald-gradient text-primary-foreground mb-3"><TrendingUp className="h-3 w-3 mr-1" /> Destaque</Badge>
                            <h2 className="text-2xl md:text-3xl font-display font-bold group-hover:text-primary transition-colors leading-tight">{featuredArticle.title}</h2>
                          </div>
                        </div>
                      )}
                      <CardContent className="p-6">
                        <p className="text-muted-foreground mb-4">{featuredArticle.excerpt}</p>
                        {!featuredArticle.isMock &&
                          (featuredArticle.author_display_name || featuredArticle.author_role_label) && (
                            <p className="mb-4 text-xs text-muted-foreground">
                              <span className="inline-flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {featuredArticle.author_display_name || "Autor"}
                                {featuredArticle.author_role_label
                                  ? ` · ${featuredArticle.author_role_label}`
                                  : ""}
                              </span>
                            </p>
                          )}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {featuredArticle.read_time}</span>
                            <span>{new Date(featuredArticle.created_at).toLocaleDateString("pt-BR")}</span>
                          </div>
                          {canManage && canEditOrDelete(featuredArticle) && (
                            <div className="flex gap-1">
                              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); setEditingPost(featuredArticle); setEditorOpen(true); }}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={(e) => { e.stopPropagation(); handleDelete(featuredArticle); }}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                )}

                <div className="grid md:grid-cols-2 gap-6">
                  {filteredArticles
                    .filter((a) => searchQuery || !a.featured)
                    .map((article, i) => (
                      <motion.div key={article.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
                        <Card className="glass-card hover:shadow-lg transition-all cursor-pointer group h-full overflow-hidden" onClick={() => setSelectedArticle(article)}>
                          {article.cover_image_url ? (
                            <div className="h-40 overflow-hidden">
                              <img src={article.cover_image_url} alt={article.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                            </div>
                          ) : (
                            <div className="h-32 bg-gradient-to-br from-accent/60 via-primary/5 to-accent/30 flex items-center justify-center">
                              <BookOpen className="h-10 w-10 text-primary/40 group-hover:text-primary/60 transition-colors" />
                            </div>
                          )}
                          <CardContent className="p-5">
                            <div className="flex items-center gap-2 mb-3">
                              <Badge variant="outline" className="text-xs">{article.category}</Badge>
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Clock className="h-3 w-3" /> {article.read_time}
                              </span>
                            </div>
                            <h2 className="text-lg font-display font-bold group-hover:text-primary transition-colors mb-2 leading-tight">{article.title}</h2>
                            <p className="text-sm text-muted-foreground line-clamp-2">{article.excerpt}</p>
                            {!article.isMock && (article.author_display_name || article.author_role_label) && (
                              <p className="mt-2 text-xs text-muted-foreground">
                                <span className="inline-flex items-center gap-1">
                                  <User className="h-3 w-3" />
                                  {article.author_display_name || "Autor"}
                                  {article.author_role_label ? ` · ${article.author_role_label}` : ""}
                                </span>
                              </p>
                            )}
                            <div className="flex items-center justify-between mt-3">
                              <p className="text-xs text-muted-foreground">{new Date(article.created_at).toLocaleDateString("pt-BR")}</p>
                              {canManage && canEditOrDelete(article) && (
                                <div className="flex gap-1">
                                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); setEditingPost(article); setEditorOpen(true); }}>
                                    <Pencil className="h-3 w-3" />
                                  </Button>
                                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={(e) => { e.stopPropagation(); handleDelete(article); }}>
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    ))}
                </div>

                {filteredArticles.length === 0 && searchQuery && (
                  <div className="text-center py-16 text-muted-foreground">
                    <Search className="h-8 w-8 mx-auto mb-3 opacity-50" />
                    <p>Nenhum artigo encontrado para "{searchQuery}"</p>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </main>

      <footer className="px-6 py-6 text-center text-xs text-muted-foreground border-t border-border/50">
        © 2026 nutrIAprova — Dados protegidos conforme LGPD
      </footer>

      <BlogEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        editingPost={editingPost}
        onSaved={() => {
          void fetchPosts();
          void fetchMyPending();
        }}
      />
    </div>
  );
}
