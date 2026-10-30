const env = require('../config/env');
const ChatModel = require('../models/chat.model');
const ReadingModel = require('../models/reading.model');
const AlertModel = require('../models/alert.model');
const { statusFor } = require('./alertEngine');

/**
 * =====================================================================
 *  AI Health Assistant
 *  - Rule based / FAQ engine that always works (no API key needed).
 *  - Optional external AI API (OpenAI compatible) enabled by AI_ENABLED.
 *  - NEVER diagnoses, NEVER prescribes: unsafe questions are refused and
 *    redirected to a qualified doctor (see REFUSAL intent).
 * =====================================================================
 */

const DISCLAIMER = {
  en: 'This is not medical advice. Consult a qualified doctor.',
  hi: 'यह चिकित्सकीय सलाह नहीं है। कृपया किसी योग्य डॉक्टर से परामर्श लें।',
};

const PARAM_MEANINGS = {
  bp: {
    keywords: ['blood pressure', 'bp', 'systolic', 'diastolic', 'रक्तचाप', 'बीपी', 'बी.पी.', 'शुगर नहीं'],
    en: 'Blood pressure is the force of your blood against the artery walls, written as systolic/diastolic (for example 120/80 mmHg). The first number is the pressure while the heart beats, the second is the pressure while it rests. HealthGuard shows a general range only — how to interpret your own numbers is a question for your doctor.',
    hi: 'रक्तचाप (बीपी) धमनियों की दीवारों पर रक्त के दबाव को कहते हैं, जिसे सिस्टोलिक/डायस्टोलिक (जैसे 120/80 मिमीपा) में लिखा जाता है। पहला अंक दिल के धड़कने पर और दूसरा आराम के समय का दबाव है। HealthGuard केवल एक सामान्य सीमा दिखाता है — आपके अपने अंकों की व्याख्या आपके डॉक्टर ही बेहतर बता सकते हैं।',
  },
  spo2: {
    keywords: ['spo2', 'oxygen', 'saturation', 'ऑक्सीजन', 'एस्पीओ2', 'ऑक्सिजन'],
    en: 'SpO2 is an estimate of the percentage of oxygen carried by your haemoglobin, measured with a pulse oximeter on a fingertip. HealthGuard flags readings below your configured general range and asks you to see a doctor — it does not interpret the cause.',
    hi: 'SpO2 उस ऑक्सीजन प्रतिशत का अनुमान है जो आपके हीमोग्लोबिन में लदा होता है; इसे ऊँगली पर पल्स ऑक्सीमीटर से मापा जाता है। HealthGuard सामान्य सीमा से नीचे की रीडिंग पर चेतावनी देकर डॉक्टर से मिलने कहता है — कारण की व्याख्या नहीं करता।',
  },
  heart_rate: {
    keywords: ['heart rate', 'pulse', 'bpm', 'hr', 'हृदय गति', 'नाड़ी', 'पल्स'],
    en: 'Heart rate is the number of beats per minute. Resting heart rate varies from person to person with age, fitness and medicines. HealthGuard simply compares your entry with the general range set by the administrator.',
    hi: 'हृदय गति प्रति मिनट धड़कनों की संख्या है। आराम की हृदय गति उम्र, फिटनेस और दवाओं के अनुसार व्यक्ति-व्यक्ति में अलग होती है। HealthGuard केवल आपकी प्रविष्टि की तुलना व्यवस्थापक द्वारा तय सामान्य सीमा से करता है।',
  },
  glucose: {
    keywords: ['glucose', 'sugar', 'blood sugar', 'फास्टिंग', 'ग्लूकोज़', 'शुगर', 'मधुमेह नहीं'],
    en: 'Blood glucose is the amount of sugar in your blood, usually logged fasting or after meals as noted. HealthGuard only shows whether a value falls inside or outside the configured general range.',
    hi: 'रक्त शर्करा रक्त में चीनी की मात्रा है, जो आमतौर पर उपवास या भोजन के बाद दर्ज होती है। HealthGuard केवल दिखाता है कि मान सामान्य सीमा के भीतर है या बाहर।',
  },
  temperature: {
    keywords: ['temperature', 'fever', 'तापमान', 'बुखार'],
    en: 'Body temperature is usually measured in degrees Fahrenheit or Celsius. A value above the configured general range raises a warning alert in HealthGuard; the reason needs a doctor to judge.',
    hi: 'शरीर का तापमान आमतौर पर डिग्री फ़ारेनहाइट या सेल्सियस में मापा जाता है। सामान्य सीमा से अधिक मान पर HealthGuard चेतावनी देता है; कारण डॉक्टर ही बता सकते हैं।',
  },
  weight: {
    keywords: ['weight', 'bmi', 'वज़न', 'तौल'],
    en: 'Weight is a simple measure you can track over time. HealthGuard shows your trend line and average; interpreting change is a conversation for your doctor or dietitian.',
    hi: 'वज़न एक सरल माप है जिसे आप समय के साथ ट्रैक कर सकते हैं। HealthGuard आपकी ट्रेंड लाइन और औसत दिखाता है; बदलाव की व्याख्या आपके डॉक्टर या डायटीशियन से करें।',
  },
};

