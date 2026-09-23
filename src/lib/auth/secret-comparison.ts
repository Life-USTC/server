async function sha256(value: string) {
  return new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
  );
}

/**
 * Compare two secrets without an early return or a length-dependent branch.
 * Hashing first gives both inputs the same fixed-size representation, so a
 * missing/short/long candidate does not create a timing distinction.
 */
export async function timingSafeSecretEqual(
  candidate: string,
  expected: string,
) {
  const [candidateDigest, expectedDigest] = await Promise.all([
    sha256(candidate),
    sha256(expected),
  ]);
  let difference = candidateDigest.length ^ expectedDigest.length;
  for (let index = 0; index < expectedDigest.length; index += 1) {
    difference |= candidateDigest[index] ^ expectedDigest[index];
  }
  return difference === 0;
}
