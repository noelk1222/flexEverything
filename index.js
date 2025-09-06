import express from "express";
import fetch from "node-fetch";

const app = express();
const PORT = process.env.PORT || 3000;
const BASE = "https://users.roblox.com/v1";

// Utility fetch wrapper
async function getJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch failed ${res.status}`);
  return res.json();
}

// Calculate account age (days)
function getAccountAgeDays(created) {
  return Math.floor((Date.now() - new Date(created)) / (1000 * 60 * 60 * 24));
}

// Title logic
function calculateTitles(userInfo, collectibles, itemsResp, badges) {
  const titles = [];

  const accountAge = getAccountAgeDays(userInfo.created);
  const rap = collectibles.reduce((sum, c) => sum + (c.recentAveragePrice || 0), 0);
  const collectiblesCount = collectibles.length;
  const badgeCount = badges.length;
  const shirts = itemsResp.Shirts?.length || 0;
  const pants = itemsResp.Pants?.length || 0;
  const gear = itemsResp.Gear?.length || 0;

  // Account progression
  if (accountAge < 100) titles.push("Newcomer");
  if (accountAge >= 100) titles.push("Rookie");
  if (accountAge >= 1000) titles.push("Veteran");
  if (accountAge >= 3000) titles.push("Ancient");

  // RAP
  if (rap >= 1000) titles.push("Beginner Collector");
  if (rap >= 10000) titles.push("Trader");
  if (rap >= 100000) titles.push("Wealthy");
  if (rap >= 1000000) titles.push("Millionaire");
  if (rap >= 10000000) titles.push("Rainbow Flexer");

  // Collectibles
  if (collectiblesCount >= 10) titles.push("Hoarder");
  if (collectiblesCount >= 50) titles.push("Stacker");
  if (collectiblesCount >= 100) titles.push("Collector");
  if (collectiblesCount >= 250) titles.push("Obsessed");
  if (collectiblesCount >= 500) titles.push("Hoard Lord");

  // Special
  if (badgeCount >= 50) titles.push("Badge Hunter");
  if (new Date(userInfo.created) < new Date("2015-01-01")) titles.push("OG");
  if (shirts + pants >= 100) titles.push("Fashionista");
  if (gear >= 20) titles.push("Gearhead");

  // Meme Lord example
  const funnyIds = [12345, 54321]; // replace with actual item IDs
  const ownsMeme = Object.values(itemsResp).some(list =>
    list.some(i => funnyIds.includes(i.assetId))
  );
  if (ownsMeme) titles.push("Meme Lord");

  return titles;
}

// Endpoint: /full/:userId
app.get("/full/:userId", async (req, res) => {
  try {
    const uid = req.params.userId;

    // User info (join date, etc.)
    const userInfo = await getJSON(`${BASE}/users/${uid}`);

    // Collectibles
    const collectibles = (await getJSON(`https://inventory.roblox.com/v1/users/${uid}/assets/collectibles?sortOrder=Asc&limit=100`)).data || [];

    // Items by type
    const ITEM_TYPES = { 8: "Hats", 18: "Faces", 11: "Shirts", 12: "Pants", 19: "Gear", 41: "Hair" };
    const itemsResp = {};
    for (const [typeId, name] of Object.entries(ITEM_TYPES)) {
      const data = await getJSON(`https://inventory.roblox.com/v2/users/${uid}/inventory/${typeId}?limit=100&sortOrder=Asc`);
      itemsResp[name] = data.data || [];
    }

    // Badges
    const badges = (await getJSON(`https://badges.roblox.com/v1/users/${uid}/badges?limit=100&sortOrder=Asc`)).data || [];

    // Titles
    const titles = calculateTitles(userInfo, collectibles, itemsResp, badges);

    res.json({
      userInfo,
      collectibles,
      items: itemsResp,
      badges,
      titles
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch full data" });
  }
});

app.listen(PORT, () => console.log(`Server running on ${PORT}`));
