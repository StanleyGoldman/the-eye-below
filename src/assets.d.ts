// Files the bundler turns into strings.

declare module "*.css" {
  const text: string;
  export default text;
}

declare module "*.woff2" {
  const dataUrl: string;
  export default dataUrl;
}
