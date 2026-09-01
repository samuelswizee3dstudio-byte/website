import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';

// All site copy lives as markdown in src/content/copy/, edited on GitHub by the
// family. Frontmatter is deliberately tiny — see HOWTO.md.
const copy = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/copy' }),
  schema: z.object({
    title: z.string(),
    description: z.string().max(160).optional(),
    // About page only: unlisted YouTube video IDs, rendered as embeds.
    videos: z.array(z.string().regex(/^[A-Za-z0-9_-]{11}$/, 'A YouTube video ID is 11 characters, e.g. dQw4w9WgXcQ')).default([]),
  }),
});

export const collections = { copy };
