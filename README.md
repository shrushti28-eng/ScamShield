# 🛡️ ScamShield – AI-Powered Online Scam Detection System

**Stay Alert. Stay Safe. Stay Protected.**

ScamShield is a web-based scam detection application designed to help users identify potentially fraudulent messages, suspicious UPI collect requests, and malicious-looking website links.

The project combines a custom rule-based detection engine with Google Gemini AI to analyze suspicious content, calculate risk scores, explain warning signs, and provide safety recommendations.

Our goal is to improve digital awareness and help people recognize common online scam patterns before taking action.

---

## 🎯 Project Objective

Online scams are becoming increasingly common through SMS, WhatsApp messages, fake payment requests, and misleading website links.

ScamShield aims to provide a simple platform where users can check suspicious content and understand the possible risks.

The application focuses on three major areas:

1. Suspicious message detection.
2. UPI collect request analysis.
3. Suspicious URL detection.

---

## ✨ Key Features

### 1. Message Analysis

- Analyzes SMS, WhatsApp messages, and suspicious text.
- Identifies common scam indicators such as fake KYC updates, urgent account-blocking threats, suspicious rewards, and OTP/PIN requests.
- Highlights suspicious patterns.
- Generates a risk score and verdict.
- Provides explanations and safety recommendations.

### 2. UPI Collect Request Analysis

- Checks suspicious UPI payment and collect-request messages.
- Identifies requests asking users to approve payments.
- Detects suspicious instructions asking users to enter their UPI PIN to receive money.
- Highlights possible payment-related scam indicators.
- Provides a risk assessment.

### 3. Suspicious Link Analysis

- Analyzes URLs and domain patterns.
- Identifies URL shorteners and unusual domain extensions.
- Checks for possible brand impersonation.
- Detects suspicious URL characteristics such as raw IP addresses and misleading domain patterns.
- Displays risk indicators and warnings.

### 4. Risk Assessment

ScamShield calculates a risk score from 0 to 100.

The current verdict thresholds are:

| Risk Score | Verdict |
|---|---|
| 0–30 | Safe |
| 31–65 | Suspicious |
| 66–100 | Dangerous |

### 5. AI-Powered Explanations

- Uses Google Gemini API to generate explanations based on the detected evidence.
- Supports English and Hindi explanations.
- Provides simple reasons behind the risk assessment.
- Gives safety recommendations.
- Uses built-in explanation templates when the Gemini API is unavailable.

### 6. Additional Features

- English and Hindi language support.
- Light and dark themes.
- Risk score visualization.
- Recent analysis statistics.
- Copy and share warning summaries.
- Sample test cases for demonstration.

---

## 🧠 How ScamShield Works

ScamShield uses a combination of rule-based detection and AI-generated explanations.

**Step 1: User Input**

The user enters a suspicious message, UPI request, or website URL.

**Step 2: Rule-Based Detection**

The custom JavaScript detection engine checks the input against predefined patterns and rules.

**Step 3: Risk Calculation**

The application assigns risk points based on detected indicators and calculates an overall score.

**Step 4: Risk Classification**

The content is classified as Safe, Suspicious, or Dangerous based on its score.

**Step 5: AI Explanation**

The backend sends masked text, the risk score, detected indicators, and selected language to the Gemini API.

**Step 6: Final Result**

The application displays the risk assessment, detected warning signs, explanation, and safety recommendations.

If Gemini is unavailable, the application uses built-in explanation templates.

---

## 🤖 AI Models and APIs Used

### AI Model

**Google Gemini**

The current source code requests the model identifier:

`gemini-4-hydrogen`

The model is used to generate understandable explanations of the risk assessment.

Note: The model identifier should be verified against the models available to your Google AI API account.

### AI API Integration

- Provider: Google
- SDK: `@google/genai`
- API: Google Gemini API
- Authentication: API key stored in an environment variable named `GEMINI_API_KEY`.

### Backend API Endpoints

ScamShield also uses its own Express backend endpoints:

| Endpoint | Purpose |
|---|---|
| `GET /api/stats` | Retrieves analysis statistics |
| `POST /api/stats` | Records verdict, score, and timestamp |
| `POST /api/explain` | Generates an explanation using Gemini or a built-in template |

