/*
  Analysis engine — turns a raw tick buffer into the statistics the UI needs:
  last-digit distribution, streak/pattern scores, and a strategy signal with
  a confidence estimate. All numbers are computed from the actual buffered
  ticks; nothing here is randomly generated.

  IMPORTANT (see README "Risk/accuracy"): last-digit distribution on a
  synthetic index is close to uniform by design. Confidence values below are
  descriptive statistics about recent observed frequency/streaks, not a
  predictive guarantee. Keep the UI framing honest — "observed bias" rather
  than "will happen next".
*/

function lastDigit(quote) {
  const str = quote.toFixed(2).replace(".", "");
  return parseInt(str[str.length - 1], 10);
}

function digitDistribution(ticks) {
  const counts = new Array(10).fill(0);
  for (const t of ticks) counts[lastDigit(t.quote)] += 1;
  const total = ticks.length || 1;
  return counts.map((c) => Number(((c / total) * 100).toFixed(2)));
}

function evenOddSplit(ticks) {
  let even = 0;
  for (const t of ticks) if (lastDigit(t.quote) % 2 === 0) even++;
  const total = ticks.length || 1;
  return {
    even: Number(((even / total) * 100).toFixed(2)),
    odd: Number((((total - even) / total) * 100).toFixed(2)),
  };
}

function overUnderSplit(ticks, barrier = 4) {
  let over = 0;
  for (const t of ticks) if (lastDigit(t.quote) > barrier) over++;
  const total = ticks.length || 1;
  return {
    over: Number(((over / total) * 100).toFixed(2)),
    under: Number((((total - over) / total) * 100).toFixed(2)),
    barrier,
  };
}

function matchesDiffersSplit(ticks, targetDigit) {
  if (targetDigit === undefined || targetDigit === null) {
    const dist = digitDistribution(ticks);
    targetDigit = dist.indexOf(Math.max(...dist));
  }
  let matches = 0;
  for (const t of ticks) if (lastDigit(t.quote) === targetDigit) matches++;
  const total = ticks.length || 1;
  return {
    digit: targetDigit,
    matches: Number(((matches / total) * 100).toFixed(2)),
    differs: Number((((total - matches) / total) * 100).toFixed(2)),
  };
}

function riseFallSplit(ticks) {
  let rise = 0;
  let fall = 0;
  for (let i = 1; i < ticks.length; i++) {
    if (ticks[i].quote > ticks[i - 1].quote) rise++;
    else if (ticks[i].quote < ticks[i - 1].quote) fall++;
  }
  const total = rise + fall || 1;
  return {
    rise: Number(((rise / total) * 100).toFixed(2)),
    fall: Number(((fall / total) * 100).toFixed(2)),
  };
}

/** Longest current run of consecutive rises/falls, and consecutive same-parity digits. */
function currentStreaks(ticks) {
  let riseFallStreak = 0;
  let direction = null;
  for (let i = ticks.length - 1; i > 0; i--) {
    const dir = ticks[i].quote > ticks[i - 1].quote ? "rise" : ticks[i].quote < ticks[i - 1].quote ? "fall" : null;
    if (dir === null) break;
    if (direction === null) direction = dir;
    if (dir !== direction) break;
    riseFallStreak++;
  }

  let parityStreak = 0;
  let parity = null;
  for (let i = ticks.length - 1; i >= 0; i--) {
    const p = lastDigit(ticks[i].quote) % 2 === 0 ? "even" : "odd";
    if (parity === null) parity = p;
    if (p !== parity) break;
    parityStreak++;
  }

  return { direction, riseFallStreak, parity, parityStreak };
}

/**
 * Pattern scores (0-100) describing how strongly recent price action matches
 * named chart patterns. These are heuristics based on realized volatility,
 * local extrema, and directional persistence over the buffered window —
 * not machine-learned classifiers.
 */
