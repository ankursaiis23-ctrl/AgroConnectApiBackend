require("dotenv").config();
const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin");

// Initialize Express App
const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

// 🔥 Firebase Initialization (IMPORTANT - Render compatible)
let db;

try {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://agroconnect-c486e-default-rtdb.firebaseio.com",
  });

  db = admin.database();
  console.log("✅ Firebase Admin Initialized Successfully");
} catch (error) {
  console.error("❌ Firebase initialization failed:", error.message);
}

// --- REST API ROUTES ---

// GET products
app.get("/api/products", async (req, res) => {
  if (!db) return res.status(500).json({ error: "Database not connected" });

  try {
    const snapshot = await db.ref("products").once("value");

    if (!snapshot.exists()) {
      return res.status(200).json([]);
    }

    const data = snapshot.val();

    const productsArray = Object.keys(data)
      .map((key) => ({
        id: key,
        ...data[key],
      }))
      .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    res.status(200).json(productsArray);
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

// POST product
app.post("/api/products", async (req, res) => {
  if (!db) return res.status(500).json({ error: "Database not connected" });

  try {
    const { name, desc, price, seller, imageUrl } = req.body;

    if (!name || price === undefined) {
      return res.status(400).json({ error: "Name and Price are required" });
    }

    const newProduct = {
      name,
      desc: desc || "",
      price: Number(price),
      seller: seller || "Anonymous",
      imageUrl: imageUrl || "",
      timestamp: admin.database.ServerValue.TIMESTAMP,
    };

    const newProductRef = db.ref("products").push();
    await newProductRef.set(newProduct);

    res.status(201).json({
      message: "Product added successfully!",
      product: { id: newProductRef.key, ...newProduct },
    });
  } catch (error) {
    console.error("Error adding product:", error);
    res.status(500).json({ error: "Failed to add product" });
  }
});

// Health check
app.get("/", (req, res) => {
  res.send("🚀 AgroConnect Backend API is running!");
});

// Start server (Render-compatible)
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
