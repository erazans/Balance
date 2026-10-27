import { XiaomiScaleModel } from '../types';

/**
 * Xiaomi Bluetooth Low Energy (BLE) Scale Parser & Web Bluetooth Integration
 * Supports:
 * - Xiaomi Mi Scale 1 (XMTZC01HM) - Weight Scale Service 0x181D
 * - Xiaomi Mi Scale 2 (XMTZC04HM) - Weight Scale Service 0x181D
 * - Xiaomi Mi Body Composition Scale 2 (XMTZC05HM) - Body Composition Service 0x181B
 * - Xiaomi Eight-Electrode Body Composition Scale (XMTZC08HM) - Dual Frequency BIA 0x181B
 */

export interface XiaomiScaleModelSpec {
  id: XiaomiScaleModel;
  name: string;
  modelCode: string;
  generation: string;
  bleServiceUuid: string;
  hasImpedance: boolean;
  eightElectrode: boolean;
  precisionKg: number;
  description: string;
}

export const XIAOMI_SCALE_MODELS: XiaomiScaleModelSpec[] = [
  {
    id: 'mi-scale-1',
    name: 'Xiaomi Mi Smart Scale 1',
    modelCode: 'XMTZC01HM',
    generation: '1ère Génération',
    bleServiceUuid: '0x181D',
    hasImpedance: false,
    eightElectrode: false,
    precisionKg: 0.1,
    description: 'Pesée haute précision en verre trempé blanc, capteur acier au manganèse (GATT 0x181D).',
  },
  {
    id: 'mi-scale-2',
    name: 'Xiaomi Mi Smart Scale 2',
    modelCode: 'XMTZC04HM',
    generation: '2ème Génération',
    bleServiceUuid: '0x181D',
    hasImpedance: false,
    eightElectrode: false,
    precisionKg: 0.05,
    description: 'Bluetooth 5.0 basse consommation, test d’équilibre unipodal et précision 50g.',
  },
  {
    id: 'mi-body-comp-2',
    name: 'Xiaomi Mi Body Composition Scale 2',
    modelCode: 'XMTZC05HM',
    generation: 'Génération BIA 4-Électrodes',
    bleServiceUuid: '0x181B',
    hasImpedance: true,
    eightElectrode: false,
    precisionKg: 0.05,
    description: '4 électrodes en acier inoxydable 304L, mesure d’impédance bioélectrique (BIA) 50 kHz.',
  },
  {
    id: 'mi-eight-electrode',
    name: 'Xiaomi Eight-Electrode Body Scale',
    modelCode: 'XMTZC08HM',
    generation: 'Génération Pro 8-Électrodes',
    bleServiceUuid: '0x181B / 0x181D',
    hasImpedance: true,
    eightElectrode: true,
    precisionKg: 0.05,
    description: 'Barre de préhension rétractable 8 électrodes, analyse segmentaire bi-fréquence (20/100 kHz).',
  },
];

export interface DecodedXiaomiPacket {
  weightKg: number;
  impedanceOhm?: number;
  isStabilized: boolean;
  isWeightRemoved: boolean;
  unit: 'kg' | 'lb' | 'jin';
  rawHex: string;
}

/**
 * Decodes a 13-byte Xiaomi Mi Body Composition Scale BLE GATT packet (0x181B / 0x2A9C)
 * Byte 0-1: Control flags
 * Byte 2-8: Timestamp
 * Byte 9-10: Impedance (uint16 little-endian)
 * Byte 11-12: Weight (uint16 little-endian, divided by 200 for kg or 100 for lb/jin)
 */
export function parseXiaomiBlePacket(bytes: Uint8Array): DecodedXiaomiPacket {
  const rawHex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0').toUpperCase())
    .join(' ');

  if (bytes.length < 13) {
    // Standard 0x181D 10-byte packet fallback (Mi Scale 1 / 2)
    const ctrl0 = bytes[0] ?? 0x02;
    const isLbs = (ctrl0 & 0x01) !== 0;
    const isJin = (ctrl0 & 0x10) !== 0;
    const isStabilized = (ctrl0 & 0x20) !== 0;
    const isWeightRemoved = (ctrl0 & 0x80) !== 0;
    const rawWeight = (bytes[1] ?? 0) | ((bytes[2] ?? 0) << 8);
    const divisor = isLbs || isJin ? 100 : 200;
    const weightVal = rawWeight / divisor;
    const weightKg = isLbs ? weightVal * 0.453592 : isJin ? weightVal * 0.5 : weightVal;

    return {
      weightKg: Number(weightKg.toFixed(2)),
      isStabilized,
      isWeightRemoved,
      unit: isLbs ? 'lb' : isJin ? 'jin' : 'kg',
      rawHex,
    };
  }

  const ctrlByte0 = bytes[0];
  const ctrlByte1 = bytes[1];

  const isLbs = (ctrlByte0 & 0x01) !== 0;
  const isJin = (ctrlByte1 & 0x04) !== 0;
  const hasImpedanceFlag = (ctrlByte1 & 0x02) !== 0;
  const isStabilized = (ctrlByte1 & 0x20) !== 0;
  const isWeightRemoved = (ctrlByte1 & 0x80) !== 0;

  const rawImpedance = bytes[9] | (bytes[10] << 8);
  const rawWeight = bytes[11] | (bytes[12] << 8);

  const divisor = isLbs || isJin ? 100 : 200;
  const measuredVal = rawWeight / divisor;
  const weightKg = isLbs ? measuredVal * 0.453592 : isJin ? measuredVal * 0.5 : measuredVal;

  return {
    weightKg: Number(weightKg.toFixed(2)),
    impedanceOhm: hasImpedanceFlag && rawImpedance > 0 && rawImpedance < 3000 ? rawImpedance : undefined,
    isStabilized,
    isWeightRemoved,
    unit: isLbs ? 'lb' : isJin ? 'jin' : 'kg',
    rawHex,
  };
}

/**
 * Generates an authentic 13-byte Xiaomi BLE packet for live telemetry display and verification
 */
export function buildXiaomiBlePacket(
  weightKg: number,
  impedanceOhm: number | undefined,
  isStabilized: boolean
): Uint8Array {
  const packet = new Uint8Array(13);
  const now = new Date();
  packet[0] = 0x02; // kg unit
  packet[1] = (isStabilized ? 0x20 : 0x00) | (impedanceOhm ? 0x02 : 0x00);

  const year = now.getFullYear();
  packet[2] = year & 0xff;
  packet[3] = (year >> 8) & 0xff;
  packet[4] = now.getMonth() + 1;
  packet[5] = now.getDate();
  packet[6] = now.getHours();
  packet[7] = now.getMinutes();
  packet[8] = now.getSeconds();

  const imp = impedanceOhm ?? 0;
  packet[9] = imp & 0xff;
  packet[10] = (imp >> 8) & 0xff;

  const scaledWeight = Math.round(weightKg * 200);
  packet[11] = scaledWeight & 0xff;
  packet[12] = (scaledWeight >> 8) & 0xff;

  return packet;
}
