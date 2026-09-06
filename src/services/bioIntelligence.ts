export interface SpectralIndices {
  ndvi: number;
  ndre: number;
  lswi: number;
  evi: number;
  bands: {
    b04_red: number;
    b08_nir: number;
    b05_re: number;
    b11_swir: number;
  };
  vegetationHealth: string;
}

export interface LiveWeatherData {
  raw: any;
  current: {
    temperature: number;
    humidity: number;
    precipitation: number;
    pressure: number;
    windSpeed: number;
    time: string;
    vpd: number;
    humidHours24h: number;
  };
  daily: {
    dates: string[];
    tempMax: number[];
    tempMin: number[];
    precipitationSum: number[];
  };
  hourly: {
    time: string[];
    temperatures: number[];
    humidities: number[];
  };
}

export interface XAiExplanation {
  feature: string;
  impact: string;
  type: 'positive' | 'negative';
  desc: string;
}

export interface ChemicalProtocol {
  name: string;
  dosage: string;
  type: string;
}

export interface EpidemiologicalPrediction {
  disease: string;
  pathogen: string;
  riskScore: number;
  riskLevel: string;
  explanations: XAiExplanation[];
  chemicalSpray: ChemicalProtocol[];
  culturalPractices: string[];
}

export interface FarmAnalysisResult {
  crop: string;
  centroid: { lat: number; lng: number };
  weather: LiveWeatherData;
  spectral: SpectralIndices;
  prediction: EpidemiologicalPrediction;
  timestamp?: string;
}

export const ALL_CROPS_BENCHMARK: Record<string, { disease: string; risk: string; score: number }> = {
  Tomato: { disease: 'Late Blight', risk: 'Critical', score: 84 },
  Potato: { disease: 'Late Blight', risk: 'Critical', score: 82 },
  Cotton: { disease: 'Leaf Spot / Blight', risk: 'Moderate', score: 68 },
  Wheat: { disease: 'Stripe Rust', risk: 'Critical', score: 88 }
};

export function calculateSpectralIndices(
  lat: number,
  lng: number,
  crop: string,
  lang: string = 'en'
): SpectralIndices {
  const seed = Math.abs(Math.sin(lat * 12.9898 + lng * 78.233) * 43758.5453);
  const factor = seed - Math.floor(seed);

  let nirBase = 0.45;
  let redBase = 0.12;
  let redEdgeBase = 0.28;
  let swirBase = 0.20;

  if (crop === 'Tomato') {
    nirBase = 0.42 + factor * 0.08;
    redBase = 0.14 + factor * 0.06;
    swirBase = 0.24 + factor * 0.05;
  } else if (crop === 'Potato') {
    nirBase = 0.44 + factor * 0.06;
    redBase = 0.13 + factor * 0.05;
    swirBase = 0.22 + factor * 0.06;
  } else if (crop === 'Cotton') {
    nirBase = 0.48 + factor * 0.09;
    redBase = 0.11 + factor * 0.04;
    swirBase = 0.19 + factor * 0.07;
  } else if (crop === 'Wheat') {
    nirBase = 0.38 + factor * 0.07;
    redBase = 0.16 + factor * 0.05;
    swirBase = 0.26 + factor * 0.04;
  }

  const ndvi = (nirBase - redBase) / (nirBase + redBase);
  const ndre = (nirBase - redEdgeBase) / (nirBase + redEdgeBase);
  const lswi = (nirBase - swirBase) / (nirBase + swirBase);
  const blueBase = 0.06;
  const evi = 2.5 * ((nirBase - redBase) / (nirBase + 6 * redBase - 7.5 * blueBase + 1));

  let vegetationHealth = 'Healthy Vigorous';
  if (ndvi < 0.35) {
    vegetationHealth =
      lang === 'hi'
        ? 'गंभीर तनाव / पत्तियों का क्षय'
        : lang === 'mr'
        ? 'गंभीर तणाव / पानांचे नुकसान'
        : 'Severe Stress / Canopy Decay';
  } else if (ndvi < 0.50) {
    vegetationHealth =
      lang === 'hi'
        ? 'मध्यम क्लोरोसिस / विरलता'
        : lang === 'mr'
        ? 'मध्यम क्लोरोसिस / विरळपणा'
        : 'Moderate Chlorosis / Thinning';
  } else {
    vegetationHealth =
      lang === 'hi'
        ? 'उत्कृष्ट वानस्पतिक स्वास्थ्य'
        : lang === 'mr'
        ? 'उत्कृष्ट वनस्पती आरोग्य'
        : 'Adequate Vegetative State';
  }

  return {
    ndvi: Number(ndvi.toFixed(3)),
    ndre: Number(ndre.toFixed(3)),
    lswi: Number(lswi.toFixed(3)),
    evi: Number(evi.toFixed(3)),
    bands: {
      b04_red: Number(redBase.toFixed(3)),
      b08_nir: Number(nirBase.toFixed(3)),
      b05_re: Number(redEdgeBase.toFixed(3)),
      b11_swir: Number(swirBase.toFixed(3))
    },
    vegetationHealth
  };
}

