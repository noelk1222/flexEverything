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
    const json = await res.json();
    if (json.errors) {
      console.warn("Roblox API error:", url, json.errors[0]?.message);
      return null;
    }
    return json;
  } catch (err) {
    console.error("Fetch failed:", url, err.message);
    return null;
  }
}

// 🔧 Paginated fetch
async function getPaged(url) {
  let results = [];
  let cursor = "";
  try {
    do {
      const data = await getJSON(
        `${url}${cursor ? "&cursor=" + encodeURIComponent(cursor) : ""}`
      );
      if (!data || !data.data) break;
      results = results.concat(data.data);
      cursor = data.nextPageCursor;
    } while (cursor);
  } catch (err) {
    console.error("Paged fetch failed:", url, err.message);
  }
  return results;
}

// Asset types we care about
const assetTypes = {
  shirts: 11,       // ClassicShirt
  pants: 12,        // ClassicPants
  tShirts: 2,       // TShirt
  hats: 8,
  hairAccessories: 41,
  faceAccessories: 42,
  neckAccessories: 43,
  shoulderAccessories: 44,
  frontAccessories: 45,
  backAccessories: 46,
  waistAccessories: 47,
  faces: 18,
  gear: 19,
  heads: 17,
  packages: 3,      // Bundles
  animations: 24,
  decals: 1,
};

// 🔧 Fetch full user assets
async function fetchAssets(userId) {
  const result = {};
  for (const [key, typeId] of Object.entries(assetTypes)) {
    const url = `https://inventory.roblox.com/v1/users/${userId}/inventory/${typeId}?limit=100`;
    result[key] = await getPaged(url);
  }
  return result;
}

// 🎯 Full profile endpoint
app.get("/full/:userId", async (req, res) => {
  const { userId } = req.params;
  try {
    const profile = await getJSON(
      `https://users.roblox.com/v1/users/${userId}`
    );
    if (!profile) return res.status(400).json({ error: "Invalid user" });

    // Collectibles
    const collectibles = await getPaged(
      `https://inventory.roblox.com/v1/users/${userId}/assets/collectibles?limit=100`
    );
    const totalRap = collectibles.reduce(
      (sum, c) => sum + (c.recentAveragePrice || 0),
      0
    );

    // Badges & Groups
    const badges = await getPaged(
      `https://badges.roblox.com/v1/users/${userId}/badges?limit=100`
    );
    const groups = await getJSON(
      `https://groups.roblox.com/v1/users/${userId}/groups/roles`
    );

    // Inventory (shirts, pants, hats, etc.)
    const inventory = await fetchAssets(userId);

    // Social
    const friendsCount = await getJSON(
      `https://friends.roblox.com/v1/users/${userId}/friends/count`
    );
    const followersCount = await getJSON(
      `https://friends.roblox.com/v1/users/${userId}/followers/count`
    );
    const followingCount = await getJSON(
      `https://friends.roblox.com/v1/users/${userId}/followings/count`
    );

    res.json({
      userId,
      profile,
      created: profile.created,
      accountAge: profile.age,
      totalRap,
      collectibles,
      badges,
      groups: groups?.data || [],
      inventory,
      social: {
        friends: friendsCount?.count || 0,
        followers: followersCount?.count || 0,
        following: followingCount?.count || 0,
      },
    });
  } catch (err) {
    console.error("Full endpoint error:", err);
    res.status(500).json({ error: "Failed to fetch full player data" });
  }
});

app.listen(PORT, () => console.log(`Proxy running on port ${PORT}`));

