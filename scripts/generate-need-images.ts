/**
 * Generates photographic "need" images for browse-by-need hub cards via
 * OpenRouter, saves them under public/images/needs/, and points the matching
 * subcategory rows at them.
 *
 * Setup — the key is read from the environment, never stored in the repo:
 *
 *   # PowerShell
 *   $env:OPENROUTER_API_KEY = "sk-or-v1-..."
 *   npx tsx scripts/generate-need-images.ts --category specialty-supplements
 *
 * Flags:
 *   --category <slug>  which category's subcategories to illustrate (required)
 *   --model <id>       override the image model
 *   --only <slug,slug> restrict to specific subcategories
 *   --force            regenerate even if a heroImage is already set
 *   --dry              print the prompts and exit, calling nothing
 *
 * Existing heroImage values are left alone unless --force is passed, so a photo
 * uploaded by hand is never silently replaced by a generated one.
 */
import "dotenv/config";
import { db } from "../server/db";
import { categories, subcategories } from "../shared/schema";
import { eq } from "drizzle-orm";
import { mkdirSync, writeFileSync } from "fs";
import { collectionHeading } from "../src/lib/headings";

const API_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "google/gemini-2.5-flash-image-preview";
const OUT_DIR = "public/images/needs";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const FORCE = process.argv.includes("--force");
const DRY = process.argv.includes("--dry");
const CATEGORY = arg("category");
const MODEL = arg("model") ?? DEFAULT_MODEL;
const ONLY = arg("only")?.split(",").map(s => s.trim()).filter(Boolean);

/**
 * Subject per need: the benefit or the body area, never a product.
 * Bottles, pills, capsules and packaging are excluded on purpose — the whole
 * point of these cards is to show the outcome rather than the supplement.
 */
const SUBJECTS: Record<string, string> = {
  "bones-joints": "an active woman in her fifties climbing a sunlit outdoor staircase with ease, hand resting lightly on the railing, knees and posture in frame",
  "brain-cognitive": "a focused professional at a tidy desk in warm afternoon light, mid-thought while reading, sharp and alert expression",
  "herbal": "fresh medicinal plants and roots — turmeric, ginger, moringa leaves — arranged on a weathered wooden surface in soft daylight",
  "immunity": "a healthy young adult walking outdoors on a bright cool morning, breathing easily, wearing a light jacket",
  "sleep": "a person sleeping peacefully in crisp white bedding, early dawn light across the pillow, calm and restful",
  "detox-cleanse": "a clear glass of water with cucumber and lemon beside fresh greens on a clean kitchen counter, bright morning light",
  "antioxidants": "a close, richly lit still life of blueberries, pomegranate seeds and dark leafy greens, deep saturated colour",
  "anti-inflammatory": "a runner seated on a track easing tension in a knee after training, late golden light, relaxed and recovering",
  "immune-booster-packs": "a family of four laughing together outdoors in a garden, healthy and energetic, natural light",
  "wellness-bundles": "a calm morning routine scene — yoga mat, water bottle, fresh fruit by a sunlit window",
  "liver-support": "an anatomically accurate human liver rendered as a clean medical illustration on a soft neutral background, warm clinical lighting",
  "kidney-support": "an anatomically accurate pair of human kidneys rendered as a clean medical illustration on a soft neutral background, warm clinical lighting",
  "eye-health": "an extreme close-up of a bright, clear human eye with crisp iris detail, natural light, no makeup",
  "heart-health": "an anatomically accurate human heart rendered as a clean medical illustration on a soft neutral background, warm clinical lighting",
  "stress-anxiety": "a person sitting calmly by a window with eyes closed and shoulders relaxed, soft diffused daylight, unhurried mood",
};

const PHOTO_STYLE = [
  "Photorealistic editorial photograph shot on a full-frame DSLR, 50mm lens at f/2.0",
  "natural light, shallow depth of field, true-to-life skin tones and colour",
  "clean uncluttered composition with room for text overlay",
  "16:10 landscape aspect ratio",
].join(", ");

const NEGATIVE = [
  "no supplement bottles, jars, tablets, capsules, powders or packaging",
  "no text, watermarks, logos or labels",
  "no illustration, cartoon, 3D render or CGI look for people or food scenes",
  "no distorted hands or faces",
].join("; ");

