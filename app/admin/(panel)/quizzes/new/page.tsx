import { QuizEditor } from '@/components/admin/QuizEditor';
import { cmsClient } from '@/lib/repositories/cms';
export default async function Page(){await cmsClient();return <QuizEditor/>;}
