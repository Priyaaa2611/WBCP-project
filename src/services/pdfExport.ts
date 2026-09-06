import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { SpectralIndices, LiveWeatherData, EpidemiologicalPrediction } from './bioIntelligence';

export interface PDFExportData {
  crop: string;
  coordinates: { lat: number; lng: number }[];
  spectralData: SpectralIndices;
  weatherData: LiveWeatherData;
  prediction: EpidemiologicalPrediction;
  language?: string;
}

export function exportAdvisoryPDF(data: PDFExportData): void {
  const { crop, coordinates, spectralData, weatherData, prediction } = data;
  const doc = new jsPDF();

  // Header Banner
  doc.setFillColor(16, 185, 129); // Emerald accent matching WBCP design
  doc.rect(0, 0, 210, 28, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('AGRISHIELD BIO-CLIMATIC SATELLITE ADVISORY', 14, 13);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Automated Remote Sensing & Pathogen Epidemiology Early-Warning System', 14, 21);

  // Section 1: Inspection & Geographical Metadata
  doc.setTextColor(40, 40, 40);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('1. INSPECTION & GEOGRAPHICAL METADATA', 14, 38);
  doc.setLineWidth(0.3);
  doc.setDrawColor(200, 200, 200);
  doc.line(14, 40, 196, 40);

  const centerLat = coordinates[0]?.lat !== undefined ? coordinates[0].lat : 'N/A';
  const centerLng = coordinates[0]?.lng !== undefined ? coordinates[0].lng : 'N/A';

  const metaData = [
    ['Target Crop', crop, 'Report Generated', new Date().toLocaleString()],
    ['Field Centroid Lat', `${centerLat}° N`, 'Field Centroid Lng', `${centerLng}° E`],
    ['Region Assessment', 'India Agro-Ecological Grid', 'EO Satellite Constellation', 'Sentinel-2 BOA Multispectral']
  ];

  autoTable(doc, {
    startY: 43,
    body: metaData,
    theme: 'plain',
    styles: { fontSize: 8.5, cellPadding: 2 },
    columnStyles: {
      0: { fontStyle: 'bold', textColor: [80, 80, 80], cellWidth: 40 },
      1: { fontStyle: 'normal', textColor: [0, 0, 0], cellWidth: 55 },
      2: { fontStyle: 'bold', textColor: [80, 80, 80], cellWidth: 45 },
      3: { fontStyle: 'normal', textColor: [0, 0, 0], cellWidth: 55 }
    }
  });

  // Section 2: Pathogen Risk Forecast
  let currentY = (doc as any).lastAutoTable.finalY + 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('2. EPIDEMIOLOGICAL PATHOGEN RISK FORECAST (0-7 DAYS)', 14, currentY);
  doc.line(14, currentY + 2, 196, currentY + 2);

  const isHigh = prediction.riskScore >= 70;
  doc.setFillColor(isHigh ? 254 : 240, isHigh ? 242 : 253, isHigh ? 242 : 244);
  doc.roundedRect(14, currentY + 5, 182, 22, 2, 2, 'F');
  doc.setDrawColor(isHigh ? 220 : 70, isHigh ? 38 : 130, isHigh ? 38 : 70);
  doc.roundedRect(14, currentY + 5, 182, 22, 2, 2, 'D');

  doc.setTextColor(isHigh ? 180 : 30, isHigh ? 20 : 100, isHigh ? 20 : 40);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(`Identified Pathogen: ${prediction.disease}`, 18, currentY + 12);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'italic');
  doc.text(`Scientific Taxon: ${prediction.pathogen}`, 18, currentY + 18);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(`Risk Score: ${prediction.riskScore}% (${prediction.riskLevel})`, 130, currentY + 16);

  // Section 3: Multi-Spectral & Weather Indices
  currentY += 34;
  doc.setTextColor(40, 40, 40);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('3. MULTI-SPECTRAL SATELLITE & AGRO-METEOROLOGICAL INDICES', 14, currentY);
  doc.line(14, currentY + 2, 196, currentY + 2);

  const indicesData = [
    ['Normalized Difference Vegetation Index (NDVI)', `${spectralData.ndvi}`, 'Ambient Air Temperature', `${weatherData.current.temperature} °C`],
    ['Land Surface Water Index (LSWI)', `${spectralData.lswi}`, 'Relative Humidity (Current)', `${weatherData.current.humidity} %`],
    ['Red Edge Chlorophyll Index (NDRE)', `${spectralData.ndre}`, 'Vapor Pressure Deficit (VPD)', `${weatherData.current.vpd} kPa`],
    ['Enhanced Vegetation Index (EVI)', `${spectralData.evi}`, 'Humid Foliage Window (Next 24h)', `${weatherData.current.humidHours24h} Hours (RH≥80%)`]
  ];

  autoTable(doc, {
    startY: currentY + 5,
    head: [['Spectral Index', 'Observed Value', 'Micro-climate Parameter', 'Observed Value']],
    body: indicesData,
    theme: 'grid',
    headStyles: { fillColor: [16, 185, 129], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
    styles: { fontSize: 8, cellPadding: 2.5 }
  });

  // Section 4: Standardized Chemical Protocols
  currentY = (doc as any).lastAutoTable.finalY + 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('4. ICAR / UNIVERSITY STANDARDIZED CHEMICAL MITIGATION PROTOCOL', 14, currentY);
  doc.line(14, currentY + 2, 196, currentY + 2);

  const sprayRows = prediction.chemicalSpray.map((chem, idx) => [
    idx + 1,
    chem.name,
    chem.dosage,
    chem.type
  ]);

  autoTable(doc, {
    startY: currentY + 5,
    head: [['#', 'Fungicide / Bactericide Formulation', 'Standard Field Dosage', 'Mode of Action']],
    body: sprayRows,
    theme: 'striped',
    headStyles: { fillColor: [60, 60, 60], textColor: [255, 255, 255], fontSize: 8 },
    styles: { fontSize: 8, cellPadding: 2 }
  });

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(120, 120, 120);
  doc.text('Notice: Automated bio-climatic decision support system for agricultural extension. Verify with agronomist before application.', 14, 285);
  doc.text('Smart Agri Project | Precision Farm Intelligence', 140, 285);

  doc.save(`AgriShield_Advisory_${crop}_${new Date().toISOString().slice(0, 10)}.pdf`);
}