function buildPrompt(subject: string): string {
  return `${subject}. ${PHOTO_STYLE}. Strictly: ${NEGATIVE}.`;
}

/** Pull the first inline image out of an OpenRouter chat response. */
function extractImage(payload: any): { buffer: Buffer; ext: string } | null {
  const message = payload?.choices?.[0]?.message;

  const fromImages = message?.images?.[0]?.image_url?.url ?? message?.images?.[0]?.url;
  const fromContent = Array.isArray(message?.content)
    ? message.content.find((p: any) => p?.type === "image_url")?.image_url?.url
    : undefined;

  const dataUrl: string | undefined = fromImages ?? fromContent;
  if (!dataUrl?.startsWith("data:")) return null;

  const match = dataUrl.match(/^data:image\/([a-zA-Z0-9.+-]+);base64,(.*)$/);
  if (!match) return null;
  return { ext: match[1] === "jpeg" ? "jpg" : match[1], buffer: Buffer.from(match[2], "base64") };
}

async function main() {
  if (!CATEGORY) {
    console.error("Usage: npx tsx scripts/generate-need-images.ts --category <slug> [--only a,b] [--model id] [--force] [--dry]");
    process.exit(1);
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey && !DRY) {
    console.error("OPENROUTER_API_KEY is not set. Export it in your shell, then re-run.");
    console.error('  PowerShell:  $env:OPENROUTER_API_KEY = "sk-or-v1-..."');
    process.exit(1);
  }

  const [cat] = await db.select().from(categories).where(eq(categories.slug, CATEGORY));
  if (!cat) { console.error(`No category with slug "${CATEGORY}".`); process.exit(1); }

  const subs = (await db.select().from(subcategories).where(eq(subcategories.categoryId, cat.id)))
    .filter(s => s.isActive)
    .filter(s => !ONLY || ONLY.includes(s.slug));

  mkdirSync(OUT_DIR, { recursive: true });

  let done = 0, skipped = 0, failed: string[] = [];

  for (const sub of subs) {
    const subject = SUBJECTS[sub.slug];
    if (!subject) { console.log(`skip ${sub.slug} — no subject defined`); skipped++; continue; }
    if (sub.heroImage && !FORCE) { console.log(`skip ${sub.slug} — image already set (use --force)`); skipped++; continue; }

    const prompt = buildPrompt(subject);
    if (DRY) { console.log(`\n${sub.slug}\n  ${prompt}`); continue; }

    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://supplements.ke",
          "X-Title": "supplements.ke need images",
        },
        body: JSON.stringify({
          model: MODEL,
          modalities: ["image", "text"],
          messages: [{ role: "user", content: prompt }],
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        console.error(`FAIL ${sub.slug} — HTTP ${res.status}: ${text.slice(0, 300)}`);
        failed.push(sub.slug);
        continue;
      }

      const image = extractImage(await res.json());
      if (!image) {
        console.error(`FAIL ${sub.slug} — response contained no inline image (model may not support image output)`);
        failed.push(sub.slug);
        continue;
      }

      const file = `${OUT_DIR}/${sub.slug}.${image.ext}`;
      writeFileSync(file, image.buffer);

      await db
        .update(subcategories)
        .set({
          heroImage: `/images/needs/${sub.slug}.${image.ext}`,
          heroImageAlt: sub.heroImageAlt?.trim() || collectionHeading(sub.name, "Kenya", sub.slug),
          updatedAt: new Date(),
        })
        .where(eq(subcategories.id, sub.id));

      console.log(`ok   ${sub.slug} -> ${file} (${Math.round(image.buffer.length / 1024)}KB)`);
      done++;
    } catch (err: any) {
      console.error(`FAIL ${sub.slug} — ${err.message}`);
      failed.push(sub.slug);
    }
  }

  console.log(`\ngenerated ${done}, skipped ${skipped}${failed.length ? `, failed: ${failed.join(", ")}` : ""}`);
  console.log("Review the images before trusting them; replace any you dislike via Admin > Subcategories > Hero Image URL.");
  process.exit(failed.length ? 1 : 0);
}

main().catch(err => { console.error("generation failed:", err); process.exit(1); });
