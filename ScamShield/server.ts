import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '64kb' }));

interface CheckRecord {
  verdict: 'Safe' | 'Suspicious' | 'Dangerous';
  score: number;
  timestamp: number;
}

interface FlagInput {
  id?: string;
  points?: number;
  reason?: string;
  isGood?: boolean;
}

interface TemplateInput {
  verdict: string;
  score: number;
  flags: FlagInput[];
  language: 'en' | 'hi';
}

// Simple server-side check counter storing ONLY verdict, score, and timestamp (never message text)
const checkHistory: CheckRecord[] = [];

function getStats() {
  const total = checkHistory.length;
  const dangerous = checkHistory.filter((item) => item.verdict === 'Dangerous').length;
  const recent = checkHistory.slice(-5).reverse();
  return { total, dangerous, recent };
}

function recordCheckMeta(verdict: unknown, score: unknown) {
  const safeVerdict: CheckRecord['verdict'] =
    verdict === 'Safe' || verdict === 'Suspicious' || verdict === 'Dangerous'
      ? verdict
      : 'Safe';
  const safeScore =
    typeof score === 'number' && Number.isFinite(score)
      ? Math.max(0, Math.min(100, Math.round(score)))
      : 0;

  checkHistory.push({
    verdict: safeVerdict,
    score: safeScore,
    timestamp: Date.now(),
  });

  // Keep memory bounded while preserving accurate cumulative counts
  if (checkHistory.length > 5000) {
    checkHistory.shift();
  }
}

function maskTextServerSide(text: string): string {
  if (!text || typeof text !== 'string') return '';
  let masked = text.replace(
    /(?:\+?\d{1,3}[\s-]?)?\b[6-9]\d{4}[\s-]?\d{5}\b/g,
    '[PHONE]'
  );
  masked = masked.replace(/\b1800[\s-]?\d{3}[\s-]?\d{3,4}\b/g, '[PHONE]');
  masked = masked.replace(/\b\d{9,18}\b/g, '[NUMBER]');
  return masked;
}

function buildTemplateExplanation({ verdict, score, flags, language }: TemplateInput): string {
  const isHindi = language === 'hi';
  const redFlags = (Array.isArray(flags) ? flags : []).filter((f) => !f.isGood);
  const goodFlags = (Array.isArray(flags) ? flags : []).filter((f) => f.isGood);

  if (isHindi) {
    if (verdict === 'Dangerous') {
      const reasons = [
        redFlags[0]?.reason
          ? `मुख्य संकेत: ${redFlags[0].reason}।`
          : 'इसमें धोखाधड़ी से जुड़े कई गंभीर संकेत दिखाई दे रहे हैं।',
        redFlags[1]?.reason
          ? `अतिरिक्त जोखिम: ${redFlags[1].reason}।`
          : 'संदेश जल्दबाजी दिखाकर या लिंक/पिन मांगकर दबाव बना रहा है।',
        `कुल जोखिम स्कोर ${score}/100 है, जो उच्च खतरे का संकेत देता है।`,
      ];
      return [
        '**सावधान: यह संदेश धोखाधड़ी जैसा प्रतीत होता है**',
        ...reasons.map((r) => `- ${r}`),
        '',
        'What to do:',
        '- किसी भी लिंक पर क्लिक न करें और न ही अपना UPI PIN, OTP या पासवर्ड साझा करें।',
        '- भेजने वाले को तुरंत ब्लॉक करें और स्क्रीन-शेयरिंग ऐप डाउनलोड न करें।',
        '- 1930 पर कॉल करें या cybercrime.gov.in पर रिपोर्ट करें।',
      ].join('\n');
    }

    if (verdict === 'Suspicious') {
      const reasons = [
        redFlags[0]?.reason
          ? `ध्यान देने योग्य बात: ${redFlags[0].reason}।`
          : 'संदेश में कुछ संदिग्ध शब्द या लिंक पैटर्न पाए गए हैं।',
        redFlags[1]?.reason
          ? `एक और संकेत: ${redFlags[1].reason}।`
          : 'आधिकारिक बैंक या UPI ऐप से इसकी पुष्टि होना अभी बाकी है।',
        `जोखिम स्कोर ${score}/100 है, इसलिए बिना जांचे भरोसा न करें।`,
      ];
      return [
        '**सतर्क रहें: इस संदेश में संदिग्ध संकेत दिख रहे हैं**',
        ...reasons.map((r) => `- ${r}`),
        '',
        'What to do:',
        '- दिए गए लिंक पर क्लिक करने से पहले आधिकारिक ऐप या वेबसाइट पर जांच करें।',
        '- किसी भी अनजान अनुरोध पर OTP या UPI PIN न डालें।',
        '- संदेह होने पर भेजने वाले को ब्लॉक करें और 1930 या cybercrime.gov.in पर रिपोर्ट करें।',
      ].join('\n');
    }

    return [
      '**कम जोखिम: कोई बड़ा धोखाधड़ी संकेत नहीं मिला**',
      `- यह संदेश सामान्य सूचना जैसा लगता है (स्कोर ${score}/100)।`,
      goodFlags[0]?.reason
        ? `- सकारात्मक संकेत: ${goodFlags[0].reason}।`
        : '- इसमें कोई खतरनाक लिंक या UPI पिन जाल नहीं दिखा।',
      '- फिर भी, किसी भी अनजान कॉल या लिंक से हमेशा सतर्क रहें।',
      '',
      'What to do:',
      '- यदि यह लेन-देन आपने नहीं किया है, तो तुरंत अपने बैंक के आधिकारिक नंबर पर संपर्क करें।',
      '- अपना OTP, CVV या UPI PIN कभी किसी के साथ साझा न करें।',
      '- किसी भी संदिग्ध गतिविधि की सूचना 1930 या cybercrime.gov.in पर दें।',
    ].join('\n');
  }

  // English fallback templates
  if (verdict === 'Dangerous') {
    const reasons = [
      redFlags[0]?.reason
        ? `Strong warning sign: ${redFlags[0].reason}.`
        : 'Multiple high-risk scam patterns were detected in this message.',
      redFlags[1]?.reason
        ? `Additional risk: ${redFlags[1].reason}.`
        : 'It uses pressure tactics, deceptive links, or credential traps.',
      `The risk score is ${score}/100, which strongly resembles known UPI or bank scams.`,
    ];
    return [
      '**High Risk: This looks like a scam attempt**',
      ...reasons.map((r) => `- ${r}`),
      '',
      'What to do:',
      '- Do not click any link, approve any collect request, or share your OTP/PIN.',
      '- Block the sender immediately and delete any unknown app.',
      '- Report it by calling 1930 or visiting cybercrime.gov.in.',
    ].join('\n');
  }

  if (verdict === 'Suspicious') {
    const reasons = [
      redFlags[0]?.reason
        ? `Caution signal: ${redFlags[0].reason}.`
        : 'Some words or link patterns look unusual for an official alert.',
      redFlags[1]?.reason
        ? `Another clue: ${redFlags[1].reason}.`
        : 'Legitimate banks rarely push urgent action through unverified links.',
      `The risk score is ${score}/100, so it may be unsafe to trust directly.`,
    ];
    return [
      '**Be Careful: This message shows suspicious signs**',
      ...reasons.map((r) => `- ${r}`),
      '',
      'What to do:',
      '- Do not click the link; open your bank or UPI app directly to verify.',
      '- Block the sender if you were not expecting this message.',
      '- Report suspicious messages at 1930 or cybercrime.gov.in.',
    ].join('\n');
  }

  return [
    '**Low Risk: No major scam indicators detected**',
    `- The checked content scored ${score}/100 with no strong scam triggers.`,
    goodFlags[0]?.reason
      ? `- Positive sign: ${goodFlags[0].reason}.`
      : '- No suspicious link, remote-access request, or UPI PIN trap was found.',
    '- Even safe-looking alerts should be checked if something feels off.',
    '',
    'What to do:',
    '- Never share your OTP, CVV, or UPI PIN with anyone, including callers claiming to be bank staff.',
    '- If you notice an unauthorized transaction, block your card/UPI and report at 1930 or cybercrime.gov.in.',
  ].join('\n');
}

