require('dotenv').config();
const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');

// Initialize Express App
const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' })); // Allow larger payloads for base64 images

// Initialize Firebase Admin SDK
// You will need to download your serviceAccountKey.json from Firebase
// (Project Settings > Service Accounts > Generate new private key)
// and place it in this folder.
try {
    const serviceAccount = require('./serviceAccountKey.json');
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: "https://agroconnect-c486e-default-rtdb.firebaseio.com"
    });
    console.log("Firebase Admin Initialized Successfully");
} catch (error) {
    console.warn("⚠️ Warning: serviceAccountKey.json not found or invalid.");
    console.warn("Make sure to download it from Firebase Console and place it in the backend folder.");
}

const db = admin.apps.length > 0 ? admin.database() : null;

// --- REST API ROUTES ---

// 1. GET /api/products -> Retrieve all marketplace items
app.get('/api/products', async (req, res) => {
    if (!db) return res.status(500).json({ error: "Database not connected. Check serviceAccountKey.json" });
    
    try {
        const snapshot = await db.ref('products').once('value');
        if (!snapshot.exists()) {
            return res.status(200).json([]);
        }
        
        const data = snapshot.val();
        
        // Convert Firebase object into an array and sort by timestamp (newest first)
        const productsArray = Object.keys(data).map(key => ({
            id: key,
            ...data[key]
        })).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

        res.status(200).json(productsArray);
    } catch (error) {
        console.error("Error fetching products:", error);
        res.status(500).json({ error: "Failed to fetch products" });
    }
});

// 2. POST /api/products -> Save a new marketplace item
app.post('/api/products', async (req, res) => {
    if (!db) return res.status(500).json({ error: "Database not connected. Check serviceAccountKey.json" });

    try {
        const { name, desc, price, seller, imageUrl } = req.body;

        // Validation
        if (!name || price === undefined) {
            return res.status(400).json({ error: "Name and Price are required" });
        }

        // We use admin.database.ServerValue.TIMESTAMP for a verifiable server-side timestamp
        const newProduct = {
            name,
            desc: desc || "",
            price: Number(price),
            seller: seller || "Anonymous",
            imageUrl: imageUrl || "",
            timestamp: admin.database.ServerValue.TIMESTAMP 
        };

        const newProductRef = db.ref('products').push();
        await newProductRef.set(newProduct);

        res.status(201).json({ 
            message: "Product added successfully!", 
            product: { id: newProductRef.key, ...newProduct } 
        });
    } catch (error) {
        console.error("Error adding product:", error);
        res.status(500).json({ error: "Failed to add product" });
    }
});

// Create a basic health check route
app.get('/', (req, res) => {
    res.send("AgroConnect Backend API is running!");
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 AgroConnect Backend API is running on http://localhost:${PORT}`);
});
