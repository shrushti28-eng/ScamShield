# ScamShield 🛡️

### AI-Powered Online Scam Detection System

ScamShield is a web-based scam detection application designed to help users identify potentially fraudulent messages, suspicious UPI payment requests and malicious links.

It analyzes user-provided content and provides risk assessments, warnings and safety recommendations to improve awareness of online scams.

## ✨ Features

- **Message Analysis:** Detects suspicious patterns and potentially fraudulent messages.
- **UPI Collect Request Analysis:** Identifies potentially suspicious payment requests.
- **Suspicious Link Analysis:** Checks URLs for suspicious characteristics.
- **Risk Assessment:** Provides risk scores and detection results.
- **Safety Recommendations:** Helps users understand potential online threats.

## 🛠️ Technologies Used

- React
- TypeScript
- JavaScript
- Node.js
- Vite
- CSS
- Google Gemini API (where configured)

## 📁 Project Structure

```text
ScamShield/
├── src/
│   ├── App.tsx
│   ├── index.css
│   ├── main.tsx
│   └── rules.js
├── index.html
├── server.ts
├── package.json
├── package-lock.json
├── tsconfig.json
├── vite.config.ts
├── metadata.json
└── README.md
```

## 🚀 How to Run the Project

### Prerequisites

- Node.js
- npm
- Visual Studio Code (recommended)

### Installation

1. Clone the repository:

```bash
git clone https://github.com/shrushti28-eng/ScamShield.git
```

2. Open the project folder:

```bash
cd ScamShield
```

3. Install dependencies:

```bash
npm install --legacy-peer-deps
```

4. Start the development server:

```bash
npm run dev
```

On Windows PowerShell, if npm is blocked by execution policy, use:

```powershell
npm.cmd run dev
```

5. Open the local URL displayed in your terminal. The current development setup uses:

```text
http://localhost:3000/
```

### Production Build

To create a production build, run:

```bash
npm run build
```

## 🔒 Security Note

- Never share API keys or passwords publicly.
- Keep environment files containing secrets out of GitHub.
- Do not share real banking information or OTPs during testing.

## 🎯 Project Objective

The main objective of ScamShield is to promote digital safety by helping users recognize potentially fraudulent online messages, payment requests and links.

## 👩‍💻 Developer

**Ramreddy Waddankeri** and **Shrushti Kapase** 

GitHub: https://github.com/shrushti28-eng

---

*ScamShield – Stay Alert. Stay Safe. Stay Protected.*
