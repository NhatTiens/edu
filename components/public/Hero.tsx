/* eslint-disable @next/next/no-img-element */
import type { BannerRow } from '@/lib/supabase/database.types';
import { validUrl } from '@/lib/cms';
export function Hero({banners}:{banners:BannerRow[]}) {
 if(!banners.length)return null;
 const main=banners[0];
 const button=(b:BannerRow)=>b.target_url&&validUrl(b.target_url,true)&&<a className="btn btn-orange" href={b.target_url} target={b.open_new_tab?'_blank':undefined} rel={b.open_new_tab?'noopener noreferrer':undefined}>{b.button_text||'Xem thêm'}</a>;
 return <section className={`hero-grid ${banners.length===1?'hero-single':''}`}><div className="surface hero-main"><div className="hero-copy stack"><h1 className="title"><strong>{main.title}</strong></h1>{main.description&&<p className="muted">{main.description}</p>}{button(main)}</div>{main.image_url&&validUrl(main.image_url)&&<img className="hero-art cms-hero-image" src={main.image_url} alt={main.title}/>}</div>{banners.length>1&&<div className="hero-side">{banners.slice(1).map((b,i)=><div key={b.id} className={`surface hero-side-card ${i%2?'orange':'blue'}`}>{b.image_url&&validUrl(b.image_url)&&<img className="cms-banner-image" src={b.image_url} alt={b.title}/>}<h3>{b.title}</h3><p className="small">{b.description}</p>{button(b)}</div>)}</div>}</section>;
}

