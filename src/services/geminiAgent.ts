import { FarmAnalysisResult } from './bioIntelligence';
import { getSecureStoredApiKey } from './securityService';

const ENV_API_KEY =
  (import.meta as any).env?.VITE_GEMINI_API_KEY ||
  (import.meta as any).env?.GEMINI_API_KEY ||
  (process.env as any).GEMINI_API_KEY ||
  (process.env as any).VITE_GEMINI_API_KEY ||
  '';

export function getEffectiveGeminiApiKey(customKey: string = ''): string {
  if (customKey && customKey.trim()) return customKey.trim();
  const secureKey = getSecureStoredApiKey();
  return secureKey.trim() || ENV_API_KEY?.trim() || '';
}

export function getWorkingGeminiModel(): string {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('agrishield_gemini_active_model');
    if (saved && saved.trim()) return saved.trim();
  }
  return 'gemini-2.0-flash';
}

export function setWorkingGeminiModel(model: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('agrishield_gemini_active_model', model);
  }
}

export async function detectBestGeminiModel(key: string): Promise<{ model: string; allModels: string[] }> {
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
    if (res.ok) {
      const data = await res.json();
      const models: Array<{ name: string; supportedGenerationMethods?: string[] }> = data.models || [];
      const genModels = models
        .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
        .map((m) => m.name.replace(/^models\//, ''));

      const preferred = [
        'gemini-2.0-flash',
        'gemini-2.5-flash',
        'gemini-1.5-flash-latest',
        'gemini-1.5-flash',
        'gemini-2.0-flash-exp',
        'gemini-1.5-pro'
      ];

      for (const p of preferred) {
        if (genModels.includes(p)) {
          setWorkingGeminiModel(p);
          return { model: p, allModels: genModels };
        }
      }

      if (genModels.length > 0) {
        setWorkingGeminiModel(genModels[0]);
        return { model: genModels[0], allModels: genModels };
      }
    }
  } catch (err) {
    console.warn('Could not query Gemini models list dynamically:', err);
  }
  return { model: getWorkingGeminiModel(), allModels: [] };
}

const CROP_LOCALIZED: Record<string, Record<string, string>> = {
  Tomato: { hi: 'टमाटर', mr: 'टोमॅटो', en: 'Tomato' },
  Potato: { hi: 'आलू', mr: 'बटाटा', en: 'Potato' },
  Cotton: { hi: 'कपास', mr: 'कापूस', en: 'Cotton' },
  Wheat: { hi: 'गेहूं', mr: 'गहू', en: 'Wheat' }
};

export function generateAdaptiveQuestions(
  analysis: FarmAnalysisResult | null,
  lang: string = 'en',
  setIndex: number = 0
): string[] {
  if (!analysis) {
    const defaultPool: Record<string, string[][]> = {
      hi: [
        [
          'जैव-जलवायु रोग जोखिम का पूर्वानुमान कैसे लगाया जाता है?',
          'सेंटिनल-2 उपग्रह सूचकांक (NDVI, LSWI) क्या दर्शाते हैं?',
          'फसल सुरक्षा में आर्द्रता 80% से अधिक होने का क्या प्रभाव है?',
          'ICAR द्वारा अनुमोदित निवारक कवकनाशी कौन से हैं?'
        ],
        [
          'वाष्प दबाव घाटा (VPD) और कवक संक्रमण का क्या संबंध है?',
          'रिमोट सेंसिंग से बिना खेत गए फसल तनाव कैसे पहचानते हैं?',
          'रोग के लक्षण दिखने से 3-7 दिन पहले चेतावनी कैसे संभव है?',
          'खेत में जल निकासी और फव्वारा सिंचाई बंद करने का क्या महत्व है?'
        ]
      ],
      mr: [
        [
          'बायो-क्लायमेटिक रोग धोक्याचा अंदाज कसा लावला जातो?',
          'सेंटिनेल-2 उपग्रह निर्देशांक (NDVI, LSWI) काय दर्शवतात?',
          'हवेतील आर्द्रता 80% पेक्षा जास्त असण्याचा पिकावर काय परिणाम होतो?',
          'ICAR शिफारशीत प्रतिबंधात्मक बुरशीनाशके कोणती आहेत?'
        ],
        [
          'बाष्प दाब तूट (VPD) आणि बुरशीजन्य रोगांचा काय संबंध आहे?',
          'उपग्रह रिमोट सेन्सिंगने पिकातील तणाव कसा ओळखता येतो?',
          'रोग लक्षणे दिसण्यापूर्वी 3-7 दिवस आधी इशारा कसा मिळतो?',
          'शेतात चर काढून पाण्याचा निचरा करण्याचे काय महत्त्व आहे?'
        ]
      ],
      en: [
        [
          'How does bio-climatic disease risk forecasting work?',
          'What do Sentinel-2 indices (NDVI, LSWI) measure?',
          'How does humidity > 80% accelerate fungal sporulation?',
          'What are the certified ICAR preventive fungicide classes?'
        ],
        [
          'How does Vapor Pressure Deficit (VPD) correlate with infection?',
          'How does remote sensing detect stress before visible spots appear?',
          'What biological factors govern the 3 to 7 day early warning window?',
          'Why is field perimeter drainage critical during humid cycles?'
        ]
      ]
    };
    const list = defaultPool[lang] || defaultPool.en;
    return list[setIndex % list.length];
  }

  const { crop, weather, spectral, prediction } = analysis;
  const temp = weather.current.temperature;
  const rh = weather.current.humidity;
  const vpd = weather.current.vpd;
  const humidH = weather.current.humidHours24h;
  const ndvi = spectral.ndvi;
  const lswi = spectral.lswi;
  const disease = prediction.disease;
  const risk = prediction.riskScore;
  const cropName = CROP_LOCALIZED[crop]?.[lang] || crop;

  const pool: Record<string, string[][]> = {
    hi: [
      [
        `${cropName} पर ${disease} का जोखिम ${risk}% क्यों आया है?`,
        `सापेक्ष आर्द्रता ${rh}% और तापमान ${temp}°C रोगजनक को कैसे बढ़ावा दे रहे हैं?`,
        `खेत के NDVI (${ndvi}) और पत्ती नमी (${lswi}) का क्या वैज्ञानिक अर्थ है?`,
        `वर्तमान संक्रमण रोकने हेतु अनुशंसित कवकनाशी और जल निकासी उपाय क्या हैं?`
      ],
      [
        `अगले 24 घंटे में ${humidH} घंटे आर्द्रता ≥ 80% रहने का क्या खतरा है?`,
        `वाष्प दबाव घाटा (${vpd} kPa) पत्तियों पर ओस बनने में क्या भूमिका निभा रहा है?`,
        `${cropName} में लक्षण दिखने से पहले निवारक छिड़काव का सही समय क्या है?`,
        `पड़ोसी खेतों में बीजाणु फैलने से रोकने हेतु क्या सावधानी बरतें?`
      ]
    ],
    mr: [
      [
        `${cropName} पिकावर ${disease} रोगाचा धोका ${risk}% का नोंदवला गेला?`,
        `आर्द्रता ${rh}% व तापमान ${temp}°C मुळे रोगजनक बुरशीचा प्रसार कसा होतो?`,
        `शेताचे NDVI (${ndvi}) व पर्ण ओलावा (${lswi}) काय दर्शवतात?`,
        `प्रादुर्भाव रोखण्यासाठी शिफारशीत फवारणी व शेत निचरा पद्धती सांगा.`
      ],
      [
        `पुढील 24 तासांतील ${humidH} दमट तासांमुळे पिकावर काय परिणाम होईल?`,
        `बाष्प दाब तूट (${vpd} kPa) आणि पानांवरील पाण्याचा थर यांचा काय संबंध आहे?`,
        `${cropName} पिकावर रोगाची लक्षणे दिसण्यापूर्वी फवारणीची योग्य वेळ कोणती?`,
        `शेतात पाण्याचा निचरा करण्यासाठी चर किती खोल असावेत?`
      ]
    ],
    en: [
      [
        `Why is ${disease} risk at ${risk}% for inspected ${cropName}?`,
        `How do ambient humidity (${rh}%) and temp (${temp}°C) trigger sporulation?`,
        `Explain the biological meaning of NDVI (${ndvi}) and LSWI (${lswi}) anomalies`,
        `What exact ICAR chemical dosage and drainage protocol should be deployed?`
      ],
      [
        `What is the threat of ${humidH} consecutive humid hours (RH ≥ 80%) in the forecast?`,
        `How does Vapor Pressure Deficit (${vpd} kPa) indicate water droplets on leaves?`,
        `What is the optimal spray timing before visual ${disease} lesions erupt on ${cropName}?`,
        `How does perimeter trenching mitigate soil waterlogging and root hypoxia?`
      ]
    ]
  };

  const currentList = pool[lang] || pool.en;
  return currentList[setIndex % currentList.length];
}

export interface AskGeminiOptions {
  query: string;
  currentAnalysis?: FarmAnalysisResult | null;
  language?: string;
  apiKey?: string;
  onThinkingUpdate?: (step: string) => void;
}

export async function askGeminiAssistant({
  query,
  currentAnalysis = null,
  language = 'en',
  apiKey = '',
  onThinkingUpdate
}: AskGeminiOptions): Promise<{ text: string; thinking: string }> {
  const cleanQuery = query.trim();
  if (!cleanQuery) return { text: '', thinking: '' };

  const effectiveKey = getEffectiveGeminiApiKey(apiKey);

  if (onThinkingUpdate) {
    onThinkingUpdate(getThinkingStep(cleanQuery, currentAnalysis, language, 1));
    await delay(250);
    onThinkingUpdate(getThinkingStep(cleanQuery, currentAnalysis, language, 2));
    await delay(250);
  }

  if (effectiveKey && effectiveKey.length > 10) {
    try {
      const response = await callGeminiApi(cleanQuery, currentAnalysis, language, effectiveKey);
      if (response) {
        return {
          text: response,
          thinking: getFinalThinkingSummary(currentAnalysis, language)
        };
      }
    } catch (err) {
      console.warn('Gemini API call failed, falling back to local contextual reasoning:', err);
    }
  }

  const text = generateContextualAnalysisResponse(cleanQuery, currentAnalysis, language);
  return {
    text,
    thinking: getFinalThinkingSummary(currentAnalysis, language)
  };
}

function delay(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

function getThinkingStep(
  _query: string,
  analysis: FarmAnalysisResult | null,
  lang: string,
  step: number
): string {
  if (step === 1) {
    if (lang === 'hi') return 'खेत के उपग्रह और मौसम डेटा का विश्लेषण किया जा रहा है...';
    if (lang === 'mr') return 'शेताच्या उपग्रह आणि हवामान नोंदी तपासल्या जात आहेत...';
    return 'Analyzing Sentinel-2 spectral telemetry and micro-climate triggers...';
  }
  if (!analysis) {
    if (lang === 'hi') return 'कृषि रोग विज्ञान ज्ञानकोश से उत्तर तैयार हो रहा है...';
    if (lang === 'mr') return 'कृषी रोग विज्ञान डेटाबेसमधून उत्तर तयार होत आहे...';
    return 'Retrieving certified ICAR epidemiological guidelines...';
  }
  const crop = analysis.crop;
  const disease = analysis.prediction.disease;
  if (lang === 'hi') return `${crop} पर ${disease} के जोखिम कारकों और ICAR प्रोटोकॉल की गणना की जा रही है...`;
  if (lang === 'mr') return `${crop} वरील ${disease} रोग जोखीम आणि ICAR फवारणी प्रमाणाची पडताळणी होत आहे...`;
  return `Cross-referencing ${crop} ${disease} epidemiology with live VPD and NDVI values...`;
}

function getFinalThinkingSummary(analysis: FarmAnalysisResult | null, lang: string): string {
  if (!analysis) {
    return lang === 'hi'
      ? 'विचार प्रक्रिया: सामान्य कृषि रोग विज्ञान संदर्भ का उपयोग किया गया।'
      : lang === 'mr'
      ? 'विचार प्रक्रिया: सामान्य कृषी रोग विज्ञान संदर्भ वापरला गेला.'
      : 'Thinking Process: Retrieved certified ICAR epidemiological guidelines.';
  }
  const { crop, weather, spectral, prediction } = analysis;
  return lang === 'hi'
    ? `विचार प्रक्रिया: ${crop} के लिए NDVI (${spectral.ndvi}), आर्द्रता (${weather.current.humidity}%), और ${prediction.disease} के ${prediction.riskScore}% जोखिम का विश्लेषण किया गया।`
    : lang === 'mr'
    ? `विचार प्रक्रिया: ${crop} साठी NDVI (${spectral.ndvi}), आर्द्रता (${weather.current.humidity}%), आणि ${prediction.disease} च्या ${prediction.riskScore}% धोक्याचे थेट विश्लेषण केले.`
    : `Thinking Process: Correlated ${crop} NDVI (${spectral.ndvi}) and ambient RH (${weather.current.humidity}%) with ${prediction.disease} risk model (${prediction.riskScore}%).`;
}

async function callGeminiApi(
  userQuery: string,
  analysis: FarmAnalysisResult | null,
  lang: string,
  key: string
): Promise<string | null> {
  const contextPrompt = buildAnalysisContext(analysis, lang);
  const candidateModels = Array.from(
    new Set([
      getWorkingGeminiModel(),
      'gemini-2.0-flash',
      'gemini-2.5-flash',
      'gemini-1.5-flash-latest',
      'gemini-1.5-flash',
      'gemini-1.5-pro'
    ])
  );

  const payload = {
    contents: [
      {
        parts: [{ text: contextPrompt }, { text: `Farmer/Agronomist Question: ${userQuery}` }]
      }
    ],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 600
    }
  };

  let lastErrorMsg = '';

  for (const model of candidateModels) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const json = await res.json();
        const candidate = json.candidates?.[0]?.content?.parts?.[0]?.text;
        if (candidate) {
          setWorkingGeminiModel(model);
          return candidate;
        }
      } else {
        const errJson = await res.json().catch(() => null);
        lastErrorMsg = errJson?.error?.message || `HTTP ${res.status}`;
      }
    } catch (e: any) {
      lastErrorMsg = e?.message || 'Network error';
    }
  }

  throw new Error(`Gemini API call failed across candidate models: ${lastErrorMsg}`);
}

