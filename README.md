# THAWHLAWM - Bethlehem Kohhran Tithe Management System

A modern, high-performance, and secure Tithe Collection & Church Accounting Management System built for **Bethlehem Kohhran**.

🌐 **Live Production Site**: [https://thawhlawmptr.pages.dev](https://thawhlawmptr.pages.dev)  
📦 **GitHub Repository**: [https://github.com/muantea45-spec/THAWHLAWM](https://github.com/muantea45-spec/THAWHLAWM)

---

## ⚡ Automated CI/CD (Continuous Deployment)

This repository is configured with GitHub Actions (`.github/workflows/deploy.yml`). Whenever changes are committed and pushed to the `main` branch:
1. GitHub Actions automatically checks out the repository.
2. Installs dependencies and compiles the production bundle (`npm run build`).
3. Deploys the built application and serverless functions directly to Cloudflare Pages (`thawhlawmptr.pages.dev`).
4. Updates appear live on the website within seconds.

---

## 🚀 Key Features

- **Real-Time Google Authentication for Admins**:
  - Secure Google OAuth login restricted to verified church administrators (`muantea45@gmail.com` and `sakadarkim@gmail.com`).
  - Unauthorized Google accounts are strictly blocked at the API level.
- **Bial In-Charge Credentials**:
  - Dedicated username and password login for Bial collectors.
  - Granular permissions with separate Bial and Admin dashboards.
- **Dynamic Tithe Columns**:
  - Add, edit, rename, reorder, or delete tithe categories (e.g., PTR, RT, Tch, Bldg) on the fly via the Admin Console.
  - Automatically preserves tally calculations, analytics, and reporting integrity.
- **Digital Receipts & Official PDF Reports**:
  - Instant digital receipts for members.
  - Automated PDF report generation with official Bethlehem Kohhran headers.
- **Cloudflare Edge Infrastructure**:
  - Global low-latency CDN via Cloudflare Pages.
  - Serverless functions and edge database via Cloudflare D1.

---

## 🛠️ Local Development

### Prerequisites
- Node.js 18+ or 20+
- npm

### Installation
```bash
git clone https://github.com/muantea45-spec/THAWHLAWM.git
cd THAWHLAWM
npm install
```

### Start Development Server
```bash
npm run dev
```

### Production Build
```bash
npm run build
```

---

## 📄 License
Private & Proprietary - Bethlehem Kohhran.

