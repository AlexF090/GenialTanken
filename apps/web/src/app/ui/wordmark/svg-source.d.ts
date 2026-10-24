/** SVG sources imported as text (`with { loader: 'text' }`), e.g. by the wordmark's spec. */
declare module '*.svg' {
  const source: string;
  export default source;
}
