import type { NextConfig } from 'next';
const nextConfig: NextConfig = {
 experimental:{serverActions:{bodySizeLimit:'6mb'}},
 async headers(){return [
 {source:'/(.*)',headers:[
 {key:'X-Content-Type-Options',value:'nosniff'},
 {key:'X-Frame-Options',value:'DENY'},
 {key:'Referrer-Policy',value:'no-referrer'},
 {key:'Permissions-Policy',value:'camera=(), microphone=(), geolocation=()'},
 {key:'Content-Security-Policy',value:"object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'; frame-src https://www.youtube-nocookie.com"}
 ]},
 {source:'/admin/:path*',headers:[{key:'Cache-Control',value:'private, no-store'}]},
 {source:'/q/:path*',headers:[{key:'Cache-Control',value:'private, no-store'}]}
 ];}
};
export default nextConfig;
