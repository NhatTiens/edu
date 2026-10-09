import { redirect } from 'next/navigation';
export default async function Page({params}:{params:Promise<{slug:string}>}){redirect(`/q/${(await params).slug}`);}
