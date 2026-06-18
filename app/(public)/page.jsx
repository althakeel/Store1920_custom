import { getHomepageData } from '@/lib/homepageData';
import HomePageClient from './HomePageClient';

export const revalidate = 120;

export default async function Home() {
  const initialData = await getHomepageData('en');
  return <HomePageClient initialData={initialData} />;
}