const REFUSAL = {
  en: `I'm sorry — I can't diagnose a condition, suggest a treatment or give medicine dosages. ${DISCLAIMER.en} Please share your readings and concerns with a qualified doctor.`,
  hi: `क्षमा करें — मैं कोई बीमारी की पहचान नहीं कर सकता, इलाज सुझा नहीं सकता और दवा की खुराक नहीं बता सकता। ${DISCLAIMER.hi} कृपया अपनी रीडिंग और चिंता योग्य डॉक्टर को दिखाएँ।`,
};

const MENU = {
  en: 'You can ask me: what a parameter means, what your latest alert says, how your recent readings look, how to use HealthGuard, or general wellness questions.',
  hi: 'आप मुझसे पूछ सकते हैं: किसी पैरामीटर का अर्थ, नए अलर्ट का मतलब, हाल की रीडिंग कैसी हैं, HealthGuard कैसे उपयोग करें, या सामान्य स्वास्थ्य सुझाव।',
};

const DIAGNOSIS_KEYWORDS = [
  'diagnose', 'diagnosis', 'do i have', 'am i sick', 'prescribe', 'prescription', 'medicine for',
  'dosage', 'dose', 'should i take', 'treatment', 'cure', 'tablet', 'pill',
  'क्या मुझे', 'बीमारी है', 'निदान', 'दवा', 'खुराक', 'इलाज', 'उपचार', 'प्रेस्क्रिप्शन', 'ठीक कर',
];

const WELLNESS_FAQ = {
  water: {
    en: 'General wellness guidance: drinking enough water, eating balanced meals, sleeping regularly and moving a little every day support good health. Individual needs differ — ask your doctor for advice suited to you.',
    hi: 'सामान्य स्वास्थ्य सुझाव: पर्याप्त पानी पीना, संतुलित भोजन, नियमित नींद और रोज़ थोड़ा घूमना-फिरना सेहत के लिए अच्छे होते हैं। हर व्यक्ति की ज़रूरत अलग होती है — अपने डॉक्टर से अपने अनुसार सलाह लें।',
  },
  exercise: {
    en: 'General wellness guidance: regular light activity such as walking benefits most people, but the right amount depends on your age and medical history. Please confirm with your doctor before starting anything new.',
    hi: 'सामान्य स्वास्थ्य सुझाव: टहलना जैसी हल्की नियमित गतिविधि अधिकतर लोगों के लिए उपयोगी है, पर सही मात्रा आपकी उम्र और चिकित्सा इतिहास पर निर्भर है। कुछ नया शुरू करने से पहले डॉक्टर से पुष्टि लें।',
  },
  sleep: {
    en: 'General wellness guidance: a steady sleep schedule and a dark, quiet room help most people sleep better. Ongoing sleep problems are worth discussing with a doctor.',
    hi: 'सामान्य स्वास्थ्य सुझाव: नियमित नींद का समय और अंधेरा, शांत कमरा अधिकतर लोगों को अच्छी नींद में मदद करते हैं। लगातार नींद की समस्या डॉक्टर से चर्चा योग्य है।',
  },
  diet: {
    en: 'General wellness guidance: fruits, vegetables, whole grains and less processed food are a sensible starting point. For a diet plan tied to your reports, please consult your doctor or a dietitian.',
    hi: 'सामान्य स्वास्थ्य सुझाव: फल, सब्ज़ियाँ, साबुत अनाज और कम प्रोसेस्ड भोजन एक अच्छी शुरुआत है। अपनी रिपोर्ट के अनुसार आहार योजना के लिए डॉक्टर या डायटीशियन से मिलें।',
  },
};

