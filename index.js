// index.js (Node on Railway)
import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

const RBLX = {
  collectibles: (uid, cursor = "") =>
    `https://inventory.roblox.com/v1/users/${uid}/assets/collectibles?limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
  badges: (uid, cursor = "") =>
    `https://badges.roblox.com/v1/users/${uid}/badges?limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
  user: (uid) => `https://users.roblox.com/v1/users/${uid}`,
  // Optional: owned items by type (if you want clothing totals, etc.)
  itemsByType: (uid, typeId, cursor = "") =>
    `https://inventory.roblox.com/v2/users/${uid}/inventory?assetTypes=${typeId}&limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
};

async function getPaged(urlBuilder) {
  let cursor = "";
  const out = [];
  for (let i = 0; i < 50; i++) { // hard stop to avoid infinite loops
    const url = urlBuilder(cursor);
    const res = await fetch(url, { headers: { "accept": "application/json" }});
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Fetch failed ${res.status}: ${txt}`);
    }
    const json = await res.json();
    const data = Array.isArray(json.data) ? json.data : [];
    out.push(...data);
    cursor = json.nextPageCursor || "";
    if (!cursor) break;
  }
  return out;
}

async function getCollectiblesWithRap(uid) {
  const all = await getPaged((c) => RBLX.collectibles(uid, c));
  // robust coercion + null safety
  let totalRap = 0;
  for (const c of all) {
    const rap = Number(c.recentAveragePrice || 0);
    if (!Number.isNaN(rap)) totalRap += rap;
  }
  return { items: all, totalRap };
}

async function getBadges(uid) {
  const all = await getPaged((c) => RBLX.badges(uid, c));
  return all;
}

async function getUser(uid) {
  const res = await fetch(RBLX.user(uid));
  if (!res.ok) return null;
  return await res.json(); // { id, name, displayName, created, ... }
}

// Optional: clothing counts (Shirts, Pants, TShirts)
const CLOTHING_TYPES = [2, 11, 12]; // TShirts, Shirts, Pants
async function getClothesCount(uid) {
  let total = 0;
  for (const t of CLOTHING_TYPES) {
    const items = await getPaged((c) => RBLX.itemsByType(uid, t, c));
    total += items.length;
  }
  return total;
}

app.get("/collectibles/:uid", async (req, res) => {
  try {
    const { uid } = req.params;
    const result = await getCollectiblesWithRap(uid);
    res.json({ data: result.items, totalRap: result.totalRap, count: result.items.length });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get("/badges/:uid", async (req, res) => {
  try {
    const { uid } = req.params;
    const badges = await getBadges(uid);
    res.json({ data: badges, count: badges.length });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get("/full/:uid", async (req, res) => {
  try {
    const { uid } = req.params;

    const [user, collectibles, badges, clothesCount] = await Promise.all([
      getUser(uid),
      getCollectiblesWithRap(uid),
      getBadges(uid),
      getClothesCount(uid),
    ]);

    res.json({
      user: user || { id: Number(uid) },
      created: user?.created || null,
      collectibles: collectibles.items,
      totalRap: collectibles.totalRap,
      badges,
      badgeCount: badges.length,
      clothesCount,
      // space to add “items by type” if you want them in the UI
      titles: [], // if you precompute any title unlocks, otherwise leave empty
    });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log("Proxy listening on", port));
