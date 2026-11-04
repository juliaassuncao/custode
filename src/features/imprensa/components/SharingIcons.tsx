import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

const defaults: IconProps = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
  focusable: false,
};

export function CopyLinkIcon(props: IconProps) {
  return <svg {...defaults} {...props}><path d="m9.5 14.5 5-5m-6 6-1.4 1.4a3.4 3.4 0 0 1-4.8-4.8l4.4-4.4a3.4 3.4 0 0 1 4.8 0m1 8.6a3.4 3.4 0 0 0 4.8 0l4.4-4.4a3.4 3.4 0 0 0-4.8-4.8l-1.4 1.4" /></svg>;
}

export function XIcon(props: IconProps) {
  return <svg {...defaults} {...props}><path d="M4 3h4.5L20 21h-4.5ZM4 21l6.3-7.4M20 3l-6.3 7.4" /></svg>;
}

export function FacebookIcon(props: IconProps) {
  return <svg {...defaults} {...props}><path d="M14.5 21v-8h3l.5-3.5h-3.5V7.2c0-.9.3-1.7 1.8-1.7H18V2.4c-.7-.1-1.7-.2-2.6-.2-2.8 0-4.6 1.7-4.6 4.7v2.6H8V13h2.8v8Z" /></svg>;
}

export function WhatsAppIcon(props: IconProps) {
  return <svg {...defaults} {...props}>
    <path d="M20.5 11.7a8.5 8.5 0 0 1-12.7 7.4L3 20.5l1.4-4.7a8.5 8.5 0 1 1 16.1-4.1Z" />
    <path d="m8 7 1.6 2.6-1 1.1a9.2 9.2 0 0 0 4.7 4.1l1-1.3L17 15c-.3 1.7-1.4 2.2-2.6 2-4.5-.7-7.8-4-8.4-7.4C5.8 8.4 6.4 7.4 8 7Z" strokeWidth="1.4" />
  </svg>;
}
