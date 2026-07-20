module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { country, electricity_kwh, fuel_type, fuel_quantity } = req.body || {};

  // ── GRID EMISSION FACTORS (kg CO2e per kWh) ──────────────────────────────
  // Sources: IEA 2023, EMA Singapore 2024, various national grid operators
  const GRID_FACTORS = {
    'singapore':    0.4168,
    'malaysia':     0.6070,
    'indonesia':    0.7890,
    'thailand':     0.4990,
    'vietnam':      0.4850,
    'philippines':  0.6230,
    'bangladesh':   0.6490,
    'india':        0.7080,
    'china':        0.5810,
    'germany':      0.3850,
    'uk':           0.2330,
    'usa':          0.3860,
    'australia':    0.6800,
    'default':      0.5000
  };

  // ── FUEL EMISSION FACTORS ─────────────────────────────────────────────────
  // Sources: IPCC 2006, GHG Protocol Stationary Combustion
  const FUEL_FACTORS = {
    // Natural gas — per therm
    'natural gas':        { factor: 5.3, unit: 'therms', label: 'Natural Gas' },
    'natural_gas':        { factor: 5.3, unit: 'therms', label: 'Natural Gas' },
    // Diesel — per litre
    'diesel':             { factor: 2.68, unit: 'litres', label: 'Diesel' },
    // Petrol / Gasoline — per litre
    'petrol':             { factor: 2.31, unit: 'litres', label: 'Petrol' },
    'gasoline':           { factor: 2.31, unit: 'litres', label: 'Petrol' },
    // LPG — per litre
    'lpg':                { factor: 1.51, unit: 'litres', label: 'LPG' },
    // Coal — per kg
    'coal':               { factor: 2.42, unit: 'kg',     label: 'Coal' },
    // Heavy fuel oil — per litre
    'heavy fuel oil':     { factor: 3.18, unit: 'litres', label: 'Heavy Fuel Oil' },
    'fuel oil':           { factor: 3.18, unit: 'litres', label: 'Heavy Fuel Oil' },
    // Biomass — near zero (biogenic)
    'biomass':            { factor: 0.02, unit: 'kg',     label: 'Biomass' }
  };

  const results = {
    scope1: null,
    scope2: null,
    total_tco2e: null,
    breakdown: [],
    methodology: [],
    confidence: 'HIGH',
    warnings: []
  };

  let totalKgCO2e = 0;

  // ── SCOPE 2: ELECTRICITY ──────────────────────────────────────────────────
  const kwh = parseFloat(String(electricity_kwh || '').replace(/[^0-9.]/g, ''));
  if (kwh > 0) {
    const countryKey = (country || 'default').toLowerCase().trim();
    const gridFactor = GRID_FACTORS[countryKey] || GRID_FACTORS['default'];
    const usedDefault = !GRID_FACTORS[countryKey];
    const kgCO2e = kwh * gridFactor;
    totalKgCO2e += kgCO2e;

    results.scope2 = {
      kwh,
      grid_factor: gridFactor,
      country: country || 'Unknown',
      kg_co2e: Math.round(kgCO2e),
      tco2e: parseFloat((kgCO2e / 1000).toFixed(3))
    };
    results.breakdown.push({
      source: 'Electricity',
      scope: 2,
      quantity: `${kwh.toLocaleString()} kWh`,
      factor: `${gridFactor} kg CO₂e/kWh`,
      result_tco2e: parseFloat((kgCO2e / 1000).toFixed(3))
    });
    results.methodology.push(
      `Scope 2 electricity: ${kwh.toLocaleString()} kWh × ${gridFactor} kg CO₂e/kWh (${usedDefault ? 'global average — country not found' : (country + ' grid factor, IEA 2023/EMA 2024')}) = ${(kgCO2e / 1000).toFixed(3)} tCO₂e`
    );
    if (usedDefault) {
      results.warnings.push(`Country "${country}" not found in database — used global average grid factor (0.500 kg CO₂e/kWh). Verify country name for accuracy.`);
      results.confidence = 'MEDIUM';
    }
  }

  // ── SCOPE 1: FUEL ─────────────────────────────────────────────────────────
  const fuelKey = (fuel_type || '').toLowerCase().trim();
  const fuelData = FUEL_FACTORS[fuelKey];
  const rawQty = String(fuel_quantity || '').replace(/[^0-9.]/g, '');
  const fuelQty = parseFloat(rawQty);

  if (fuelData && fuelQty > 0) {
    const kgCO2e = fuelQty * fuelData.factor;
    totalKgCO2e += kgCO2e;

    results.scope1 = {
      fuel_type: fuelData.label,
      quantity: fuelQty,
      unit: fuelData.unit,
      factor: fuelData.factor,
      kg_co2e: Math.round(kgCO2e),
      tco2e: parseFloat((kgCO2e / 1000).toFixed(3))
    };
    results.breakdown.push({
      source: fuelData.label,
      scope: 1,
      quantity: `${fuelQty.toLocaleString()} ${fuelData.unit}`,
      factor: `${fuelData.factor} kg CO₂e/${fuelData.unit}`,
      result_tco2e: parseFloat((kgCO2e / 1000).toFixed(3))
    });
    results.methodology.push(
      `Scope 1 ${fuelData.label}: ${fuelQty.toLocaleString()} ${fuelData.unit} × ${fuelData.factor} kg CO₂e/${fuelData.unit} (IPCC 2006 / GHG Protocol) = ${(kgCO2e / 1000).toFixed(3)} tCO₂e`
    );
  } else if (fuel_type && !fuelData) {
    results.warnings.push(`Fuel type "${fuel_type}" not found in database. Supported types: natural gas, diesel, petrol, LPG, coal, heavy fuel oil, biomass.`);
    results.confidence = results.confidence === 'HIGH' ? 'MEDIUM' : results.confidence;
  }

  if (totalKgCO2e === 0) {
    return res.status(400).json({
      error: 'No calculable data provided. Please provide electricity_kwh or fuel_type + fuel_quantity.'
    });
  }

  results.total_tco2e = parseFloat((totalKgCO2e / 1000).toFixed(3));
  results.total_kg_co2e = Math.round(totalKgCO2e);

  return res.status(200).json(results);
};