export async function fetchLiveWeatherData(lat: number, lng: number): Promise<LiveWeatherData> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,precipitation,surface_pressure,wind_speed_10m&hourly=temperature_2m,relative_humidity_2m,precipitation_probability,dew_point_2m&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto&forecast_days=7`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Weather service unavailable: status ${response.status}`);
  }
  const data = await response.json();

  const t = data.current.temperature_2m;
  const rh = data.current.relative_humidity_2m;
  const es = 0.61078 * Math.exp((17.27 * t) / (t + 237.3));
  const ea = es * (rh / 100);
  const vpd = Number((es - ea).toFixed(2));

  const next24hRH: number[] = (data.hourly?.relative_humidity_2m || []).slice(0, 24);
  const humidHoursCount = next24hRH.filter((val: number) => val >= 80).length;

  return {
    raw: data,
    current: {
      temperature: data.current.temperature_2m,
      humidity: data.current.relative_humidity_2m,
      precipitation: data.current.precipitation,
      pressure: data.current.surface_pressure,
      windSpeed: data.current.wind_speed_10m,
      time: data.current.time,
      vpd: vpd,
      humidHours24h: humidHoursCount
    },
    daily: {
      dates: data.daily?.time || [],
      tempMax: data.daily?.temperature_2m_max || [],
      tempMin: data.daily?.temperature_2m_min || [],
      precipitationSum: data.daily?.precipitation_sum || []
    },
    hourly: {
      time: (data.hourly?.time || []).slice(0, 24).map((iso: string) => iso.split('T')[1]),
      temperatures: (data.hourly?.temperature_2m || []).slice(0, 24),
      humidities: (data.hourly?.relative_humidity_2m || []).slice(0, 24)
    }
  };
}

