// Vite replaces BASE_URL for both root sites and /repository/ project sites.
export function assetPath(path:string){return import.meta.env.BASE_URL+path.replace(/^\/+/, '');}