app.get('/api/stats', (_req, res) => {
  res.json(getStats());
});

app.post('/api/stats', (req, res) => {
  const { verdict, score } = req.body || {};
  recordCheckMeta(verdict, score);
  res.json(getStats());
});

app.post('/api/explain', async (req, res) => {
  const {
    maskedText = '',
    verdict = 'Safe',
    score = 0,
    flags = [],
    language = 'en',
  } = req.body || {};

  const safeLanguage = language === 'hi' ? 'hi' : 'en';
  const cleanMaskedText = maskTextServerSide(String(maskedText)).slice(0, 1200);
  const safeFlags = Array.isArray(flags) ? flags.slice(0, 12) : [];

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.json({
      explanation: buildTemplateExplanation({
        verdict,
        score,
        flags: safeFlags,
        language: safeLanguage,
      }),
      source: 'template',
    });
  }

  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const flagSummary =
      safeFlags.length > 0
        ? safeFlags
            .map((f) => `${f.reason} (${f.points >= 0 ? '+' : ''}${f.points} pts)`)
            .join('; ')
        : 'No specific scam rule triggered';

    const targetLanguageName =
      safeLanguage === 'hi' ? 'Hindi (in Devanagari script)' : 'English';

    const prompt = [
      `Analyze ONLY the evidence below for a non-technical Indian bank/UPI user.`,
      `Verdict: ${verdict} (${score}/100)`,
      `Detected flags: ${flagSummary}`,
      `Masked text: """${cleanMaskedText}"""`,
      ``,
      `Instructions:`,
      `- Reply in ${targetLanguageName}.`,
      `- Use ONLY the given evidence above. Do not invent facts or extra claims.`,
      `- Never claim 100% certainty; use cautious language ("looks like", "shows signs of", "may be").`,
      `- Stay strictly under 120 words.`,
      `- Follow this exact format:`,
      `  1. One bold headline (using **...**)`,
      `  2. Exactly 3 short bullet points (starting with "- ") explaining why`,
      `  3. A line reading "What to do:" followed by 2-3 short bullet steps (do not click, block the sender, report at 1930 or cybercrime.gov.in).`,
    ].join('\n');

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        systemInstruction:
          'You are ScamShield, a cautious digital-safety assistant for everyday Indian UPI and banking users. Explain clearly without jargon.',
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      },
    });

    const text = (response.text || '').trim();
    if (!text) {
      throw new Error('Empty response from Gemini');
    }

    return res.json({
      explanation: text,
      source: 'gemini',
    });
  } catch (err) {
    console.error('Gemini explain error, using built-in template:', err);
    return res.json({
      explanation: buildTemplateExplanation({
        verdict,
        score,
        flags: safeFlags,
        language: safeLanguage,
      }),
      source: 'template',
    });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ScamShield server running on http://localhost:${PORT}`);
  });
}

startServer();
