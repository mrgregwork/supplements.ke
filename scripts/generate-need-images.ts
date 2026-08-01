/**
 * Generates photographic "need" images for browse-by-need hub cards via
 * OpenRouter, saves them under public/images/needs/, and points the matching
 * subcategory rows at them.
 *
 * Setup — the key is read from the environment, never stored in the repo:
 *
 *   # Command Prompt
 *   set OPENROUTER_API_KEY=sk-or-v1-...
 *   # PowerShell
 *   $env:OPENROUTER_API_KEY = "sk-or-v1-..."
 *
 *   npx tsx scripts/generate-need-images.ts --category vitamins
 *   npx tsx scripts/generate-need-images.ts --all
 *
 * Flags:
 *   --category <slug>  one category's subcategories
 *   --all              every category defined in scripts/data/need-cards.json
 *   --model <id>       override the image model
 *   --only <slug,slug> restrict to specific subcategories
 *   --force            regenerate even if a heroImage is already set
 *   --dry              print the prompts and exit, calling nothing
 *
 * Existing heroImage values are left alone unless --force, so a photo uploaded
 * by hand is never silently replaced by a generated one.
 */
import "dotenv/config";
import { readFileSync, mkdirSync } from "fs";
import sharp from "sharp";
import { db } from "../server/db";
import { categories, subcategories } from "../shared/schema";
import { eq } from "drizzle-orm";
import { collectionHeading } from "../src/lib/headings";

const API_URL = "https://openrouter.ai/api/v1/chat/completions";
/**
 * Must be a model whose architecture.output_modalities includes "image" —
 * most OpenRouter models are text-only and return 404 "No endpoints found".
 * Check the current list with: curl -s https://openrouter.ai/api/v1/models
 * Higher quality alternative: google/gemini-3-pro-image
 */
const DEFAULT_MODEL = "google/gemini-2.5-flash-image";
const OUT_DIR = "public/images/needs";

type Card = { excerpt: string; scene: string; cast: "person" | "family" | "none" };
type Data = Record<string, Record<string, Card>>;
const DATA: Data = JSON.parse(readFileSync("scripts/data/need-cards.json", "utf8"));

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const FORCE = process.argv.includes("--force");
const DRY = process.argv.includes("--dry");
const ALL = process.argv.includes("--all");
const CATEGORY = arg("category");
const MODEL = arg("model") ?? DEFAULT_MODEL;
const ONLY = arg("only")?.split(",").map(s => s.trim()).filter(Boolean);

/**
 * Casting for scenes with people. The store serves Kenya, so the faces should
 * look like its customers: Black Kenyan and Indian-Kenyan men and women in a
 * deliberate mix. Scenes in need-cards.json describe people neutrally ("a
 * person") and the casting is injected here, so the mix can be rebalanced in
 * one place instead of rewriting every scene.
 *
 * Assignment is round-robin over the run's ordered work list rather than random
 * or hash-based, which guarantees an even spread instead of clustering.
 */
const WOMEN_CASTING = [
  "a strikingly beautiful Black Kenyan woman in her late twenties",
  "a strikingly beautiful Indian-Kenyan woman in her thirties",
  "a beautiful Black Kenyan woman in her forties",
  "a beautiful Indian-Kenyan woman in her late twenties",
];

const MEN_CASTING = [
  "a handsome Black Kenyan man in his thirties",
  "a handsome Indian-Kenyan man in his forties",
  "a handsome Black Kenyan man in his late twenties",
  "a handsome Indian-Kenyan man in his thirties",
];

const FAMILY_CASTING = [
  "a happy Black Kenyan family",
  "a happy Indian-Kenyan family",
  "a group of Black Kenyan and Indian-Kenyan friends together",
];

/**
 * Some collections are inherently gendered — casting a man for postnatal
 * recovery or a woman for prostate health would be plainly wrong — so the
 * subject's gender is fixed by context and only the ethnicity rotates.
 * Everything else alternates.
 */
