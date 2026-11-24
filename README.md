# ลอยกระทงออนไลน์

Vite + TypeScript frontend, Amplify Gen 2 backend (Amplify Data = AppSync + DynamoDB).

## Local
    npm install
    npm run dev          # ไม่มี amplify_outputs.json → ใช้ localStorage (ทดสอบหน้าตา)
    npx ampx sandbox     # สร้าง backend ส่วนตัวบน AWS + เขียน amplify_outputs.json → ใช้ DB จริง

## Deploy
1. push โฟลเดอร์นี้ขึ้น GitHub/GitLab/CodeCommit
2. Amplify Console → Create new app → เลือก repo/branch
3. Amplify อ่าน amplify.yml เอง: deploy backend (DynamoDB) แล้ว build frontend

## Data
ตาราง Krathong(name, wish, color, createdAt). API key สร้าง/อ่านได้อย่างเดียว ลบหรือแก้ผ่านเว็บไม่ได้
ลบข้อมูลได้ใน DynamoDB console. API key หมดอายุใน 365 วัน.
