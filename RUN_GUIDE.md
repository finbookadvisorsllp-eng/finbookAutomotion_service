# Finbook ERP Setup Guide

This project consists of a **FastAPI (Python)** backend and a **Vite (React)** frontend. Follow these steps to get everything running.

## 1. Prerequisites
- **Python 3.10+**
- **Node.js 18+**
- **MongoDB** (Running locally or on Atlas)

---

## 2. Backend Setup (FastAPI)
The backend is located in `Finbook_Phase2/server`.

### Steps:
1. **Navigate to the server directory**:
   ```bash
   cd Finbook_Phase2/server
   ```
2. **Create a virtual environment**:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```
3. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```
4. **Environment Variables**:
   Create a `.env` file in `server/` with:
   ```env
   MONGO_URI=mongodb://localhost:27017/finbook
   DB_NAME=finbook
   API_PREFIX=/api
   ```
5. **Run the server**:
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```
   - API will be at: `http://localhost:8000/api`
   - Documentation: `http://localhost:8000/docs`

---

## 3. Frontend Setup (React)
The frontend is located in `Finbook_Phase2/python_service`.

### Steps:
1. **Navigate to the frontend directory**:
   ```bash
   cd Finbook_Phase2/python_service
   ```
2. **Install dependencies**:
   ```bash
   npm install
   ```
3. **Configure Environment**:
   Check `.env` file:
   ```env
   VITE_API_BASE_URL=http://localhost:8000/api
   ```
4. **Run the dev server**:
   ```bash
   npm run dev
   ```
   - App will be at: `http://localhost:5173`

---

## 4. Current Features (Sales Module)
- **Manual Entry**: Full form with GST/TDS calculations.
- **AI-OCR**: Upload PDFs/Images in the `AI-OCR` tab for automatic extraction.
- **Bulk CSV**: Import sales data via CSV templates.
- **Status Workflow**: Manage transitions from `Draft` -> `Pending Review` -> `Approved`.
