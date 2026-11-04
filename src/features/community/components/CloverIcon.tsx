import { useId } from 'react';

export function CloverIcon() {
  const maskId = useId();
  // Exact leaves and engraved gleams from public/custode-trevo.svg; only the stem is omitted.
  return <svg className="community-clover-icon" width="58" height="58" viewBox="20 0 360 350" aria-hidden="true" focusable="false">
    <defs><mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="400" height="510" stroke="none">
      <rect width="400" height="510" fill="white" />
      <path d="M190 176 L161 140 L185 172 Z" fill="black" />
      <path d="M210 176 L239 140 L215 172 Z" fill="black" />
      <path d="M190 200 L162 232 L185 203 Z" fill="black" />
      <path d="M210 200 L238 232 L215 203 Z" fill="black" />
    </mask></defs>
    <g mask={`url(#${maskId})`}>
      <path d="M194 177 C148 177 104 171 72 165 C36 158 25 127 36 100 C49 69 77 63 103 73 C94 51 106 20 130 14 C160 6 189 31 194 70 Z" />
      <path d="M206 177 C252 177 296 171 328 165 C364 158 375 127 364 100 C351 69 323 63 297 73 C306 51 294 20 270 14 C240 6 211 31 206 70 Z" />
      <path d="M193 192 C153 189 111 190 75 193 C41 195 30 226 37 253 C45 284 66 294 102 288 C97 311 112 339 135 340 C166 342 187 300 193 263 Z" />
      <path d="M207 192 C247 189 289 190 325 193 C359 195 370 226 363 253 C355 284 334 294 298 288 C303 311 288 339 265 340 C234 342 213 300 207 263 Z" />
    </g>
  </svg>;
}
