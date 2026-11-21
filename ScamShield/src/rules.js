// Plain detection rules for ScamShield (runs in browser or server)

export const OFFICIAL_DOMAINS = [
  'sbi.co.in',
  'onlinesbi.sbi',
  'hdfcbank.com',
  'icicibank.com',
  'axisbank.com',
  'paytm.com',
  'phonepe.com',
  'npci.org.in',
  'kotak.com',
  'irctc.co.in',
  'amazon.in',
  'flipkart.com',
];

export const BRAND_KEYWORDS = [
  'sbi',
  'hdfc',
  'icici',
  'axis',
  'paytm',
  'phonepe',
  'npci',
  'kotak',
  'pnb',
  'upi',
  'irctc',
  'amazon',
  'flipkart',
];

export const SHORTENER_DOMAINS = [
  'bit.ly',
  'tinyurl.com',
  't.co',
  'rb.gy',
  'cutt.ly',
  'is.gd',
];

export const ODD_TLDS = [
  '.xyz',
  '.top',
  '.click',
  '.link',
  '.icu',
  '.buzz',
  '.live',
  '.online',
  '.site',
  '.shop',
  '.vip',
];

export const MESSAGE_RULES = [
  {
    id: 'kyc',
    regex: /\bkyc\b/i,
    points: 25,
    reason: 'Asks to update KYC',
    isGood: false,
  },
  {
    id: 'urgency',
    regex: /\b(urgent|immediately|within 24 hours|last warning|act now)\b/i,
    points: 15,
    reason: 'Creates fake urgency',
    isGood: false,
  },
  {
    id: 'account_blocked',
    regex:
      /\b(account|a\/c|card|sim|upi|wallet|bank)\b.{0,35}\b(blocked|suspended|deactivated|frozen)\b|\b(blocked|suspended|deactivated|frozen)\b/i,
    points: 25,
    reason: 'Threatens account/card/SIM/UPI block or freeze',
    isGood: false,
  },
  {
    id: 'credentials',
    regex: /\b(otp|cvv|pin|password|mpin)\b/i,
    points: 25,
    reason: 'Mentions OTP, CVV, PIN, or password',
    isGood: false,
  },
  {
    id: 'prize_cashback',
    regex:
      /\b(lottery|prize|you have won|you won|lucky draw|cashback of|reward points|won cashback)\b/i,
    points: 20,
    reason: 'Promises lottery, prize, or cashback',
    isGood: false,
  },
  {
    id: 'action_bait',
    regex:
      /\b(click here|tap the link|tap here|verify now|update now|download (?:the )?app)\b/i,
    points: 15,
    reason: 'Pushes to click link, verify, or download app',
    isGood: false,
  },
  {
    id: 'refund',
    regex: /\b(refund|reversal)\b/i,
    points: 10,
    reason: 'Uses refund or reversal lure',
    isGood: false,
  },
  {
    id: 'digital_arrest',
    regex:
      /\b(digital arrest|cbi|customs|narcotics|arrest warrant|police case|court)\b/i,
    points: 30,
    reason: 'Digital arrest or fake law-enforcement threat',
    isGood: false,
  },
  {
    id: 'job_money',
    regex:
      /\b(work from home|part[- ]?time job|earn\s*(?:rs\.?|inr|₹)?\s*\d[\d,]*|double your money)\b/i,
    points: 20,
    reason: 'Work-from-home or quick-money promise',
    isGood: false,
  },
  {
    id: 'electricity',
    regex:
      /\b(electricity.{0,30}(disconnect|disconnection|cut\s*off)|overdue.{0,20}bill|electricity\s+bill.{0,25}(pending|unpaid|update))\b/i,
    points: 20,
    reason: 'Electricity disconnection or overdue bill threat',
    isGood: false,
  },
  {
    id: 'remote_access',
    regex: /\b(anydesk|teamviewer|screen\s*share|remote access)\b|\.apk\b/i,
    points: 30,
    reason: 'Asks for screen-share, remote access, or .apk file',
    isGood: false,
  },
  {
    id: 'isolation',
    regex:
      /\b(do not disconnect|don't disconnect|stay on (?:the )?call|do not tell anyone|don't tell anyone)\b/i,
    points: 25,
    reason: 'Tells victim to stay on call or hide from others',
    isGood: false,
  },
  {
    id: 'do_not_share',
    regex: /\b(do not share|don't share|never share)\b/i,
    points: -20,
    reason: 'Warns not to share OTP/PIN (good sign)',
    isGood: true,
  },
];

export const COLLECT_RULES = [
  {
    id: 'collect_request',
    regex: /\b(collect request|payment request)\b/i,
    points: 40,
    reason: 'Mentions UPI collect or payment request',
    isGood: false,
  },
  {
    id: 'approve_collect',
    regex:
      /\bapprove\s+(?:the\s+|this\s+)?(?:collect\s+request|request|collect|payment)\b/i,
    points: 30,
    reason: 'Asks you to approve a collect request',
    isGood: false,
  },
  {
    id: 'pin_to_receive',
    regex:
      /\benter\s+(?:your\s+)?(?:upi\s+)?pin\s+to\s+(?:receive|claim|get|accept|credit)\b/i,
    points: 50,
    reason: 'Claims you must enter UPI PIN to receive money',
    isGood: false,
  },
  {
    id: 'receive_lure',
    regex:
      /\b(?:receive\s+(?:the\s+|your\s+)?(?:money|cashback|refund|prize|reward|amount)|claim\s+(?:the\s+|your\s+)?(?:reward|prize|cashback|money|refund))\b/i,
    points: 20,
    reason: 'Promises money, cashback, or prize via request',
    isGood: false,
  },
];

export function clampScore(score) {
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function getVerdict(score) {
  if (score <= 30) return 'Safe';
  if (score <= 65) return 'Suspicious';
  return 'Dangerous';
}

export function isOfficialDomain(hostname) {
  const host = hostname.toLowerCase().replace(/^www\./, '');
  return OFFICIAL_DOMAINS.some(
    (official) => host === official || host.endsWith('.' + official)
  );
}

export function extractUrlMatches(text) {
  if (!text || typeof text !== 'string') return [];

  const matches = [];

  // 1. Explicit http:// or https:// URLs
  const explicitRegex = /https?:\/\/[^\s<>"')]+/gi;
  let match;
  while ((match = explicitRegex.exec(text)) !== null) {
    const clean = match[0].replace(/[.,!?;:)\]]+$/, '');
    matches.push({
      url: clean,
      start: match.index,
      end: match.index + clean.length,
    });
  }

  // 2. Bare shorteners, IPs, or domain-like strings
  const bareRegex =
    /(?:^|[\s(])((?:[a-z0-9._%+-]+@)?(?:(?:\d{1,3}\.){3}\d{1,3}|(?:[a-z0-9-]+\.)+(?:co\.in|org\.in|com|in|sbi|xyz|top|click|link|icu|buzz|live|online|site|shop|vip|ly|gd|co|gy|net|org|info|me|app))(?::\d+)?(?:\/[^\s<>"')]*)?)/gi;

  while ((match = bareRegex.exec(text)) !== null) {
    const candidate = match[1].replace(/[.,!?;:)\]]+$/, '');
    const prefixLen = match[0].indexOf(match[1]);
    const start = match.index + prefixLen;
    const end = start + candidate.length;

    const overlaps = matches.some(
      (m) => !(end <= m.start || start >= m.end)
    );
    if (!overlaps && candidate.includes('.')) {
      matches.push({ url: candidate, start, end });
    }
  }

  return matches.sort((a, b) => a.start - b.start);
}

export function extractUrls(text) {
  const seen = new Set();
  const urls = [];
  for (const m of extractUrlMatches(text)) {
    if (!seen.has(m.url)) {
      seen.add(m.url);
      urls.push(m.url);
    }
  }
  return urls;
}

export function inspectSingleUrl(rawUrl) {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed) {
    return {
      url: '',
      domain: '',
      rawPoints: 0,
      flags: [],
    };
  }

  const hasExplicitHttp = /^http:\/\//i.test(trimmed);
  const hasExplicitHttps = /^https:\/\//i.test(trimmed);
  const normalizedForParse =
    hasExplicitHttp || hasExplicitHttps ? trimmed : `http://${trimmed}`;

  let hostname = '';
  try {
    const parsed = new URL(normalizedForParse);
    hostname = parsed.hostname.toLowerCase();
  } catch {
    const withoutScheme = trimmed.replace(/^https?:\/\//i, '');
    const afterAt = withoutScheme.includes('@')
      ? withoutScheme.split('@').pop()
      : withoutScheme;
    hostname = (afterAt || '').split('/')[0].split(':')[0].toLowerCase();
  }

  const cleanDomain = hostname.replace(/^www\./, '');
  const flags = [];
  let rawPoints = 0;

  if (
    SHORTENER_DOMAINS.some(
      (shortener) =>
        cleanDomain === shortener || cleanDomain.endsWith('.' + shortener)
    )
  ) {
    rawPoints += 20;
    flags.push({
      id: 'url_shortener',
      points: 20,
      reason: `Uses URL shortener (${cleanDomain})`,
      isGood: false,
    });
  }

  if (hasExplicitHttp) {
    rawPoints += 10;
    flags.push({
      id: 'insecure_http',
      points: 10,
      reason: 'Uses insecure http:// instead of https://',
      isGood: false,
    });
  }

  const matchedOddTld = ODD_TLDS.find((tld) => cleanDomain.endsWith(tld));
  if (matchedOddTld) {
    rawPoints += 15;
    flags.push({
      id: 'odd_tld',
      points: 15,
      reason: `Unusual domain ending (${matchedOddTld})`,
      isGood: false,
    });
  }

  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(cleanDomain)) {
    rawPoints += 30;
    flags.push({
      id: 'raw_ip',
      points: 30,
      reason: 'Uses raw IP address instead of a domain',
      isGood: false,
    });
  }

  if (trimmed.includes('@')) {
    rawPoints += 20;
    flags.push({
      id: 'at_symbol',
      points: 20,
      reason: 'Contains "@" symbol to disguise real destination',
      isGood: false,
    });
  }

  if (cleanDomain.includes('xn--')) {
    rawPoints += 25;
    flags.push({
      id: 'punycode',
      points: 25,
      reason: 'Uses punycode (xn--) lookalike characters',
      isGood: false,
    });
  }

  const hyphenCount = (cleanDomain.match(/-/g) || []).length;
  if (hyphenCount >= 3) {
    rawPoints += 10;
    flags.push({
      id: 'many_hyphens',
      points: 10,
      reason: `Domain has ${hyphenCount} hyphens`,
      isGood: false,
    });
  }

  const official = isOfficialDomain(cleanDomain);
  const matchedBrand = BRAND_KEYWORDS.find((brand) =>
    cleanDomain.includes(brand)
  );
  if (matchedBrand && !official) {
    rawPoints += 40;
    flags.push({
      id: 'lookalike_brand',
      points: 40,
      reason: `Impersonates "${matchedBrand.toUpperCase()}" on unofficial domain`,
      isGood: false,
    });
  } else if (official && flags.length === 0) {
    flags.push({
      id: 'official_domain',
      points: 0,
      reason: `Matches official domain (${cleanDomain})`,
      isGood: true,
    });
  }

  return {
    url: trimmed,
    domain: cleanDomain,
    rawPoints,
    flags,
  };
}

function attachPercentages(flags) {
  const totalRiskPoints = flags
    .filter((f) => !f.isGood && f.points > 0)
    .reduce((sum, f) => sum + f.points, 0);

  return flags.map((flag) => ({
    ...flag,
    percentage:
      !flag.isGood && flag.points > 0 && totalRiskPoints > 0
        ? Math.round((flag.points / totalRiskPoints) * 100)
        : 0,
  }));
}

export function analyzeLinks(text) {
  const urls = extractUrls(text);
  if (urls.length === 0) {
    return {
      urls: [],
      primaryDomain: '',
      rawPoints: 0,
      score: 0,
      verdict: 'Safe',
      flags: [],
      breakdown: { messagePoints: 0, collectPoints: 0, linkPoints: 0 },
    };
  }

  const inspections = urls.map(inspectSingleUrl);
  let rawPoints = 0;
  const flagMap = new Map();

  for (const item of inspections) {
    rawPoints += item.rawPoints;
    for (const flag of item.flags) {
      if (!flagMap.has(flag.id)) {
        flagMap.set(flag.id, { ...flag });
      }
    }
  }

  const score = clampScore(rawPoints);
  return {
    urls: inspections,
    primaryDomain: inspections[0]?.domain || '',
    rawPoints,
    score,
    verdict: getVerdict(score),
    flags: attachPercentages(Array.from(flagMap.values())),
    breakdown: {
      messagePoints: 0,
      collectPoints: 0,
      linkPoints: rawPoints,
    },
  };
}

export function analyzeCollectRequest(text) {
  const input = (text || '').trim();
  if (!input) {
    return {
      rawPoints: 0,
      score: 0,
      verdict: 'Safe',
      isCollectRequest: false,
      flags: [],
      breakdown: { messagePoints: 0, collectPoints: 0, linkPoints: 0 },
    };
  }

  let rawPoints = 0;
  const flags = [];

  for (const rule of COLLECT_RULES) {
    if (rule.regex.test(input)) {
      rawPoints += rule.points;
      flags.push({
        id: rule.id,
        points: rule.points,
        reason: rule.reason,
        isGood: rule.isGood,
      });
    }
  }

  const score = clampScore(rawPoints);
  return {
    rawPoints,
    score,
    verdict: getVerdict(score),
    isCollectRequest: rawPoints >= 40,
    flags: attachPercentages(flags),
    breakdown: {
      messagePoints: 0,
      collectPoints: rawPoints,
      linkPoints: 0,
    },
  };
}

export function analyzeMessage(text) {
  const input = (text || '').trim();
  if (!input) {
    return {
      rawPoints: 0,
      score: 0,
      verdict: 'Safe',
      flags: [],
      isCollectRequest: false,
      urls: [],
      primaryDomain: '',
      breakdown: { messagePoints: 0, collectPoints: 0, linkPoints: 0 },
    };
  }

  let messagePoints = 0;
  const flags = [];

  for (const rule of MESSAGE_RULES) {
    if (rule.regex.test(input)) {
      messagePoints += rule.points;
      flags.push({
        id: rule.id,
        points: rule.points,
        reason: rule.reason,
        isGood: rule.isGood,
      });
    }
  }

  const collectResult = analyzeCollectRequest(input);
  const halfCollectPoints = Math.round(collectResult.rawPoints / 2);

  const linkResult = analyzeLinks(input);

  const seenIds = new Set(flags.map((f) => f.id));
  for (const f of collectResult.flags) {
    if (!seenIds.has(f.id)) {
      seenIds.add(f.id);
      flags.push({
        ...f,
        points: Math.round(f.points / 2),
      });
    }
  }
  for (const f of linkResult.flags) {
    if (!seenIds.has(f.id)) {
      seenIds.add(f.id);
      flags.push(f);
    }
  }

  const rawPoints = messagePoints + halfCollectPoints + linkResult.rawPoints;
  const score = clampScore(rawPoints);

  return {
    rawPoints,
    score,
    verdict: getVerdict(score),
    flags: attachPercentages(flags),
    isCollectRequest: collectResult.isCollectRequest,
    urls: linkResult.urls,
    primaryDomain: linkResult.primaryDomain,
    breakdown: {
      messagePoints,
      collectPoints: halfCollectPoints,
      linkPoints: linkResult.rawPoints,
    },
  };
}

export function findHighlightSegments(text, tab) {
  if (!text || typeof text !== 'string') return [];

  const spans = [];

  const addRuleMatches = (rules, isHalfPoints = false) => {
    for (const rule of rules) {
      const globalRegex = new RegExp(
        rule.regex.source,
        rule.regex.flags.includes('g')
          ? rule.regex.flags
          : rule.regex.flags + 'g'
      );
      let match;
      while ((match = globalRegex.exec(text)) !== null) {
        if (match[0].length === 0) break;
        spans.push({
          start: match.index,
          end: match.index + match[0].length,
          reason: rule.reason,
          points: isHalfPoints ? Math.round(rule.points / 2) : rule.points,
          isGood: rule.isGood,
        });
      }
    }
  };

  if (tab === 'message') {
    addRuleMatches(MESSAGE_RULES, false);
    addRuleMatches(COLLECT_RULES, true);
  } else if (tab === 'collect') {
    addRuleMatches(COLLECT_RULES, false);
  }

  if (tab === 'message' || tab === 'link') {
    const urlMatches = extractUrlMatches(text);
    for (const um of urlMatches) {
      const inspected = inspectSingleUrl(um.url);
      if (inspected.flags.length > 0) {
        const allGood = inspected.flags.every((f) => f.isGood);
        const combinedReason = inspected.flags.map((f) => f.reason).join(' · ');
        const totalPts = inspected.flags.reduce((s, f) => s + f.points, 0);
        spans.push({
          start: um.start,
          end: um.end,
          reason: combinedReason,
          points: totalPts,
          isGood: allGood,
        });
      }
    }
  }

  if (spans.length === 0) {
    return [{ text, highlight: false }];
  }

  // Sort by start index, then longer span first
  spans.sort((a, b) => a.start - b.start || b.end - a.end);

  // Merge overlapping spans while combining reasons cleanly
  const merged = [];
  for (const span of spans) {
    const last = merged[merged.length - 1];
    if (!last || span.start >= last.end) {
      merged.push({
        start: span.start,
        end: span.end,
        reasons: [span.reason],
        points: span.points,
        isGood: span.isGood,
      });
    } else {
      last.end = Math.max(last.end, span.end);
      if (!last.reasons.includes(span.reason)) {
        last.reasons.push(span.reason);
        last.points += span.points;
      }
      // If any overlapping signal is risky, treat merged highlight as risky
      if (!span.isGood) {
        last.isGood = false;
      }
    }
  }

  const segments = [];
  let cursor = 0;
  for (const m of merged) {
    if (m.start > cursor) {
      segments.push({
        text: text.slice(cursor, m.start),
        highlight: false,
      });
    }
    segments.push({
      text: text.slice(m.start, m.end),
      highlight: true,
      isGood: m.isGood,
      reason: m.reasons.join(' • '),
      points: m.points,
    });
    cursor = m.end;
  }

  if (cursor < text.length) {
    segments.push({
      text: text.slice(cursor),
      highlight: false,
    });
  }

  return segments;
}

export function buildShareSummary(result) {
  if (!result) return '';
  const riskyFlags = (result.flags || []).filter((f) => !f.isGood);
  const topReasons = riskyFlags
    .slice(0, 2)
    .map((f) => f.reason.toLowerCase())
    .join(' + ');

  if (result.verdict === 'Safe') {
    return `This message looks Safe (${result.score}/100) on ScamShield. Stay alert and never share your OTP or UPI PIN with anyone.`;
  }

  const reasonClause = topReasons ? `: ${topReasons}` : '';
  return `This message looks ${result.verdict} (${result.score}/100)${reasonClause}. Don't click. Report at 1930.`;
}

export function maskSensitiveText(text) {
  if (!text || typeof text !== 'string') return '';
  let masked = text.replace(
    /(?:\+?\d{1,3}[\s-]?)?\b[6-9]\d{4}[\s-]?\d{5}\b/g,
    '[PHONE]'
  );
  masked = masked.replace(/\b1800[\s-]?\d{3}[\s-]?\d{3,4}\b/g, '[PHONE]');
  masked = masked.replace(/\b\d{9,18}\b/g, '[NUMBER]');
  return masked;
}
