import React from 'react';

interface PlayStyleBadgeProps {
  playstyle: string;
}

// Converts "PowerShot+" to "power-shot" and "LongBallPass" to "long-ball-pass"
const formatFileName = (name: string) => {
  const cleanName = name.replace('+', '');
  return cleanName
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase();
};

export const PlayStyleBadge: React.FC<PlayStyleBadgeProps> = ({ playstyle }) => {
  const isPlus = playstyle.endsWith('+');
  const fileName = formatFileName(playstyle);
  
  // Maps to your public/icons/playstyles/ folder
  const imagePath = `/icons/playstyles/${fileName}${isPlus ? '-plus' : ''}.svg`;

  return (
    <div 
      className={`flex items-center gap-2 px-3 py-1.5 rounded-md shadow-sm border 
      ${isPlus 
        ? 'bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-amber-500/30' 
        : 'bg-slate-800/50 border-slate-700/50'
      }`}
    >
      <img 
        src={imagePath} 
        alt={`${playstyle} icon`} 
        className="w-6 h-6 object-contain drop-shadow-md"
        onError={(e) => {
           // Prevents broken images if you miss a download
           e.currentTarget.src = '/icons/playstyles/fallback.svg'; 
        }}
      />
      <span 
        className={`text-sm font-bold tracking-wide
        ${isPlus 
          ? 'bg-clip-text text-transparent bg-gradient-to-r from-amber-300 to-orange-400' 
          : 'text-slate-200'
        }`}
      >
        {playstyle.replace('+', ' +')}
      </span>
    </div>
  );
};
