import React from "react";

export const ImageIcon = ({ className }: { className?: string }) => (
  <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="24" height="24" rx="6" fill="#E6EFFF" />
    <path d="M17 15V9C17 7.89543 16.1046 7 15 7H9C7.89543 7 7 7.89543 7 9V15C7 16.1046 7.89543 17 9 17H15C16.1046 17 17 16.1046 17 15Z" fill="#3561FF" fillOpacity="0.1"/>
    <path d="M7 14L10.5 10L13.5 13.5L17 10.5V15C17 16.1046 16.1046 17 15 17H9C7.89543 17 7 16.1046 7 15V14Z" fill="#3561FF" />
    <circle cx="10" cy="10" r="1" fill="#3561FF" />
  </svg>
);

export const CheckIcon = ({ className }: { className?: string }) => (
  <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="12" fill="#E3F7EB" />
    <path d="M7.5 12L10.5 15L16.5 9" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const ClockIcon = ({ className }: { className?: string }) => (
  <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="12" fill="#FEF3C7" />
    <path d="M12 7V12L15 15" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const StackIcon = ({ className }: { className?: string }) => (
  <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="12" fill="#F3E8FF" />
    <path d="M7 14L12 16.5L17 14" stroke="#8B5CF6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M7 11L12 13.5L17 11" stroke="#8B5CF6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M7 8L12 10.5L17 8L12 5.5L7 8Z" stroke="#8B5CF6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const PieChartIcon = ({ className }: { className?: string }) => (
  <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="12" fill="#CCFBF1" />
    <path d="M12 6V12L16.2426 16.2426" stroke="#14B8A6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M12 6C15.3137 6 18 8.68629 18 12C18 13.6569 17.3284 15.1569 16.2426 16.2426" stroke="#14B8A6" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

export const FileIcon = ({ className }: { className?: string }) => (
  <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="12" fill="#FEE2E2" />
    <path d="M9 7H13.5L16 9.5V17C16 17.5523 15.5523 18 15 18H9C8.44772 18 8 17.5523 8 17V8C8 7.44772 8.44772 7 9 7Z" stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M13 7V10H16" stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const LightningIcon = ({ className }: { className?: string }) => (
  <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
  </svg>
);

export const HourglassIcon = ({ className }: { className?: string }) => (
  <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 12c-2.2 0-4-1.8-4-4V5h8v3c0 2.2-1.8 4-4 4Z" />
    <path d="M12 12c2.2 0 4 1.8 4 4v3H8v-3c0-2.2 1.8-4 4-4Z" />
    <line x1="6" y1="5" x2="18" y2="5" />
    <line x1="6" y1="19" x2="18" y2="19" />
  </svg>
);

export const RefreshIcon = ({ className }: { className?: string }) => (
  <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
  </svg>
);

export const GearIcon = ({ className }: { className?: string }) => (
  <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1Z" />
  </svg>
);

export const XIcon = ({ className }: { className?: string }) => (
  <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="12" fill="#FEE2E2" />
    <path d="M15 9L9 15" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M9 9L15 15" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
