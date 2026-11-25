// Resources stay English: no accents or French words in sticker
// labels/categories or photo fields (ids, themes, descriptions, tones).
// Deliberate Unicode design content in tests (like "Fête d'été") is out of
// scope: this guards the shipped resources only.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { photosFile, stickersDir } from "../paths.js";

const ACCENTS = /[éèêëàâäôöûüîïçœæÉÈÊËÀÂÄÔÖÛÜÎÏÇŒÆ]/;

// Unambiguous French function words (word-boundary match). Words that also
// occur in English on their own (or, est, son, plus, car, non ...) stay out.
const FRENCH = [
  "de", "la", "le", "les", "des", "du", "un", "une", "au", "aux",
  "avec", "pour", "sur", "dans", "sous", "chez", "entre", "contre",
  "dont", "que", "qui", "quand", "comme", "tres", "tous", "chaque",
  "aucun", "autre", "meme", "notre", "votre", "leur", "ce", "cette",
  "ces", "nous", "vous", "ils", "elles", "oui", "si", "mais", "ou",
  "donc", "puis", "ici", "voila", "et", "avoir", "faire", "voir",
  "se", "te", "lui", "mes", "tes", "ses", "nos", "vos",
  "ne", "ete", "noel", "fetes",
  "ananas", "banane", "fromage", "chien", "chat", "oiseau", "fleur",
  "fleurs", "femme", "homme", "enfant", "enfants", "bouton",
  "chapeau", "chaussure", "montre", "bague", "collier", "gateau",
  "tarte", "fete", "bebe", "hiver", "printemps", "automne",
  "creme", "beurre", "magasin", "boulangerie", "voiture", "jardin",
  "plage", "couleur", "visage", "coeur", "rouge", "bleu", "vert",
  "jaune", "noir", "blanc", "violet", "gris", "soleil", "lune",
  "montagne", "neige", "pluie", "vent", "ville", "fille", "robe",
  "sac", "vin", "maman", "papa",
];

function frenchWords(text: string): string[] {
  const folded = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return FRENCH.filter((w) => new RegExp(`\\b${w}\\b`).test(folded));
}

// Standard English spellings the word scan would otherwise flag.
const ALLOW = new Set(["fleur-de-lis"]);

function checkField(origin: string, value: string): void {
  assert.ok(!ACCENTS.test(value), `${origin} holds an accent: ${value}`);
  if (ALLOW.has(value.toLowerCase())) return;
  const words = frenchWords(value);
  assert.deepEqual(words, [], `${origin} looks French (${words.join(", ")}): ${value}`);
}

function loadJson(file: string): unknown {
  return JSON.parse(fs.readFileSync(file, "utf-8")) as unknown;
}

test("stickers and photos stay English", () => {
  const manifest = loadJson(path.join(stickersDir(), "manifest.json")) as Array<{
    id: string;
    label: string;
    category: string;
    keywords: string[];
  }>;
  assert.ok(manifest.length > 3000);
  for (const e of manifest) {
    checkField(`sticker ${e.id} label`, String(e.label ?? ""));
    checkField(`sticker ${e.id} category`, String(e.category ?? ""));
    for (const k of e.keywords ?? []) checkField(`sticker ${e.id} keyword`, String(k));
  }

  const photos = loadJson(photosFile()) as Array<{
    id: string;
    themes: string[];
    description: string;
    tone: string;
  }>;
  assert.ok(photos.length > 100);
  for (const p of photos) {
    checkField(`photo ${p.id} id`, p.id);
    checkField(`photo ${p.id} description`, p.description);
    checkField(`photo ${p.id} tone`, p.tone);
    for (const t of p.themes ?? []) checkField(`photo ${p.id} theme`, t);
    assert.ok(["light", "dark", "colorful"].includes(p.tone), `photo ${p.id} has an unknown tone: ${p.tone}`);
  }
});

test("renamed resources resolve to English ids", () => {
  const manifest = loadJson(path.join(stickersDir(), "manifest.json")) as Array<{ id: string }>;
  const ids = new Set(manifest.map((e) => e.id));
  assert.ok(ids.has("blum/pineapple"));
  assert.ok(ids.has("blum-doodles/wavy-underline"));
  assert.ok(!ids.has("blum/ananas.svg") && ![...ids].some((i) => i.includes("ananas")));
  assert.ok(ids.has("blum/champagne-coupe"));

  const photos = loadJson(photosFile()) as Array<{ id: string; tone: string }>;
  const photoIds = new Set(photos.map((p) => p.id));
  assert.ok(photoIds.has("clinking-lattes"));
  assert.ok(![...photoIds].some((i) => i.includes("lattes-mains")));
});
