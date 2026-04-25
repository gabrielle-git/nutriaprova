import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Heart, Bookmark, ImagePlus, Send, ShoppingBag, Leaf, Dumbbell, Crown, Sparkles } from "lucide-react";
import AppHeader from "@/components/AppHeader";
import MobileBottomNav from "@/components/MobileBottomNav";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Role = "nutritionist" | "personal_trainer" | "admin";

interface Post {
  id: string;
  authorName: string;
  authorRole: Role;
  authorInitials: string;
  text: string;
  imageUrl?: string;
  createdAt: string;
  likes: number;
  liked?: boolean;
  saved?: boolean;
}

const SUPREME_EMAIL = "helena.gaby31@gmail.com";

/*
SQL necessario caso as tabelas da Comunidade ainda nao existam:

create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  author_name text not null,
  author_role text not null check (author_role in ('nutritionist', 'personal_trainer', 'admin')),
  author_initials text not null,
  text text not null,
  image_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.post_likes (
  post_id uuid not null references public.community_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

alter table public.community_posts enable row level security;
alter table public.post_likes enable row level security;

create policy "Authenticated users can view community posts"
on public.community_posts for select to authenticated using (true);

create policy "Professionals can publish community posts"
on public.community_posts for insert to authenticated
with check (
  author_id = auth.uid()
  and exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid()
      and p.role in ('nutritionist', 'personal_trainer', 'admin')
  )
);

create policy "Authors can delete own community posts"
on public.community_posts for delete to authenticated using (author_id = auth.uid());

create policy "Authenticated users can view post likes"
on public.post_likes for select to authenticated using (true);

create policy "Users can like posts"
on public.post_likes for insert to authenticated with check (user_id = auth.uid());

create policy "Users can remove own likes"
on public.post_likes for delete to authenticated using (user_id = auth.uid());
*/

type CommunityPostRow = {
  id: string;
  author_id: string;
  author_name: string;
  author_role: Role;
  author_initials: string;
  text: string;
  image_url: string | null;
  created_at: string;
};

function RoleBadge({ role }: { role: Role }) {
  if (role === "nutritionist")
    return (
      <Badge className="gap-1 bg-primary/10 text-primary border border-primary/30 hover:bg-primary/15">
        <Leaf className="h-3 w-3" /> Nutricionista
      </Badge>
    );
  if (role === "personal_trainer")
    return (
      <Badge className="gap-1 bg-orange-500/10 text-orange-600 border border-orange-500/30 hover:bg-orange-500/15 dark:text-orange-400">
        <Dumbbell className="h-3 w-3" /> Personal
      </Badge>
    );
  return (
    <Badge className="gap-1 bg-amber-500/10 text-amber-600 border border-amber-500/30 hover:bg-amber-500/15 dark:text-amber-400">
      <Crown className="h-3 w-3" /> Admin
    </Badge>
  );
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function formatRelativeDate(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60000));
  if (diffMinutes < 1) return "Agora";
  if (diffMinutes < 60) return `Há ${diffMinutes}min`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `Há ${diffHours}h`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "Há 1 dia";
  if (diffDays < 7) return `Há ${diffDays} dias`;

  return new Date(iso).toLocaleDateString("pt-BR");
}

