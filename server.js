// server.js - Backend Node.js / Express สำหรับระบบ YIN-YANG CODE PROTECT (พร้อมรันบน Render และ Local)
require('dotenv').config();
const express = require('express');
const crypto = require('crypto');
const path = require('path');

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// รองรับทั้ง Render (ดึง process.env.PORT) และ Local Host (พอร์ต 97004)
const PORT = process.env.PORT || 97004;
const ADMIN_NAME = process.env.ADMIN_NAME || "แอดมิน 007";
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "starbet007";

// ฐานข้อมูลจำลองในหน่วยความจำ (In-Memory Database)
const postsDb = new Map();

function generateSecretKey(length = 16) {
    return crypto.randomBytes(length).toString('hex').slice(0, length);
}

// 1. ดึงข้อมูลโพสต์ (สำหรับ User / Browser Tab)
app.get('/api/posts/:id', (req, res) => {
    const post = postsDb.get(req.params.id);
    if (!post) {
        return res.status(404).json({ error: 'ไม่พบโพสต์นี้ในระบบ' });
    }
    
    if (post.expiresAt && new Date() > new Date(post.expiresAt)) {
        postsDb.delete(req.params.id);
        return res.status(410).json({ error: 'โพสต์นี้หมดอายุแล้ว' });
    }

    res.json({
        id: post.id,
        alias: post.alias,
        description: post.description,
        language: post.language,
        expiresAt: post.expiresAt,
        createdAt: post.createdAt
    });
});

// 2. ปลดล็อกโค้ดด้วยรหัสลับ
app.post('/api/posts/:id/unlock', (req, res) => {
    const { secret } = req.body;
    const post = postsDb.get(req.params.id);
    
    if (!post) {
        return res.status(404).json({ error: 'ไม่พบโพสต์นี้ในระบบ' });
    }

    if (post.secret !== secret) {
        return res.status(403).json({ error: 'รหัสผ่านเพื่อรับโค้ดไม่ถูกต้อง' });
    }

    res.json({
        code: post.code,
        language: post.language
    });
});

// 3. ดึงรายการโพสต์ทั้งหมด (สำหรับ Sync / Browser Catalog)
app.get('/api/posts', (req, res) => {
    const publicPosts = Array.from(postsDb.values()).map(p => ({
        id: p.id,
        alias: p.alias,
        description: p.description,
        language: p.language,
        expiresAt: p.expiresAt,
        createdAt: p.createdAt
    }));
    res.json(publicPosts);
});

// 4. แอดมินสร้างโพสต์ (ตรวจสอบสิทธิ์ด้วย ADMIN_TOKEN / starbet007)
app.post('/api/admin/posts', (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || authHeader !== `Bearer ${ADMIN_TOKEN}`) {
        return res.status(401).json({ error: 'รหัสผ่านยืนยันสิทธิ์แอดมินไม่ถูกต้อง (เข้าสู่ระบบด้วย starbet007 เท่านั้น)' });
    }

    const { alias, description, language, code, expiresAt } = req.body;
    if (!code) {
        return res.status(400).json({ error: 'กรุณากรอกโค้ดที่ต้องการปกป้อง' });
    }

    const id = crypto.randomBytes(6).toString('hex');
    const secret = generateSecretKey();

    const newPost = {
        id,
        alias: alias || 'Protected Script',
        description: description || '',
        language: language || 'text',
        code,
        secret,
        expiresAt: expiresAt || null,
        createdBy: ADMIN_NAME,
        createdAt: new Date()
    };

    postsDb.set(id, newPost);

    const protocol = req.protocol;
    const host = req.get('host');
    const dynamicUrl = `${protocol}://${host}/?post=${id}`;

    res.json({
        success: true,
        adminSystem: ADMIN_NAME,
        post: {
            id,
            url: dynamicUrl
        },
        secret
    });
});

app.listen(PORT, () => {
    console.log(`=================================`);
    console.log(`[${ADMIN_NAME}] YIN-YANG CODE PROTECT`);
    console.log(`Server running on port ${PORT}`);
    console.log(`=================================`);
});
