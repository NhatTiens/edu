import 'server-only';
export function siteOrigin(){
 const configured=process.env.NEXT_PUBLIC_SITE_URL;if(!configured)throw new Error('SITE_ORIGIN_REQUIRED');
 const u=new URL(configured);if(u.username||u.password||u.pathname!=='/'||u.search||u.hash||!['https:','http:'].includes(u.protocol))throw new Error('INVALID_SITE_ORIGIN');
 if(u.protocol!=='https:'&&!['localhost','127.0.0.1','[::1]'].includes(u.hostname))throw new Error('HTTPS_REQUIRED');return u.origin;
}