function buildAnalysisContext(analysis: FarmAnalysisResult | null, lang: string): string {
  if (!analysis) {
    return `You are Gemini AgroBot, an expert agricultural pathologist and remote-sensing scientist.
No farm plot analysis has been executed yet. Advise the farmer clearly and scientifically in ${
      lang === 'hi' ? 'Hindi' : lang === 'mr' ? 'Marathi' : 'English'
    }. Keep recommendations concise, certified by ICAR standards.`;
  }

  const { crop, centroid, weather, spectral, prediction } = analysis;
  return `You are Gemini AgroBot, an expert bio-climatic agricultural advisor for the Precision Agro Decision Support System.
You have FULL REAL-TIME ACCESS to the ONGOING FIELD ANALYSIS:

[ONGOING FIELD TELEMETRY]
- Crop: ${crop}
- Field Centroid: ${centroid.lat}° N, ${centroid.lng}° E
- Forecasted Pathogen: ${prediction.disease} (${prediction.pathogen})
- Vulnerability Level: ${prediction.riskLevel} (${prediction.riskScore}% risk score)
- Sentinel-2 Multi-Spectral Indices:
  * NDVI: ${spectral.ndvi} (${spectral.vegetationHealth})
  * LSWI (Canopy Water Thickness): ${spectral.lswi}
  * NDRE (Red-Edge Chlorophyll): ${spectral.ndre}
  * EVI: ${spectral.evi}
- Live Micro-Meteorology (Open-Meteo):
  * Temperature: ${weather.current.temperature}°C
  * Relative Humidity: ${weather.current.humidity}%
  * Vapor Pressure Deficit (VPD): ${weather.current.vpd} kPa
  * Wind Velocity: ${weather.current.windSpeed} km/h
  * Surface Pressure: ${weather.current.pressure} hPa
  * Humid Window (RH >= 80% next 24h): ${weather.current.humidHours24h} hours
- Recommended Chemical Protocol: ${prediction.chemicalSpray
    .map((c) => `${c.name} @ ${c.dosage} (${c.type})`)
    .join('; ')}

Instructions:
1. Ground your answer directly on the ongoing analysis data above.
2. If the farmer asks why the risk is high, cite the exact humidity (${weather.current.humidity}%), temperature (${weather.current.temperature}°C), and NDVI (${spectral.ndvi}).
3. Provide exact fungicide dosages and drainage recommendations.
4. Respond in ${lang === 'hi' ? 'Hindi' : lang === 'mr' ? 'Marathi' : 'English'}. Be direct, actionable, and professional.`;
}

