export default function typeArray(typestring, separator) {
  if (typeof typestring !== 'string') {
    throw new Error('Expected the typestring to be a string');
  }
  return typestring.split(separator).map(t => t.trim()).filter(t => t);
}
