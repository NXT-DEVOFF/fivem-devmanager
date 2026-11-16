/** Types et helpers partages du module Base de connaissances. */
import { toStringArray } from "@/lib/json-array";

export interface KnowledgePerson {
  id: string;
  displayName: string;
  avatarColor: string;
}

export interface KnowledgeArticle {
  id: string;
  title: string;
  category: string;
  summary: string | null;
  content: string;
  tags: string[];
  pinned: boolean;
  author: KnowledgePerson;
  updatedBy: KnowledgePerson | null;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeArticleInput {
  id: string;
  title: string;
  category: string;
  summary: string | null;
  content: string;
  tags: unknown;
  pinned: boolean;
  author: KnowledgePerson;
  updatedBy: KnowledgePerson | null;
  createdAt: Date;
  updatedAt: Date;
}

export function serializeKnowledgeArticle(article: KnowledgeArticleInput): KnowledgeArticle {
  return {
    ...article,
    tags: toStringArray(article.tags),
    createdAt: article.createdAt.toISOString(),
    updatedAt: article.updatedAt.toISOString(),
  };
}

/** Resume lisible d'un contenu, sans balises Markdown basiques. */
export function knowledgeExcerpt(value: string, max = 180): string {
  const plain = value
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[*_~`>#-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (plain.length <= max) return plain;
  return `${plain.slice(0, Math.max(1, max - 1)).trimEnd()}…`;
}

/** Categories distinctes, triees pour les filtres de l'interface. */
export function knowledgeCategories(articles: Array<{ category: string }>): string[] {
  return [...new Set(articles.map((article) => article.category).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "fr"),
  );
}
