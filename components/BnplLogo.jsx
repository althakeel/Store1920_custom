import Image from 'next/image';
import { tabbyLogo, tamaraLogo } from '@/lib/bnplAssets';

const SIZE_MAP = {
  sm: { height: 18, width: 54, className: 'h-[18px] w-auto' },
  md: { height: 22, width: 66, className: 'h-[22px] w-auto' },
  lg: { height: 28, width: 84, className: 'h-[28px] w-auto' },
  checkout: { height: 24, width: 72, className: 'h-6 w-auto' },
  button: { height: 28, width: 88, className: 'h-7 w-auto' },
};

export default function BnplLogo({ provider = 'tabby', size = 'md', className = '' }) {
  const logo = provider === 'tamara' ? tamaraLogo : tabbyLogo;
  const alt = provider === 'tamara' ? 'Tamara' : 'Tabby';
  const config = SIZE_MAP[size] || SIZE_MAP.md;

  return (
    <Image
      src={logo}
      alt={alt}
      width={config.width}
      height={config.height}
      className={`${config.className} shrink-0 object-contain ${className}`.trim()}
    />
  );
}