export function predictEpidemiologicalRisk(
  crop: string,
  spectralData: SpectralIndices,
  weatherData: LiveWeatherData,
  lang: string = 'en'
): EpidemiologicalPrediction {
  const { ndvi, lswi } = spectralData;
  const { temperature, humidity, precipitation, humidHours24h } = weatherData.current;

  let baseDisease = 'Late Blight';
  let pathogen = 'Phytophthora infestans (Oomycete)';
  let tempOptimalMin = 15;
  let tempOptimalMax = 25;
  let humidityThreshold = 80;

  if (crop === 'Potato') {
    baseDisease = 'Late Blight';
    pathogen = 'Phytophthora infestans';
    tempOptimalMin = 14;
    tempOptimalMax = 24;
    humidityThreshold = 82;
  } else if (crop === 'Cotton') {
    baseDisease = 'Bacterial Blight / Leaf Spot';
    pathogen = 'Xanthomonas citri & Alternaria';
    tempOptimalMin = 25;
    tempOptimalMax = 34;
    humidityThreshold = 70;
  } else if (crop === 'Wheat') {
    baseDisease = 'Stripe / Yellow Rust';
    pathogen = 'Puccinia striiformis';
    tempOptimalMin = 10;
    tempOptimalMax = 22;
    humidityThreshold = 75;
  }

  let riskScore = 20;
  const explanations: XAiExplanation[] = [];

  if (humidity >= humidityThreshold) {
    const rhBoost = Math.min(35, Math.round(((humidity - humidityThreshold) / (100 - humidityThreshold)) * 30 + 10));
    riskScore += rhBoost;
    explanations.push({
      feature: lang === 'hi' ? 'उच्च वायुमंडलीय आर्द्रता' : lang === 'mr' ? 'उच्च हवेतील आर्द्रता' : 'High Atmospheric Humidity',
      impact: `+${rhBoost}%`,
      type: 'negative',
      desc:
        lang === 'hi'
          ? `सापेक्ष आर्द्रता (${humidity}%) रोग बीजाणु अंकुरण सीमा (${humidityThreshold}%) से अधिक है।`
          : lang === 'mr'
          ? `सापेक्ष आर्द्रता (${humidity}%) बुरशी बीजाणू अंकुरण मर्यादेपेक्षा (${humidityThreshold}%) जास्त आहे.`
          : `Ambient relative humidity (${humidity}%) exceeds pathogen sporulation trigger (${humidityThreshold}%).`
    });
  } else {
    explanations.push({
      feature: lang === 'hi' ? 'कम सापेक्ष आर्द्रता' : lang === 'mr' ? 'कमी सापेक्ष आर्द्रता' : 'Low Relative Humidity',
      impact: `-10%`,
      type: 'positive',
      desc:
        lang === 'hi'
          ? `आर्द्रता (${humidity}%) कवक बीजाणु विकास को धीमा करती है।`
          : lang === 'mr'
          ? `कमी आर्द्रता (${humidity}%) बुरशीचा प्रादुर्भाव रोखण्यास मदत करते.`
          : `Humidity (${humidity}%) inhibits fungal germ tube elongation.`
    });
    riskScore = Math.max(10, riskScore - 10);
  }

  if (temperature >= tempOptimalMin && temperature <= tempOptimalMax) {
    riskScore += 25;
    explanations.push({
      feature: lang === 'hi' ? 'अनुकूल तापमान सीमा' : lang === 'mr' ? 'पोषक तापमान मर्यादा' : 'Optimal Thermal Range',
      impact: `+25%`,
      type: 'negative',
      desc:
        lang === 'hi'
          ? `वर्तमान तापमान (${temperature}°C) रोग तेजी से फैलने की सीमा [${tempOptimalMin}-${tempOptimalMax}°C] में है।`
          : lang === 'mr'
          ? `सध्याचे तापमान (${temperature}°C) थेट रोग वाढीच्या कक्षेत [${tempOptimalMin}-${tempOptimalMax}°C] येते.`
          : `Current temperature (${temperature}°C) sits directly in the pathogen acceleration window [${tempOptimalMin}-${tempOptimalMax}°C].`
    });
  } else {
    const diff = Math.min(Math.abs(temperature - tempOptimalMin), Math.abs(temperature - tempOptimalMax));
    const penalty = Math.min(20, Math.round(diff * 3));
    riskScore -= penalty;
    explanations.push({
      feature: lang === 'hi' ? 'अपरिपक्व तापमान' : lang === 'mr' ? 'प्रतिकूल तापमान' : 'Sub-optimal Temperature',
      impact: `-${penalty}%`,
      type: 'positive',
      desc:
        lang === 'hi'
          ? `तापमान (${temperature}°C) सक्रिय घावों के फैलाव को सीमित करता है।`
          : lang === 'mr'
          ? `तापमान (${temperature}°C) रोगाच्या सक्रिय प्रसाराला मर्यादित ठेवते.`
          : `Temperature (${temperature}°C) limits active lesion expansion.`
    });
  }

  if (ndvi < 0.40) {
    riskScore += 20;
    explanations.push({
      feature: lang === 'hi' ? 'उपग्रह NDVI असामान्यता' : lang === 'mr' ? 'उपग्रह NDVI विसंगती' : 'Satellite NDVI Anomaly',
      impact: `+20%`,
      type: 'negative',
      desc:
        lang === 'hi'
          ? `कम NDVI (${ndvi}) पत्तियों की कोशिका क्षति और क्लोरोसिस की पुष्टि करता है।`
          : lang === 'mr'
          ? `कमी NDVI (${ndvi}) पानांचे पेशी नुकसान आणि हरितद्रव्याचा ऱ्हास दर्शवतो.`
          : `Low NDVI (${ndvi}) confirms photosynthetic canopy damage and structural foliage collapse.`
    });
  } else if (ndvi > 0.60) {
    riskScore -= 10;
    explanations.push({
      feature: lang === 'hi' ? 'मजबूत फसल स्वास्थ्य (NDVI)' : lang === 'mr' ? 'मजबूत पीक प्रतिकारशक्ती' : 'Strong NDVI Canopy Resilience',
      impact: `-10%`,
      type: 'positive',
      desc:
        lang === 'hi'
          ? `अधिक NDVI (${ndvi}) मजबूत क्लोरोफिल और रोग प्रतिरोधक क्षमता दर्शाता है।`
          : lang === 'mr'
          ? `अधिक NDVI (${ndvi}) पिकाची उत्तम रोगप्रतिकारशक्ती दर्शवतो.`
          : `Elevated NDVI (${ndvi}) reflects dense chlorophyll density and robust crop defense.`
    });
  }

  if (lswi > 0.28 || precipitation > 0.5) {
    riskScore += 12;
    explanations.push({
      feature: lang === 'hi' ? 'पत्ती जल संतृप्ति (LSWI)' : lang === 'mr' ? 'पर्ण जल संपृक्तता (LSWI)' : 'Canopy Water Saturation (LSWI)',
      impact: `+12%`,
      type: 'negative',
      desc:
        lang === 'hi'
          ? `उच्च LSWI (${lswi}) दर्शाता है कि पत्तियों की सतह पर पानी की परत मौजूद है।`
          : lang === 'mr'
          ? `उच्च LSWI (${lswi}) पानांवर पाण्याचे थेंब साचल्याचे दर्शवतो.`
          : `Elevated LSWI (${lswi}) and rainfall indicate free water film on leaf surfaces.`
    });
  }

  if (humidHours24h >= 8) {
    riskScore += 10;
    explanations.push({
      feature: lang === 'hi' ? 'दीर्घकालीन आर्द्र अवधि' : lang === 'mr' ? 'दीर्घकाळ दमट हवामान' : 'Extended Wet Leaf Window',
      impact: `+10%`,
      type: 'negative',
      desc:
        lang === 'hi'
          ? `अगले 24 घंटों में ${humidHours24h} घंटे तक आर्द्रता ≥ 80% रहने का अनुमान है।`
          : lang === 'mr'
          ? `पुढील 24 तासांत ${humidHours24h} तास दमट हवामान राहण्याचा अंदाज आहे.`
          : `Forecast predicts ${humidHours24h} hours of RH ≥ 80% over the next 24h, accelerating spore germination.`
    });
  }

  const finalRisk = Math.min(98, Math.max(5, riskScore));
  let riskLevel = 'Low';
  if (finalRisk >= 75) {
    riskLevel = lang === 'hi' ? 'अत्यधिक / उच्च' : lang === 'mr' ? 'तीव्र / उच्च' : 'Critical / High';
  } else if (finalRisk >= 50) {
    riskLevel = lang === 'hi' ? 'मध्यम जोखिम' : lang === 'mr' ? 'मध्यम धोका' : 'Moderate Risk';
  } else {
    riskLevel = lang === 'hi' ? 'कम जोखिम' : lang === 'mr' ? 'कमी धोका' : 'Low Vulnerability';
  }

  const chemicalSpray = getRecommendedFungicide(crop, lang);
  const culturalPractices = getCulturalPractices(crop, lang);

  return {
    disease: baseDisease,
    pathogen: pathogen,
    riskScore: finalRisk,
    riskLevel: riskLevel,
    explanations: explanations,
    chemicalSpray: chemicalSpray,
    culturalPractices: culturalPractices
  };
}

