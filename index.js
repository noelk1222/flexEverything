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

    // https://create.roblox.com/docs/reference/engine/enums/AssetType
    const assetTypes = {
      tShirts: 2,
      shirts: 11,
      pants: 12,
      hats: 8,
      faces: 18,
      gear: 19,
      heads: 17,

      // Accessories
      hairAccessories: 41,
      faceAccessories: 42,
      neckAccessories: 43,
      shoulderAccessories: 44,
      frontAccessories: 45,
      backAccessories: 46,
      waistAccessories: 47,

      // Bundles & misc
      packages: 3,
      animations: 24,
      decals: 1,
    };

    // Inventory fetch (correct endpoint = /inventory/, not /assets/)
    const inventory = {};
    for (const [key, typeId] of Object.entries(assetTypes)) {
      const url = `https://inventory.roblox.com/v1/users/${userId}/inventory/${typeId}?limit=100`;
      const list = await getPaged(url);
      inventory[key] = list || [];
    }

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
