const express = require('express');
const { Client, GatewayIntentBits } = require('discord.js');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// מערך זמני לשמירת המוצרים בזיכרון השרת
let products = [
    { id: 1, name: "ערכת התחלה", price: 50, desc: "חבילת בסיס לשחקנים חדשים" }
];

// הגדרות שרת אינטרנט
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API: קבלת רשימת המוצרים לאתר
app.get('/api/products', (req, res) => {
    res.json(products);
});

// API: הוספת מוצר חדש מפאנל הניהול
app.post('/api/products', (req, res) => {
    const { password, name, price, desc } = req.body;
    
    if (password !== 'staff+') {
        return res.status(403).json({ error: 'סיסמת ניהול שגויה!' });
    }
    
    const newProduct = {
        id: Date.now(),
        name,
        price: parseFloat(price),
        desc
    };
    
    products.push(newProduct);
    res.json({ success: true, products });
});

// הפעלת שרת האינטרנט (Render דורש האזנה לפורט כדי שלא יקרוס)
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

// חיבור הבוט של דיסקורד באמצעות משתנה הסביבה שהגדרת
const token = process.env.BOT2_TOKEN;
if (!token) {
    console.error("שגיאה: משתנה הסביבה BOT2_TOKEN לא הוגדר ב-Render!");
} else {
    const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });
    
    client.once('ready', () => {
        console.log(`Logged in as ${client.user.tag}!`);
    });
    
    client.login(token).catch(err => console.error("שגיאה בחיבור הבוט:", err));
}
