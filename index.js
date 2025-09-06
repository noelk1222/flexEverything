import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(cors());

const PORT = process.env.PORT || 8080;

// Helper for safe fetch
async function safeFetch(url, res) {
  try {
    const r = await fetch(url, {
      headers: {
        "User-Agent": "FlexEverythingProxy/1.0"
      }
    });
    if (!r.ok) {
      return res.status(r.status).json({ error: `Upstream error ${r.status}` });
    }
    const data = await r.json();
    return res.json(data);
  } catch (err) {
    console.error("❌ Fetch error:", err);
    return res.status(500).json({ error: err.message });
  }
}

// Collectibles
app.get("/collectibles/:userId", async (req, res) => {
  const { userId } = req.params;
  const url = `https://inventory.roblox.com/v1/users/${userId}/assets/collectibles?sortOrder=Asc&limit=100`;
  return safeFetch(url, res);
});

// Badges
app.get("/badges/:userId", async (req, res) => {
  const { userId } = req.params;
  const url = `https://badges.roblox.com/v1/users/${userId}/badges?limit=100&sortOrder=Asc`;
  return safeFetch(url, res);
});

// Regular items by asset type
app.get("/items/:userId/:assetTypeId", async (req, res) => {
  const { userId, assetTypeId } = req.params;
  const url = `https://inventory.roblox.com/v2/users/${userId}/inventory/${assetTypeId}?limit=100&sortOrder=Asc`;
  return safeFetch(url, res);
});

app.listen(PORT, () => {
  console.log(`✅ Flex Everything Proxy running on port ${PORT}`);
});
