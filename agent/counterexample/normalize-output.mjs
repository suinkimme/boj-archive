function normalizeNewlines(text) {
  return String(text ?? '').replace(/\r\n?/g, '\n');
}

export function normalizeOutput(output, mode = 'tokens') {
  const text = normalizeNewlines(output);

  if (mode === 'tokens') {
    const trimmed = text.trim();
    const tokens = trimmed === '' ? [] : trimmed.split(/\s+/);
    return {
      mode,
      value: tokens,
      display: tokens.join('\n'),
    };
  }

  if (mode === 'text') {
    return {
      mode,
      value: text,
      display: text,
    };
  }

  throw new Error(`unknown compare mode: ${mode}`);
}

export function outputsEqual(expected, actual, mode = 'tokens') {
  const normalizedExpected = normalizeOutput(expected, mode);
  const normalizedActual = normalizeOutput(actual, mode);

  if (mode === 'tokens') {
    if (normalizedExpected.value.length !== normalizedActual.value.length) {
      return {
        equal: false,
        normalizedExpected,
        normalizedActual,
      };
    }

    for (let i = 0; i < normalizedExpected.value.length; i += 1) {
      if (normalizedExpected.value[i] !== normalizedActual.value[i]) {
        return {
          equal: false,
          normalizedExpected,
          normalizedActual,
        };
      }
    }

    return {
      equal: true,
      normalizedExpected,
      normalizedActual,
    };
  }

  return {
    equal: normalizedExpected.value === normalizedActual.value,
    normalizedExpected,
    normalizedActual,
  };
}
