import { getHomepageData } from '@/lib/homepageData';
import HomePageClient from './HomePageClient';

export const revalidate = 60;

export default async function Home() {
  const initialData = await getHomepageData('en');
  return <HomePageClient initialData={initialData} />;
}
