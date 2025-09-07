import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;

// 🔧 Safe fetch wrapper
async function getJSON(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return await res.json();
  } catch (err) {
    console.error("Fetch failed:", url, err.message);
    return null;
  }
}

// 🔧 Handles cursor pagination
async function getPaged(url) {
  let results = [];
  let cursor = "";
  do {
    const data = await getJSON(`${url}${cursor ? "&cursor=" + encodeURIComponent(cursor) : ""}`);
    if (!data || !data.data) break;
    results = results.concat(data.data);
    cursor = data.nextPageCursor;
  } while (cursor);
  return results;
}

// 🎯 Expanded asset types
const assetTypes = {
  tShirts: 2,
  hats: 8,
  pants: 12,
  shirts: 11,
  heads: 17,
  faces: 18,
  gear: 19,
  accessories: 41, // general accessories
  animations: 48,
  bundles: 55,
  emotes: 61,
  plugins: 38,
  decals: 13,
  meshes: 40,
  audio: 3,
  places: 9,
  models: 10
};

// 🎯 /full/:userId endpoint
app.get("/full/:userId", async (req, res) => {
  const { userId } = req.params;
  try {
    // Profile
    const profile = await getJSON(`https://users.roblox.com/v1/users/${userId}`);

    // Collectibles + RAP
    const collectibles = await getPaged(`https://inventory.roblox.com/v1/users/${userId}/assets/collectibles?limit=100`);
    const totalRap = collectibles.reduce((sum, c) => sum + (c.recentAveragePrice || 0), 0);

    // Badges
    const badges = await getPaged(`https://badges.roblox.com/v1/users/${userId}/badges?limit=100`);

    // Groups
    const groups = await getJSON(`https://groups.roblox.com/v1/users/${userId}/groups/roles`);

    // Inventory — all asset categories
    const inventory = {};
    for (const [key, typeId] of Object.entries(assetTypes)) {
      inventory[key] = await getPaged(`https://inventory.roblox.com/v1/users/${userId}/assets/${typeId}?limit=100`);
    }

    // Social stats
    const friendsCount = await getJSON(`https://friends.roblox.com/v1/users/${userId}/friends/count`);
    const followersCount = await getJSON(`https://friends.roblox.com/v1/users/${userId}/followers/count`);
    const followingCount = await getJSON(`https://friends.roblox.com/v1/users/${userId}/followings/count`);

    res.json({
      userId,
      profile,
      created: profile?.created,
      accountAge: profile?.age,
      totalRap,
      collectibles,
      badges,
      groups: groups?.data || [],
      inventory,
      social: {
        friends: friendsCount?.count || 0,
        followers: followersCount?.count || 0,
        following: followingCount?.count || 0
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch full player data" });
  }
});

app.listen(PORT, () => console.log(`Proxy running on port ${PORT}`));
