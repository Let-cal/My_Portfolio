import type { Content } from "@/content/schema";

export interface ContentRepository {
  getContent(): Promise<Content>;
}
