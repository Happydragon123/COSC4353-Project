export function estimateWaitMinutes(position, expectedDuration) {
  if (!Number.isSafeInteger(position) || position < 1) {
    throw new TypeError('Position must be a positive integer.');
  }

  if (
    typeof expectedDuration !== 'number' ||
    !Number.isFinite(expectedDuration) ||
    expectedDuration <= 0
  ) {
    throw new TypeError('Expected duration must be a positive finite number.');
  }

  const minutes = (position - 1) * expectedDuration;
  if (!Number.isFinite(minutes)) {
    throw new RangeError('Estimated wait exceeds the supported numeric range.');
  }

  return Math.ceil(minutes);
}