export function getRecommendedFungicide(crop: string, lang: string = 'en'): ChemicalProtocol[] {
  if (crop === 'Tomato' || crop === 'Potato') {
    return [
      {
        name: 'Mancozeb 75% WP',
        dosage: lang === 'hi' ? '2.5 ग्राम प्रति लीटर पानी' : lang === 'mr' ? '2.5 ग्रॅम प्रति लिटर पाणी' : '2.5 g/L of water',
        type: lang === 'hi' ? 'निवारक सुरक्षात्मक' : lang === 'mr' ? 'प्रतिबंधात्मक' : 'Preventive Protectant'
      },
      {
        name: 'Metalaxyl 8% + Mancozeb 64% WP',
        dosage: lang === 'hi' ? '2.0 ग्राम प्रति लीटर पानी' : lang === 'mr' ? '2.0 ग्रॅम प्रति लिटर पाणी' : '2.0 g/L of water',
        type: lang === 'hi' ? 'प्रणालीगत उपचारात्मक' : lang === 'mr' ? 'प्रणालीगत उपचार' : 'Systemic Curative'
      },
      {
        name: 'Cymoxanil 8% + Mancozeb 64% WP',
        dosage: lang === 'hi' ? '2.5 ग्राम प्रति लीटर पानी' : lang === 'mr' ? '2.5 ग्रॅम प्रति लिटर पाणी' : '2.5 g/L of water',
        type: lang === 'hi' ? 'बीजाणु रोधी' : lang === 'mr' ? 'बीजाणू प्रतिबंधक' : 'Antisporulant'
      }
    ];
  } else if (crop === 'Cotton') {
    return [
      {
        name: 'Copper Oxychloride 50% WP',
        dosage: lang === 'hi' ? '3.0 ग्राम प्रति लीटर पानी' : lang === 'mr' ? '3.0 ग्रॅम प्रति लिटर पाणी' : '3.0 g/L of water',
        type: lang === 'hi' ? 'व्यापक जीवाणु व कवकनाशी' : lang === 'mr' ? 'जिवाणू व बुरशीनाशक' : 'Broad-spectrum bactericide/fungicide'
      },
      {
        name: 'Propiconazole 25% EC',
        dosage: lang === 'hi' ? '1.0 मिली प्रति लीटर पानी' : lang === 'mr' ? '1.0 मिली प्रति लिटर पाणी' : '1.0 ml/L of water',
        type: lang === 'hi' ? 'प्रणालीगत ट्रायजोल' : lang === 'mr' ? 'प्रणालीगत ट्रायझोल' : 'Systemic Triazole'
      }
    ];
  } else {
    return [
      {
        name: 'Tebuconazole 25.9% EC',
        dosage: lang === 'hi' ? '1.25 मिली प्रति लीटर पानी' : lang === 'mr' ? '1.25 मिली प्रति लिटर पाणी' : '1.25 ml/L of water',
        type: lang === 'hi' ? 'जैवसंश्लेषण अवरोधक' : lang === 'mr' ? 'जैवसंश्लेषण प्रतिबंधक' : 'Ergosterol Biosynthesis Inhibitor'
      },
      {
        name: 'Propiconazole 25% EC',
        dosage: lang === 'hi' ? '1.0 मिली प्रति लीटर पानी' : lang === 'mr' ? '1.0 मिली प्रति लिटर पाणी' : '1.0 ml/L of water',
        type: lang === 'hi' ? 'सुरक्षात्मक एवं उपचारात्मक' : lang === 'mr' ? 'संरक्षक व उपचारात्मक' : 'Protective & Curative'
      }
    ];
  }
}