function patternScores(ticks) {
  if (ticks.length < 20) return [];
  const closes = ticks.map((t) => t.quote);
  const n = closes.length;
  const window = closes.slice(-Math.min(100, n));
  const mean = window.reduce((a, b) => a + b, 0) / window.length;
  const variance = window.reduce((a, b) => a + (b - mean) ** 2, 0) / window.length;
  const stdDev = Math.sqrt(variance);
  const coeffVar = mean ? (stdDev / mean) * 100 : 0;

  const first = window[0];
  const last = window[window.length - 1];
  const netMove = ((last - first) / first) * 100;

  let ups = 0;
  let downs = 0;
  for (let i = 1; i < window.length; i++) {
    if (window[i] > window[i - 1]) ups++;
    else if (window[i] < window[i - 1]) downs++;
  }
  const directionalRatio = ups / (ups + downs || 1);

  const max = Math.max(...window);
  const min = Math.min(...window);
  const range = max - min || 1;
  const positionInRange = ((last - min) / range) * 100;

  const clamp = (v) => Math.max(0, Math.min(100, Math.round(v)));

  return [
    { name: "Breakout", score: clamp(positionInRange > 85 || positionInRange < 15 ? 70 + coeffVar * 4 : 40 + coeffVar * 2) },
    { name: "Pullback", score: clamp(Math.abs(netMove) < 0.05 && directionalRatio > 0.4 && directionalRatio < 0.6 ? 60 : 45) },
    { name: "Consolidation", score: clamp(100 - coeffVar * 20) },
    { name: "Divergence", score: clamp(Math.abs(directionalRatio - 0.5) * 200) },
    { name: "Channel", score: clamp(70 - Math.abs(50 - positionInRange)) },
    { name: "Surge", score: clamp(netMove > 0 ? 50 + netMove * 15 : 30) },
    { name: "Decline", score: clamp(netMove < 0 ? 50 - netMove * 15 : 30) },
    { name: "Volatility", score: clamp(coeffVar * 25) },
  ];
}

/**
 * Produce a single strategy signal + confidence from the buffered ticks.
 * Confidence is derived from how far the observed split sits from the
 * theoretical 50/50 (or 1-in-10) baseline, scaled and capped — a larger
 * deviation on a larger sample yields higher confidence, up to a ceiling.
 */
function generateSignal(ticks, strategy, options = {}) {
  const sampleSize = ticks.length;
  if (sampleSize < 20) {
    return {
      signal: "INSUFFICIENT_DATA",
      confidence: 0,
      sampleSize,
      methodology: "Fewer than 20 buffered ticks — wait for more live data.",
    };
  }

  const confidenceFromDeviation = (pctA, pctB, cap = 92) => {
    const deviation = Math.abs(pctA - pctB); // 0-100
    const sampleFactor = Math.min(1, sampleSize / 300);
    return Math.round(Math.min(cap, 55 + deviation * 0.9 * sampleFactor));
  };

  switch (strategy) {
    case "Even/Odd": {
      const { even, odd } = evenOddSplit(ticks);
      const signal = even >= odd ? "EVEN" : "ODD";
      return {
        signal,
        confidence: confidenceFromDeviation(even, odd),
        sampleSize,
        methodology: `Even/odd split over last ${sampleSize} ticks: ${even}% even / ${odd}% odd.`,
      };
    }
    case "Over/Under": {
      const barrier = options.barrier ?? 4;
      const { over, under } = overUnderSplit(ticks, barrier);
      const signal = over >= under ? "OVER" : "UNDER";
      return {
        signal,
        confidence: confidenceFromDeviation(over, under),
        sampleSize,
        barrier,
        methodology: `Over/under ${barrier} split over last ${sampleSize} ticks: ${over}% over / ${under}% under.`,
      };
    }
    case "Matches/Differs": {
      const { digit, matches, differs } = matchesDiffersSplit(ticks, options.targetDigit);
      const signal = matches >= differs ? "MATCHES" : "DIFFERS";
      return {
        signal,
        confidence: confidenceFromDeviation(matches, differs, 80),
        sampleSize,
        targetDigit: digit,
        methodology: `Digit ${digit} matched ${matches}% of last ${sampleSize} ticks (theoretical baseline ~10%).`,
      };
    }
    case "Rise/Fall": {
      const { rise, fall } = riseFallSplit(ticks);
      const signal = rise >= fall ? "RISE" : "FALL";
      return {
        signal,
        confidence: confidenceFromDeviation(rise, fall),
        sampleSize,
        methodology: `Tick-over-tick direction over last ${sampleSize} ticks: ${rise}% rise / ${fall}% fall.`,
      };
    }
    case "Higher/Lower": {
      const barrierPrice = options.barrierPrice ?? ticks[ticks.length - 1].quote;
      let higher = 0;
      for (const t of ticks) if (t.quote > barrierPrice) higher++;
      const higherPct = Number(((higher / sampleSize) * 100).toFixed(2));
      const lowerPct = Number((100 - higherPct).toFixed(2));
      const signal = higherPct >= lowerPct ? "HIGHER" : "LOWER";
      return {
        signal,
        confidence: confidenceFromDeviation(higherPct, lowerPct),
        sampleSize,
        barrierPrice,
        methodology: `Ticks above ${barrierPrice}: ${higherPct}% vs below: ${lowerPct}% (last ${sampleSize} ticks).`,
      };
    }
    default:
      return { signal: "UNKNOWN_STRATEGY", confidence: 0, sampleSize, methodology: "Unrecognized strategy name." };
  }
}

module.exports = {
  lastDigit,
  digitDistribution,
  evenOddSplit,
  overUnderSplit,
  matchesDiffersSplit,
  riseFallSplit,
  currentStreaks,
  patternScores,
  generateSignal,
};
