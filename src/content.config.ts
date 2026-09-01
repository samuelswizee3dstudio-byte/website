import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';

// All site copy lives as markdown in src/content/copy/, edited on GitHub by the
// family. Frontmatter is deliberately tiny — see HOWTO.md.
const videoId = z
  .string()
  .regex(/^[A-Za-z0-9_-]{11}$/, 'A YouTube video ID is 11 characters, e.g. dQw4w9WgXcQ');

const copy = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/copy' }),
  schema: z.object({
    title: z.string(),
    description: z.string().max(160).optional(),
    // About page only: unlisted YouTube videos, rendered as embeds.
    // Either a bare ID, or an ID with a caption:
    //   videos: ["dQw4w9WgXcQ"]
    //   videos: [{ id: "dQw4w9WgXcQ", title: "Printing a lizard" }]
    videos: z
      .array(
        z.union([
          videoId,
          z.object({ id: videoId, title: z.string().optional() }),
        ])
      )
      .default([])
      .transform((list) => list.map((v) => (typeof v === 'string' ? { id: v } : v))),
  }),
});

export const collections = { copy };