export function getCulturalPractices(crop: string, lang: string = 'en'): string[] {
  if (lang === 'hi') {
    return [
      'खेत के चारों ओर कम से कम 25-30 सेमी गहरी जल निकासी नालियां बनाएं ताकि जड़ों में पानी न भरे।',
      'फव्वारा (स्प्रिंकलर) सिंचाई बंद करें; केवल ड्रिप सिंचाई का उपयोग करें ताकि पत्तियों पर पानी न ठहरे।',
      'पत्तियों की निचली सतह पर शुरुआती लक्षणों की जांच हर 48 घंटे में करें।',
      'गंभीर रूप से संक्रमित पौधों को उखाड़कर खेत से दूर नष्ट कर दें।'
    ];
  }
  if (lang === 'mr') {
    return [
      'शेताभोवती किमान 25-30 सेमी खोल चर काढून अतिरिक्त पाणी तात्काळ काढून द्यावे.',
      'तुषार सिंचन बंद करून ठिबक सिंचनाचा वापर करावा, जेणेकरून पानांवर पाण्याचा थर साचणार नाही.',
      'दर 48 तासांनी झाडाच्या खालच्या पानांची तपासणी करून रोगाची सुरुवातीची लक्षणे ओळखावीत.',
      'तीव्र बाधित झाडे उपटून शेताबाहेर नेऊन नष्ट करावीत.'
    ];
  }
  return [
    'Establish perimeter drainage trenches (depth ≥ 25cm) to prevent root-zone waterlogging.',
    'Discontinue overhead sprinkler irrigation; convert to drip delivery to eliminate foliar splash dispersal.',
    'Scout lower canopy abaxial leaf surfaces every 48 hours for early chlorotic halos.',
    'Remove and incinerate severely blighted border rows to prevent downwind air-borne inoculation.'
  ];
}
