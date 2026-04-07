# **STATAC — The Ultimate Cricket Statistics Platform**

Welcome to STATAC. This is a full-stack web application designed for cricket enthusiasts, analysts, and fans. My goal was to build a platform that provides deep insights, player analytics, live comparisons, and the latest rankings, all wrapped in a sleek, modern dark-themed user interface.

## **Features**

- **Comprehensive Player Analytics**: You can instantly view detailed career statistics for any cricket player. The platform lets you toggle between batting and bowling metrics seamlessly, and the data is visualized through six interactive, dynamic charts powered by Chart.js.
- **Side-by-Side Player Comparison**: Analyze up to three players simultaneously. The advanced comparison dashboard allows you to stack players head-to-head across all formats and metrics.
- **Live ICC Rankings**: Stay fully updated with the latest men's and women's highest-rated players for ODIs, T20Is, and Tests with our live rankings page.
- **Live Cricket News Hub**: Get the latest updates and breaking news directly from the Cricbuzz RSS feed. This is displayed beautifully in a high-contrast masonry layout.
- **Secure User Authentication**: The site includes a full user account system featuring secure registration, login, and session management using JWT (JSON Web Tokens) and bcrypt.
- **Blazing Fast Search**: We've included an autocomplete-powered search bar scoped directly to player names, allowing for lightning-fast discovery.
- **Premium Dark UI**: A meticulously designed dark mode featuring high-end typography, glassmorphism, subtle micro-animations, and striking gradient accents.

---

## **Backend Tour & Architecture**

STATAC is built on a robust, scalable architecture that connects modern web frameworks to handle massive amounts of data efficiently. 

### **1. Node.js & Express Server**
At the heart of the platform runs a fast Node.js server using the Express framework (located in `server/app.js`). It handles routing, middleware, and securely serves our RESTful API endpoints:
- `GET /api/players/search`: Fast autocomplete search using highly optimized Regex queries.
- `GET /api/player/:name`: Deep fetches for a single player's analytics.
- `GET /api/players/compare`: Optimized batch data retrieval for the comparison tool.
- Authentication (`/api/auth`) and Rankings (`/api/rankings`) API routes to keep our logic cleanly modularized.

### **2. MongoDB Database Integration**
I am using MongoDB as the NoSQL data store since it natively handles millions of rows of cricket statistics with ease. 
- It is integrated via the native Node `mongodb` driver (`server/db.js`). 
- The backend queries use targeted field projections to only fetch necessary data, keeping REST payloads light and latency minimal.

### **3. Data Pipeline Layer (Python)**
STATAC handles raw heavy lifting via a dedicated Python data ingestion engine (`data-pipeline/ingest_data.py`). 
- This script parses a massive `cricket_data.csv` file (over 40MB).
- It cleanses, deduplicates, and structures the statistics into optimized JSON documents before intelligently seeding our MongoDB collections.

### **4. Security & Authentication**
- **bcryptjs**: Used to securely hash and salt user passwords upon registration.
- **jsonwebtoken (JWT)**: Ensures a seamless, stateless authentication experience. Upon login, a secure token is generated and validated on protected backend routes.
- **CORS & Environment Variables**: Secure cross-origin protections and `.env` based secret management to prevent sensitive data leaks.

---

## **Getting Started**

### **Prerequisites**
- Node.js (v16+)
- MongoDB (Running locally on port 27017 or a remote cluster)
- Python 3.x (needed to run the data pipeline)

### **Installation**
1. **Clone the repo**
   ```bash
   git clone https://github.com/SamxSTATAC/STATAC.git
   cd STATAC
   ```
2. **Install Node dependencies**
   ```bash
   npm install
   ```
3. **Set up Environment Variables**
   Create a `.env` file in the root directory:
   ```env
   PORT=3000
   MONGO_URI=mongodb://localhost:27017/statac
   JWT_SECRET=your_super_secret_key
   ```
4. **Ingest the data (Optional if starting fresh)**
   ```bash
   npm run ingest
   ```
5. **Start the development server**
   ```bash
   npm run dev
   ```

Open your browser and navigate to `http://localhost:3000` to experience the platform!

---
*Built with passion by SamxSTATAC.*