function detectIntent(message) {
  const m = message.toLowerCase();
  if (DIAGNOSIS_KEYWORDS.some((k) => m.includes(k))) return 'refuse';
  if (/^(hi|hello|hey|namaste|namaskar|नमस्ते|नमस्कार|हैलो)\b/.test(m)) return 'greet';
  if (/(alert|notification|अलर्ट|सूचना|चेतावनी)/.test(m)) return 'alert';
  if (/(trend|summary|summarise|summarize|recent|how (are|is) my|average|रुझान|सारांश|हाल की|औसत|कैस[ीा] है|कैसे हैं)/.test(m))
    return 'trend';
  if (/(how do i|how to|use the app|guide|help me with|कैसे|उपयोग|मार्गदर्शन|मदद कर)/.test(m)) return 'app_help';
  if (/(water|hydrat|exercise|walk|sleep|diet|food|stress|yoga|पानी|व्यायाम|टहल|नींद|आहात|आहार|तनाव|योग)/.test(m))
    return 'wellness';
  for (const [code, def] of Object.entries(PARAM_MEANINGS)) {
    if (def.keywords.some((k) => m.includes(k))) return { param: code };
  }
  return 'fallback';
}

function parameterReply(code, language) {
  const def = PARAM_MEANINGS[code];
  if (!def) return null;
  const disc = language === 'hi' ? DISCLAIMER.hi : DISCLAIMER.en;
  return `${language === 'hi' ? def.hi : def.en} ${disc}`;
}

function wellnessReply(key, language) {
  const def = WELLNESS_FAQ[key];
  return language === 'hi' ? def.hi : def.en;
}

/** Builds a short, cautious summary of the user's last readings. */
async function trendSummary(userId, language) {
  const latest = await ReadingModel.latestPerParameter(userId);
  if (!latest.length) {
    return language === 'hi'
      ? `अभी तक कोई रीडिंग दर्ज नहीं है। रुझान देखने के लिए पहले "रीडिंग जोड़ें" पर अपनी पहली रीडिंग दर्ज करें। ${DISCLAIMER.hi}`
      : `You have not recorded any readings yet. Add your first reading from "Add Reading" to see trends here. ${DISCLAIMER.en}`;
  }
  const lines = latest.map((r) => {
    const value =
      r.value_kind === 'bp' ? `${r.systolic}/${r.diastolic} ${r.unit}` : `${r.value} ${r.unit}`;
    const when = new Date(r.measured_at).toISOString().slice(0, 10);
    const name = language === 'hi' ? r.name_hi : r.name_en;
    return `- ${name}: ${value} (${when})`;
  });
  const header =
    language === 'hi'
      ? 'आपकी नवीनतम रीडिंग:'
      : 'Your latest recorded readings:';
  const footer =
    language === 'hi'
      ? `यह केवल आपके दर्ज आँकड़ों का सारांश है, व्याख्या नहीं। ${DISCLAIMER.hi}`
      : `This is only a summary of what you recorded, not an interpretation. ${DISCLAIMER.en}`;
  return `${header}\n${lines.join('\n')}\n${footer}`;
}

async function alertExplain(userId, language) {
  const alerts = await AlertModel.recentAlerts(userId, 3);
  if (!alerts.length) {
    return language === 'hi'
      ? `आपके पास अभी कोई अलर्ट नहीं है। ${DISCLAIMER.hi}`
      : `You have no alerts right now. ${DISCLAIMER.en}`;
  }
  const lines = alerts.map((a) => `- ${language === 'hi' ? a.title_hi : a.title_en}`);
  const header = language === 'hi' ? 'आपके हाल के अलर्ट:' : 'Your recent alerts:';
  const body =
    language === 'hi'
      ? `${header}\n${lines.join('\n')}\nअलर्ट का मतलब है कि आपकी रीडिंग सामान्य सीमा से बाहर थी — यह कोई निदान नहीं है। ${DISCLAIMER.hi}`
      : `${header}\n${lines.join('\n')}\nAn alert only means a reading fell outside the usual range — it is not a diagnosis. ${DISCLAIMER.en}`;
  return body;
}