function requiredGender(categorySlug: string, subSlug: string, subName: string): "women" | "men" | "any" {
  const hay = `${subSlug} ${subName}`.toLowerCase();
  if (categorySlug === "womens-health") return "women";
  if (categorySlug === "mens-health") return "men";
  if (/\bwomen|women's|prenatal|postnatal|menopause|maternal\b/.test(hay)) return "women";
  if (/\bmen\b|men's|testosterone|prostate/.test(hay)) return "men";
  return "any";
}

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

/** supplement-forms is about the format itself, so the product IS the subject. */
const PRODUCT_IS_SUBJECT = new Set(["supplement-forms"]);

function buildPrompt(
  scene: string,
  cast: Card["cast"],
  castIndex: number,
  categorySlug: string,
  subSlug: string,
  subName: string
): string {
  let subject = scene;

  if (cast === "person") {
    const gender = requiredGender(categorySlug, subSlug, subName);
    const pool = gender === "women" ? WOMEN_CASTING
      : gender === "men" ? MEN_CASTING
      : (castIndex % 2 === 0 ? WOMEN_CASTING : MEN_CASTING);
    const who = pool[Math.floor(castIndex / (gender === "any" ? 2 : 1)) % pool.length];

    const replaced = subject.replace(/\b(a person|someone|a man|a woman|an adult|a mother|a father)\b/i, who);
    subject = replaced !== subject ? replaced : `${who}, ${subject}`;
  } else if (cast === "family") {
    const who = FAMILY_CASTING[castIndex % FAMILY_CASTING.length];
    const replaced = subject.replace(/\b(a family|a couple|a group of people|people)\b/i, who);
    subject = replaced !== subject ? replaced : `${who}, ${subject}`;
  }

  const negative = PRODUCT_IS_SUBJECT.has(categorySlug)
    ? "no branded packaging, no bottles with logos, no text, watermarks or labels; no distorted shapes"
    : NEGATIVE;

  return `${subject}. ${PHOTO_STYLE}. Strictly: ${negative}.`;
}

/** Pull the first inline image out of an OpenRouter chat response. */
function extractImage(payload: any): Buffer | null {
  const message = payload?.choices?.[0]?.message;
  const fromImages = message?.images?.[0]?.image_url?.url ?? message?.images?.[0]?.url;
  const fromContent = Array.isArray(message?.content)
    ? message.content.find((p: any) => p?.type === "image_url")?.image_url?.url
    : undefined;

  const dataUrl: string | undefined = fromImages ?? fromContent;
  if (!dataUrl?.startsWith("data:")) return null;
  const match = dataUrl.match(/^data:image\/[a-zA-Z0-9.+-]+;base64,(.*)$/);
  return match ? Buffer.from(match[1], "base64") : null;
}

async function main() {
  const targets = ALL ? Object.keys(DATA) : CATEGORY ? [CATEGORY] : [];
  if (!targets.length) {
    console.error("Usage: npx tsx scripts/generate-need-images.ts (--category <slug> | --all) [--only a,b] [--model id] [--force] [--dry]");
    console.error(`Categories available: ${Object.keys(DATA).join(", ")}`);
    process.exitCode = 1;
    return;
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey && !DRY) {
    console.error("OPENROUTER_API_KEY is not set. Set it in your shell, then re-run.");
    console.error('  Command Prompt:  set OPENROUTER_API_KEY=sk-or-v1-...');
    process.exitCode = 1;
    return;
  }

  mkdirSync(OUT_DIR, { recursive: true });

  // Build the full work list first so casting can be spread evenly across it.
  type Job = { catSlug: string; row: typeof subcategories.$inferSelect; card: Card };
  const jobs: Job[] = [];

  for (const catSlug of targets) {
    const cards = DATA[catSlug];
    if (!cards) { console.error(`no scenes defined for "${catSlug}"`); continue; }

    const [cat] = await db.select().from(categories).where(eq(categories.slug, catSlug));
    if (!cat) { console.error(`no category with slug "${catSlug}"`); continue; }

    const rows = await db.select().from(subcategories).where(eq(subcategories.categoryId, cat.id));
    for (const row of rows) {
      if (!row.isActive) continue;
      if (ONLY && !ONLY.includes(row.slug)) continue;
      const card = cards[row.slug];
      if (!card) continue;
      jobs.push({ catSlug, row, card });
    }
  }

  let castCursor = 0;
  let done = 0, skipped = 0;
  const failed: string[] = [];

  for (const { catSlug, row, card } of jobs) {
    const castIndex = card.cast === "none" ? 0 : castCursor++;
    const prompt = buildPrompt(card.scene, card.cast, castIndex, catSlug, row.slug, row.name);

    if (DRY) { console.log(`\n${catSlug}/${row.slug} [${card.cast}]\n  ${prompt}`); continue; }
    if (row.heroImage && !FORCE) { console.log(`skip ${catSlug}/${row.slug} — image already set`); skipped++; continue; }

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
        console.error(`FAIL ${catSlug}/${row.slug} — HTTP ${res.status}: ${text.slice(0, 200)}`);
        if (res.status === 404 && text.includes("No endpoints found")) {
          console.error(`       "${MODEL}" is not an image model. Try --model google/gemini-2.5-flash-image`);
        }
        failed.push(`${catSlug}/${row.slug}`);
        continue;
      }

      const buffer = extractImage(await res.json());
      if (!buffer) {
        console.error(`FAIL ${catSlug}/${row.slug} — no inline image in response`);
        failed.push(`${catSlug}/${row.slug}`);
        continue;
      }

      // Models return ~1.4MB PNGs. Cards display around 385px wide, so raw
      // output would mean tens of MB per page; WebP at 1000px keeps each well
      // under 100KB with no visible difference at display size.
      const file = `${OUT_DIR}/${row.slug}-${catSlug}.webp`;
      await sharp(buffer)
        .resize(1000, 625, { fit: "cover", position: "attention" })
        .webp({ quality: 82 })
        .toFile(file);

      await db
        .update(subcategories)
        .set({
          heroImage: `/images/needs/${row.slug}-${catSlug}.webp`,
          heroImageAlt: row.heroImageAlt?.trim() || collectionHeading(row.name, "Kenya", row.slug),
          updatedAt: new Date(),
        })
        .where(eq(subcategories.id, row.id));

      console.log(`ok   ${catSlug}/${row.slug}`);
      done++;
    } catch (err: any) {
      console.error(`FAIL ${catSlug}/${row.slug} — ${err.message}`);
      failed.push(`${catSlug}/${row.slug}`);
    }
  }

  if (!DRY) {
    console.log(`\ngenerated ${done}, skipped ${skipped}${failed.length ? `, failed: ${failed.join(", ")}` : ""}`);
    console.log("Review them, then commit public/images/needs — the database points at these paths,");
    console.log("so production 404s until the files are pushed.");
  }
  // Set the code rather than calling process.exit(): exiting while fetch
  // keep-alive sockets are open trips a libuv assertion on Windows.
  process.exitCode = failed.length ? 1 : 0;
}

main().catch(err => { console.error("generation failed:", err); process.exitCode = 1; });
