// index.js
import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;

// --- Utility: fetch JSON safely ---
async function safeFetch(url) {
  try {
    const r = await fetch(url, { headers: { accept: "application/json" } });
    if (!r.ok) {
      console.warn("HTTP GET failed:", url, r.status);
      return null;
    }
    return await r.json();
  } catch (err) {
    console.warn("Fetch error:", url, err);
    return null;
  }
}

// --- COMBINED FULL PROFILE + INVENTORY ---
app.get("/full/:uid", async (req, res) => {
  const uid = req.params.uid;

  try {
    const endpoints = {
      user: `https://users.roblox.com/v1/users/${uid}`,
      avatar: `https://avatar.roblox.com/v1/users/${uid}/avatar`,
      followers: `https://friends.roblox.com/v1/users/${uid}/followers/count`,
      following: `https://friends.roblox.com/v1/users/${uid}/followings/count`,
      friends: `https://friends.roblox.com/v1/users/${uid}/friends/count`,
      groups: `https://groups.roblox.com/v1/users/${uid}/groups/roles`,
      headshot: `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${uid}&size=420x420&format=Png&isCircular=false`,
      favorites: `https://games.roblox.com/v2/users/${uid}/favorite/games?limit=50`,
      // inventory/collectibles
      collectibles: `https://inventory.roblox.com/v1/users/${uid}/assets/collectibles?sortOrder=Asc&limit=100`,
      badges: `https://badges.roblox.com/v1/users/${uid}/badges?limit=100`
    };

    const results = {};
    await Promise.all(Object.entries(endpoints).map(async ([key, url]) => {
      results[key] = await safeFetch(url);
    }));

    // Calculate RAP (from collectibles)
    let totalRap = 0;
    if (results.collectibles && results.collectibles.data) {
      for (const item of results.collectibles.data) {
        totalRap += item.recentAveragePrice || 0;
      }
    }

    const profile = {
      user: results.user,
      avatar: results.avatar,
      social: {
        followers: results.followers?.count ?? 0,
        following: results.following?.count ?? 0,
        friends: results.friends?.count ?? 0
      },
      groups: results.groups?.data || [],
      headshot: results.headshot?.data?.[0]?.imageUrl || null,
      favorites: results.favorites?.data || [],
      collectibles: results.collectibles?.data || [],
      badges: results.badges?.data || [],
      rap: totalRap
    };

    res.json(profile);
  } catch (e) {
    console.error("Error in /full:", e);
    res.status(500).json({ error: String(e) });
  }
});

// --- Root ---
app.get("/", (req, res) => {
  res.send("Roblox Flex Proxy running ✅");
});

// --- Start Server ---
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
