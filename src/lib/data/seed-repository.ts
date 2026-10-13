import { contentSchema, type Content } from "@/content/schema";
import seed from "@/content/seed.json";
import type { ContentRepository } from "./repository";

export class SeedRepository implements ContentRepository {
  async getContent(): Promise<Content> {
    return contentSchema.parse(seed);
  }
}