### Detection Engine

The primary detection system is a custom rule-based JavaScript engine implemented in:

`src/rules.js`

It checks predefined scam patterns, suspicious keywords, UPI request indicators, and URL characteristics.

**Important:** Gemini generates explanations; the primary risk scoring and classification are performed by the custom detection rules.

---

## 🛠️ Technologies Used

### Frontend
- React
- TypeScript
- JavaScript
- CSS
- Tailwind CSS
- Lucide React
- Motion

### Backend
- Node.js
- Express.js
- TypeScript

### AI Integration
- Google Gemini API
- Google GenAI SDK (`@google/genai`)

### Development Tools
- Visual Studio Code
- npm
- Vite
- GitHub

---

## 📁 Project Structure

The GitHub repository contains the application inside the `ScamShield` folder.

```text
ScamShield/
│
├── .gitignore
├── README.md
│
└── ScamShield/
    │
    ├── src/
    │   ├── App.tsx
    │   ├── index.css
    │   ├── main.tsx
    │   └── rules.js
    │
    ├── index.html
    ├── server.ts
    ├── package.json
    ├── package-lock.json
    ├── bun.lock
    ├── metadata.json
    ├── tsconfig.json
    └── vite.config.ts
```

---

## 🚀 How to Install and Run ScamShield

### Prerequisites

Install the following:

- Node.js
- npm
- Visual Studio Code

### Step 1: Clone the Repository

Open your terminal and run:

```bash
git clone https://github.com/shrushti28-eng/ScamShield.git
```

### Step 2: Open the Project Folder

```bash
cd ScamShield
cd ScamShield
```

The second command is important because the application source code is inside the inner ScamShield folder.

### Step 3: Install Dependencies

```bash
npm install --legacy-peer-deps
```

### Step 4: Configure the Gemini API Key

Create a file named `.env` inside the inner ScamShield project folder.

Add:

```env
GEMINI_API_KEY=your_google_gemini_api_key
```

Replace the placeholder with your own API key.

Never upload the actual `.env` file or API key to GitHub.

The application can also use built-in explanation templates if no Gemini API key is configured.

### Step 5: Start the Development Server

Run:

```bash
npm run dev
```

If you are using Windows PowerShell and encounter an npm execution-policy issue, run:

```powershell
npm.cmd run dev
```

### Step 6: Open the Website

Open your browser and visit:

```text
http://localhost:3000/
```

Your ScamShield application should now be running.

---

## 🏗️ Production Build

To create a production build, run:

```bash
npm run build
```

To check TypeScript errors, run:

```bash
npm run lint
```

---

## 🔐 Security and Privacy

- API keys are stored in environment variables.
- Sensitive text is masked before being sent for AI explanation.
- The server masks phone numbers and long numeric sequences again.
- Analysis history on the server stores verdicts, scores, and timestamps rather than the original message text.
- Never share OTPs, passwords, CVVs, or UPI PINs.

---

## ⚠️ Limitations

ScamShield is an awareness and preliminary screening tool, not a certified fraud detection system.

- Detection depends on predefined rules and patterns.
- A suspicious-looking URL is not necessarily a confirmed malicious website.
- The application does not perform a live reputation check against every website.
- UPI analysis examines text; it does not connect to a user's bank account or verify actual transactions.
- A Safe result does not guarantee that a message or link is genuine.
- AI-generated explanations depend on Gemini API availability and the configured model.

Always verify suspicious requests through official bank or service channels.

---

## 🔮 Future Enhancements

- Integration with trusted threat-intelligence sources.
- Improved scam detection using machine learning.
- More regional language support.
- Expanded scam pattern detection.
- Improved URL reputation analysis.
- More comprehensive testing and evaluation.

---

## 👩‍💻 Project Team

**Developers:**
- Ramreddy Waddankeri
- Shrushti Kapase
  
**GitHub Repository:**

https://github.com/shrushti28-eng/ScamShield

---

## ❤️ Our Mission

We believe that digital safety begins with awareness.

ScamShield aims to help users recognize suspicious online activities, understand possible risks, and make safer digital decisions.

**ScamShield – Stay Alert. Stay Safe. Stay Protected.**