export function generateContextualAnalysisResponse(
  query: string,
  analysis: FarmAnalysisResult | null,
  lang: string
): string {
  const q = query.toLowerCase();

  if (!analysis) {
    if (q.includes('hello') || q.includes('hi') || q.includes('namaste')) {
      return lang === 'hi'
        ? 'नमस्ते! मैं मिथुन (Gemini) कृषि सहायक हूं। कृपया उपग्रह मानचित्र पर अपने खेत की सीमा बनाएं, फिर मैं आपके खेत के सटीक डेटा पर परामर्श दूंगा।'
        : lang === 'mr'
        ? 'नमस्कार! मी मिथुन (Gemini) कृषी सहाय्यक आहे. कृपया नकाशावर शेताची सीमा आखा, त्यानंतर मी आपल्या शेताच्या थेट डेटावर आधारित सल्ला देईन.'
        : 'Hello! I am your Gemini Agro-Intelligence Assistant. Please draw your farm boundary on the satellite map. Once telemetry is fetched, I can answer queries specific to your plot.';
    }
    return lang === 'hi'
      ? 'कृपया पहले उपग्रह मानचित्र पर अपने खेत की सीमा बनाएं। इसके बाद मैं आपके खेत के NDVI, मौसम और रोग जोखिम पर सटीक उत्तर दूंगा।'
      : lang === 'mr'
      ? 'कृपया आधी नकाशावर शेताची सीमा आखा. त्यानंतर मी आपल्या पिकाच्या NDVI, हवामान आणि रोग धोक्याचे सविस्तर विश्लेषण देईन.'
      : 'Please draw your farm boundary on the satellite map first. Once telemetry is loaded, I will provide plot-specific diagnosis based on your live NDVI, weather, and pathogen data.';
  }

  const { crop, weather, spectral, prediction } = analysis;
  const temp = weather.current.temperature;
  const rh = weather.current.humidity;
  const vpd = weather.current.vpd;
  const humidH = weather.current.humidHours24h;
  const ndvi = spectral.ndvi;
  const lswi = spectral.lswi;
  const disease = prediction.disease;
  const pathogen = prediction.pathogen;
  const risk = prediction.riskScore;
  const sprays = prediction.chemicalSpray;

  if (
    q.includes('why') ||
    q.includes('risk') ||
    q.includes('reason') ||
    q.includes('high') ||
    q.includes('कारण') ||
    q.includes('धोका') ||
    q.includes('क्यो')
  ) {
    if (lang === 'hi') {
      return `चल रहे विश्लेषण के अनुसार, ${crop} पर ${disease} का जोखिम ${risk}% (${prediction.riskLevel}) है। इसका मुख्य कारण सापेक्ष आर्द्रता का ${rh}% होना और अगले 24 घंटों में ${humidH} घंटे तक आर्द्रता 80% से अधिक रहना है। तापमान ${temp}°C रोगजनक के फैलाव के अनुकूल है, तथा NDVI (${ndvi}) पत्तियों में तनाव दर्शाता है।`;
    }
    if (lang === 'mr') {
      return `सध्याच्या विश्लेषणानुसार, ${crop} पिकावर ${disease} रोगाचा धोका ${risk}% (${prediction.riskLevel}) आहे. हवेतील सापेक्ष आर्द्रता ${rh}% असून पुढील 24 तासांत ${humidH} तास आर्द्रता 80% पेक्षा जास्त राहण्याचा अंदाज आहे. तापमान ${temp}°C रोगवाढीसाठी पोषक असून NDVI (${ndvi}) पानांमधील तणाव दर्शवतो.`;
    }
    return `Based on ongoing telemetry for ${crop}, the ${risk}% risk score for ${disease} (${pathogen}) is primarily driven by: (1) Atmospheric relative humidity at ${rh}% with ${humidH} continuous wet hours forecasted (RH ≥ 80%), (2) Current temperature (${temp}°C) in the pathogen sporulation window, and (3) Canopy NDVI anomaly at ${ndvi} indicating foliar cellular degradation.`;
  }

  if (
    q.includes('spray') ||
    q.includes('medicine') ||
    q.includes('fungicide') ||
    q.includes('treatment') ||
    q.includes('chemical') ||
    q.includes('dosage') ||
    q.includes('दवा') ||
    q.includes('फवारणी') ||
    q.includes('इलाज') ||
    q.includes('औषध')
  ) {
    const sprayList = sprays.map((s) => `• ${s.name} @ ${s.dosage} [${s.type}]`).join('\n');
    if (lang === 'hi') {
      return `वर्तमान में ${crop} के लिए अनुशंसित ICAR कवकनाशी उपचार:\n${sprayList}\nसावधानी: सुबह 6:00 से 9:00 बजे के बीच 500 लीटर पानी प्रति हेक्टेयर की दर से नैपसैक स्प्रेयर द्वारा छिड़काव करें।`;
    }
    if (lang === 'mr') {
      return `सध्या ${crop} पिकासाठी शिफारशीत ICAR रासायनिक फवारणी:\n${sprayList}\nटीप: सकाळी 6 ते 9 च्या दरम्यान 500 लिटर पाणी प्रति हेक्टर या प्रमाणात फवारणी करावी.`;
    }
    return `Standardized ICAR chemical mitigation protocol for ongoing ${crop} inspection:\n${sprayList}\nApplication Guide: Calibrate sprayer to 500 L water/ha. Spray in early morning (6:00-9:00 AM) to avoid chemical photodegradation.`;
  }

  if (
    q.includes('weather') ||
    q.includes('temp') ||
    q.includes('humidity') ||
    q.includes('rain') ||
    q.includes('मौसम') ||
    q.includes('हवामान') ||
    q.includes('तापमान')
  ) {
    if (lang === 'hi') {
      return `आपके भूखंड का लाइव मौसम डेटा (Open-Meteo API): तापमान ${temp}°C, आर्द्रता ${rh}%, वायुमंडलीय दबाव ${weather.current.pressure} hPa, हवा की गति ${weather.current.windSpeed} km/h, और वाष्प दबाव घाटा (VPD) ${vpd} kPa है।`;
    }
    if (lang === 'mr') {
      return `आपल्या शेताची थेट हवामान माहिती (Open-Meteo API): तापमान ${temp}°C, आर्द्रता ${rh}%, वातावरणीय दाब ${weather.current.pressure} hPa, वाऱ्याचा वेग ${weather.current.windSpeed} km/h, आणि बाष्प दाब तूट (VPD) ${vpd} kPa आहे.`;
    }
    return `Live telemetry for your plot coordinates: Ambient Temperature = ${temp}°C, Relative Humidity = ${rh}%, Wind Speed = ${weather.current.windSpeed} km/h, Surface Pressure = ${weather.current.pressure} hPa, and Vapor Pressure Deficit (VPD) = ${vpd} kPa.`;
  }

  if (
    q.includes('ndvi') ||
    q.includes('lswi') ||
    q.includes('satellite') ||
    q.includes('remote') ||
    q.includes('उपग्रह') ||
    q.includes('सेंसिंग')
  ) {
    if (lang === 'hi') {
      return `सेंटिनल-2 उपग्रह सूचकांक विश्लेषण: NDVI = ${ndvi} (${spectral.vegetationHealth}), LSWI (पत्ती नमी) = ${lswi}, NDRE (क्लोरोफिल) = ${spectral.ndre}, और EVI = ${spectral.evi} है। कम NDVI फसल की पत्तियों में क्षति को दर्शाता है।`;
    }
    if (lang === 'mr') {
      return `सेंटिनेल-2 उपग्रह निर्देशांक विश्लेषण: NDVI = ${ndvi} (${spectral.vegetationHealth}), LSWI (पानातील ओलावा) = ${lswi}, NDRE = ${spectral.ndre}, आणि EVI = ${spectral.evi}. कमी NDVI पानांचे नुकसान दर्शवतो.`;
    }
    return `Sentinel-2 Multi-spectral assessment: NDVI = ${ndvi} (${spectral.vegetationHealth}), LSWI = ${lswi} (Canopy Liquid Water), NDRE = ${spectral.ndre} (Red-Edge Chlorophyll), and EVI = ${spectral.evi}. Low NDVI indicates pathogen-induced chlorosis and structural damage.`;
  }

  if (
    q.includes('drain') ||
    q.includes('water') ||
    q.includes('soil') ||
    q.includes('पानी') ||
    q.includes('निकासी') ||
    q.includes('निचरा')
  ) {
    if (lang === 'hi') {
      return `खेत प्रबंधन सलाह: कम से कम 25-30 सेमी गहरी जल निकासी नालियां बनाएं। फव्वारा (स्प्रिंकलर) सिंचाई बंद करें और केवल ड्रिप सिंचाई का उपयोग करें ताकि पत्तियों पर पानी की बूंदें न ठहरें।`;
    }
    if (lang === 'mr') {
      return `शेत व्यवस्थापन सल्ला: शेतात किमान 25-30 सेमी खोलीचे चर काढून अतिरिक्त पाणी काढून द्या. तुषार सिंचन बंद करून ठिबक सिंचनाचा वापर करा, जेणेकरून पानांवर पाण्याचे थेंब साचणार नाहीत.`;
    }
    return `Agronomic management: Excavate perimeter drainage trenches of minimum 25-30 cm depth to prevent root hypoxia. Discontinue sprinkler overhead irrigation and switch to drip to prevent foliar splash dispersal of fungal zoospores.`;
  }

  if (lang === 'hi') {
    return `वर्तमान में आप ${crop} का विश्लेषण देख रहे हैं, जिसमें ${disease} का जोखिम ${risk}% है। आप मुझसे इसके कारण, ICAR अनुशंसित दवा, लाइव मौसम (${temp}°C, ${rh}%), या उपग्रह NDVI (${ndvi}) के बारे में पूछ सकते हैं।`;
  }
  if (lang === 'mr') {
    return `सध्या आपण ${crop} पिकाचे विश्लेषण पाहत आहात, ज्यामध्ये ${disease} चा धोका ${risk}% आहे. आपण मला याचे कारण, शिफारशीत फवारणी, थेट हवामान (${temp}°C, ${rh}%), किंवा उपग्रह NDVI (${ndvi}) बद्दल विचारू शकता.`;
  }
  return `Currently inspecting ${crop} with a ${risk}% risk score for ${disease} (${pathogen}). You can ask me: "Why is the risk high?", "What chemical spray to apply?", "Explain current NDVI and LSWI", or "What are the live weather factors?".`;
}