const APP_HELP = {
  en: [
    'How to use HealthGuard:',
    '1. Log in, then pick your language on the language screen (change it any time with EN | हिं in the navbar).',
    '2. Add a reading: open "Health Records", choose a parameter, enter the value and date, then save — alerts are checked automatically.',
    '3. See trends on the Dashboard or Trends page (7 days, 30 days or a custom range).',
    '4. Manage reminders under "Reminders" (medication, appointment, measurement).',
    '5. Generate a report under "Reports" and share exactly what you choose with a caregiver or doctor under "Sharing".',
    DISCLAIMER.en,
  ].join('\n'),
  hi: [
    'HealthGuard का उपयोग कैसे करें:',
    '1. लॉग इन करें, फिर भाषा स्क्रीन से अपनी भाषा चुनें (नेविबार में EN | हिं से कभी भी बदलें)।',
    '2. रीडिंग जोड़ें: "स्वास्थ्य रिकॉर्ड" खोलें, पैरामीटर चुनें, मान और तारीख भरें और सहेजें — अलर्ट अपने आप जाँचे जाते हैं।',
    '3. डैशबोर्ड या "रुझान" पर 7 दिन, 30 दिन या अपनी चुनी अवधि के ग्राफ़ देखें।',
    '4. "रिमाइंडर" में दवा, अपॉइंटमेंट और माप के रिमाइंडर सेट करें।',
    '5. "रिपोर्ट" में रिपोर्ट बनाएँ और "शेयरिंग" में केवल चुनी हुई जानकारी केयरगिवर/डॉक्टर के साथ साझा करें।',
    DISCLAIMER.hi,
  ].join('\n'),
};

/** Optional external AI call — always guarded, never required. */
async function askAI({ message, history, language }) {
  if (!env.ai.enabled || !env.ai.apiKey) return null;
  try {
    const system =
      language === 'hi'
        ? `आप "HealthGuard" स्वास्थ्य सहायक हैं। किसी बीमारी का निदान न करें, इलाज या खुराक न बताएँ। अंत में हमेशा लिखें: "यह चिकित्सकीय सलाह नहीं है। कृपया किसी योग्य डॉक्टर से परामर्श लें।"`
        : `You are the "HealthGuard" health assistant. Never diagnose, never prescribe or give dosages. Always end with: "This is not medical advice. Consult a qualified doctor."`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    const res = await fetch(env.ai.apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.ai.apiKey}` },
      signal: controller.signal,
      body: JSON.stringify({
        model: env.ai.model,
        temperature: 0.2,
        messages: [
          { role: 'system', content: system },
          ...history.slice(-6).map((h) => ({ role: h.role, content: h.content })),
          { role: 'user', content: message },
        ],
      }),
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`AI API ${res.status}`);
    const data = await res.json();
    const text = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    return text || null;
  } catch (err) {
    console.error('[chatbot] AI fallback:', err.message);
    return null;
  }
}

/** Main entry point — returns a bilingual-safe assistant reply. */
async function respond({ user, message, language = 'en' }) {
  const lang = language === 'hi' ? 'hi' : 'en';
  const intent = detectIntent(message);
  let reply = null;
  let source = 'rule';

  if (intent === 'refuse') {
    reply = REFUSAL[lang];
  } else if (intent === 'greet') {
    reply =
      lang === 'hi'
        ? `नमस्ते! मैं HealthGuard स्वास्थ्य सहायक हूँ। ${MENU.hi} ${DISCLAIMER.hi}`
        : `Hello! I'm the HealthGuard health assistant. ${MENU.en} ${DISCLAIMER.en}`;
  } else if (intent === 'alert') {
    reply = await alertExplain(user.id, lang);
  } else if (intent === 'trend') {
    reply = await trendSummary(user.id, lang);
  } else if (intent === 'app_help') {
    reply = APP_HELP[lang];
  } else if (intent === 'wellness') {
    const key = /(water|hydrat|पानी)/.test(message.toLowerCase())
      ? 'water'
      : /(sleep|नींद)/.test(message.toLowerCase())
      ? 'sleep'
      : /(diet|food|आहार|आहात)/.test(message.toLowerCase())
      ? 'diet'
      : 'exercise';
    reply = wellnessReply(key, lang);
  } else if (typeof intent === 'object' && intent.param) {
    reply = parameterReply(intent.param, lang);
  }

  if (!reply) {
    const ai = await askAI({ message, history: [], language: lang });
    if (ai) {
      reply = ai;
      source = 'ai';
    } else {
      reply =
        lang === 'hi'
          ? `मैं इसे ठीक से समझ नहीं पाया। ${MENU.hi}\n\n${DISCLAIMER.hi}`
          : `I did not quite understand that. ${MENU.en}\n\n${DISCLAIMER.en}`;
    }
  }

  await ChatModel.append({ userId: user.id, role: 'user', content: message, language: lang, source: 'rule' });
  await ChatModel.append({ userId: user.id, role: 'assistant', content: reply, language: lang, source });
  return { reply, source };
}

module.exports = { respond, DISCLAIMER, detectIntent };
