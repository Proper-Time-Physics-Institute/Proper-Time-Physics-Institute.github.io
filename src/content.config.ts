import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// Worked textbook problems / results, synced from the topic repos by
// scripts/sync-content.mjs (Jackson / Griffiths / Bethe-Salpeter / GPS).
const problems = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/problems' }),
  schema: z.object({
    title: z.string(),
    book: z.string(), // jackson | griffiths | bethe-salpeter | gps
    bookLabel: z.string(),
    chapter: z.string().optional(),
    order: z.number().default(0),
    status: z.string().default('drafted'),
    sourceRepo: z.string().optional(),
    sourcePath: z.string().optional(),
  }),
});

// Long-form roadmap docs, synced from commons.
const roadmap = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/roadmap' }),
  schema: z.object({
    title: z.string(),
    order: z.number().default(0),
    sourceRepo: z.string().optional(),
    sourcePath: z.string().optional(),
  }),
});

export const collections = { problems, roadmap };