export default function Comunidade() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [posts, setPosts] = useState<Post[]>([]);
  const [newText, setNewText] = useState("");
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [publishing, setPublishing] = useState(false);

  const isSupreme = user?.email?.toLowerCase() === SUPREME_EMAIL.toLowerCase();
  const role = (profile?.role as string) || "";
  const canPost = useMemo(
    () => isSupreme || role === "nutritionist" || role === "admin" || role === "personal_trainer",
    [isSupreme, role]
  );

  const currentRole: Role = isSupreme || role === "admin"
    ? "admin"
    : role === "personal_trainer"
    ? "personal_trainer"
    : "nutritionist";

  const fetchPosts = async () => {
    if (!user) {
      setPosts([]);
      setLoadingPosts(false);
      return;
    }

    setLoadingPosts(true);

    const { data, error } = await (supabase as any)
      .from("community_posts")
      .select("id, author_id, author_name, author_role, author_initials, text, image_url, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[Comunidade] community_posts fetch:", error);
      toast.error("Não foi possível carregar a Comunidade. Verifique se as tabelas SQL foram criadas.");
      setPosts([]);
      setLoadingPosts(false);
      return;
    }

    const rows = (data ?? []) as CommunityPostRow[];
    const postIds = rows.map((post) => post.id);
    const likesByPost = new Map<string, number>();
    const likedByMe = new Set<string>();

    if (postIds.length > 0) {
      const { data: likesData, error: likesError } = await (supabase as any)
        .from("post_likes")
        .select("post_id, user_id")
        .in("post_id", postIds);

      if (likesError) {
        console.error("[Comunidade] post_likes fetch:", likesError);
      } else {
        (likesData ?? []).forEach((like: { post_id: string; user_id: string }) => {
          likesByPost.set(like.post_id, (likesByPost.get(like.post_id) ?? 0) + 1);
          if (like.user_id === user.id) likedByMe.add(like.post_id);
        });
      }
    }

    setPosts(
      rows.map((post) => ({
        id: post.id,
        authorName: post.author_name,
        authorRole: post.author_role,
        authorInitials: post.author_initials,
        text: post.text,
        imageUrl: post.image_url ?? undefined,
        createdAt: formatRelativeDate(post.created_at),
        likes: likesByPost.get(post.id) ?? 0,
        liked: likedByMe.has(post.id),
      })),
    );
    setLoadingPosts(false);
  };

  useEffect(() => {
    void fetchPosts();
  }, [user]);

  const handlePublish = async () => {
    if (!newText.trim()) {
      toast.error("Escreva algo antes de publicar.");
      return;
    }

    if (!user || !canPost) {
      toast.error("Apenas profissionais podem publicar na Comunidade.");
      return;
    }

    const authorName = profile?.full_name || user.email || "Você";
    const text = newText.trim();
    setPublishing(true);

    const { error } = await (supabase as any).from("community_posts").insert({
      author_id: user.id,
      author_name: authorName,
      author_role: currentRole,
      author_initials: getInitials(authorName || "EU"),
      text,
    });

    setPublishing(false);

    if (error) {
      console.error("[Comunidade] publish:", error);
      toast.error("Não foi possível publicar. Verifique as permissões da tabela community_posts.");
      return;
    }

    setNewText("");
    await fetchPosts();
    toast.success("Publicado na Comunidade!");
  };

  const toggleLike = async (id: string) => {
    if (!user) {
      toast.error("Faça login para curtir publicações.");
      return;
    }

    const post = posts.find((item) => item.id === id);
    if (!post) return;

    const nextLiked = !post.liked;
    setPosts((arr) =>
      arr.map((item) =>
        item.id === id
          ? { ...item, liked: nextLiked, likes: item.likes + (nextLiked ? 1 : -1) }
          : item,
      ),
    );

    const { error } = nextLiked
      ? await (supabase as any).from("post_likes").insert({ post_id: id, user_id: user.id })
      : await (supabase as any)
          .from("post_likes")
          .delete()
          .eq("post_id", id)
          .eq("user_id", user.id);

    if (error) {
      console.error("[Comunidade] toggle like:", error);
      setPosts((arr) =>
        arr.map((item) =>
          item.id === id
            ? { ...item, liked: post.liked, likes: post.likes }
            : item,
        ),
      );
      toast.error("Não foi possível atualizar sua curtida.");
    }
  };

  const toggleSave = (id: string) => {
    setPosts((arr) => arr.map((p) => (p.id === id ? { ...p, saved: !p.saved } : p)));
    toast.success("Receita salva no seu perfil!");
  };

  const handleHire = (authorName: string) => {
    toast.success(`Solicitação enviada para ${authorName}!`, {
      description: "Você será redirecionado para iniciar sua dieta personalizada.",
    });
    setTimeout(() => navigate("/?tab=dieta"), 800);
  };

  return (
    <div className="min-h-screen bg-background pb-24 md:pb-8">
      <AppHeader />

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h1 className="font-display text-2xl font-bold">Comunidade nutrIAprova</h1>
        </div>
        <p className="text-sm text-muted-foreground -mt-3">
          Receitas, dicas de treino e conteúdo dos melhores profissionais da plataforma.
        </p>

        {/* Composer — only nutri / personal / admin */}
        {canPost && (
          <Card className="glass-modal border-primary/20">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                    {getInitials(profile?.full_name || user?.email || "EU")}
                  </AvatarFallback>
                </Avatar>
                <Textarea
                  value={newText}
                  onChange={(e) => setNewText(e.target.value)}
                  placeholder="Compartilhe uma receita, dica ou novidade com a comunidade..."
                  className="min-h-[80px] resize-none border-border/60 focus-visible:ring-primary"
                />
              </div>
              <div className="flex items-center justify-between">
                <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" disabled>
                  <ImagePlus className="h-4 w-4" /> Imagem
                </Button>
                <Button onClick={handlePublish} size="sm" className="gap-1.5" disabled={publishing}>
                  <Send className="h-4 w-4" /> {publishing ? "Publicando..." : "Publicar"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {!canPost && user && (
          <Card className="border-dashed border-primary/30 bg-primary/5">
            <CardContent className="p-4 text-sm text-muted-foreground">
              Apenas profissionais (Nutricionistas e Personal Trainers) podem publicar. Você pode curtir e salvar receitas. 💚
            </CardContent>
          </Card>
        )}

        {/* Feed */}
        <div className="space-y-4 stagger-children">
          {loadingPosts ? (
            <Card className="border-border/60">
              <CardContent className="p-8 text-center text-sm text-muted-foreground">
                Carregando publicações...
              </CardContent>
            </Card>
          ) : posts.length === 0 ? (
            <Card className="border-dashed border-primary/30 bg-primary/5">
              <CardContent className="p-8 text-center text-sm text-muted-foreground">
                Ainda não há publicações na Comunidade.
              </CardContent>
            </Card>
          ) : (
          posts.map((post) => (
            <Card key={post.id} className="overflow-hidden border-border/60 hover:border-primary/30 transition-colors">
              <CardContent className="p-0">
                {/* Header */}
                <div className="flex items-center gap-3 p-4">
                  <Avatar className="h-11 w-11 ring-2 ring-primary/20">
                    <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                      {post.authorInitials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm truncate">{post.authorName}</p>
                      <RoleBadge role={post.authorRole} />
                    </div>
                    <p className="text-xs text-muted-foreground">{post.createdAt}</p>
                  </div>
                </div>

                {/* Text */}
                <p className="px-4 pb-3 text-sm leading-relaxed whitespace-pre-wrap">{post.text}</p>

                {/* Image */}
                {post.imageUrl && (
                  <img
                    src={post.imageUrl}
                    alt="Post"
                    loading="lazy"
                    className="w-full max-h-[420px] object-cover"
                  />
                )}

                {/* CTA — Marketplace hook for nutritionists */}
                {post.authorRole === "nutritionist" && (
                  <div className="px-4 pt-3">
                    <Button
                      onClick={() => handleHire(post.authorName)}
                      className="w-full gap-2 bg-gradient-to-r from-primary to-primary/80 hover:from-primary hover:to-primary text-primary-foreground btn-lift"
                    >
                      <ShoppingBag className="h-4 w-4" />
                      Fazer Dieta com este Nutri
                    </Button>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-1 p-2 mt-2 border-t border-border/50">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleLike(post.id)}
                    className={`gap-1.5 ${post.liked ? "text-red-500 hover:text-red-600" : ""}`}
                  >
                    <Heart className={`h-4 w-4 ${post.liked ? "fill-current" : ""}`} />
                    <span className="text-xs font-medium">{post.likes}</span>
                    <span className="hidden sm:inline text-xs">Curtir</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleSave(post.id)}
                    className={`gap-1.5 ml-auto ${post.saved ? "text-primary" : ""}`}
                  >
                    <Bookmark className={`h-4 w-4 ${post.saved ? "fill-current" : ""}`} />
                    <span className="hidden sm:inline text-xs">Salvar</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
          )}
        </div>
      </main>

      <MobileBottomNav />
    </div>
  );
}
