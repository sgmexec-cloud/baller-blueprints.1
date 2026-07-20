const PlayStyleBadge = ({ name, isSignature }: { name: string; isSignature?: boolean }) => {
  if (!name) return null;
  const isPlus = name.includes('+');
  const isGold = isSignature || isPlus;
  
  let cleanName = name.replace('+', '');
  
  // 1. Auto-hyphenate what the AI gives us (e.g. "DeadBall" -> "dead-ball")
  let fileName = cleanName.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase().replace(/\s+/g, '-');

  // 2. OVERRIDES: Map AI names to your exact file names here if they fail to load!
  const OVERRIDES: Record<string, string> = {
    "dead-ball": "deadball",          // Fixes DeadBall -> deadball.png
    "game-changer": "gamechanger",    // Fixes GameChanger -> gamechanger.png
    "aerial-fortress": "aerial",      // The AI occasionally calls "Aerial" this by mistake
  };

  // If the auto-generated name is in our overrides list, use the override instead
  if (OVERRIDES[fileName]) {
    fileName = OVERRIDES[fileName];
  }

  // Restore the space for the text label (e.g. "Deadball" instead of "Deadball")
  if (cleanName.toLowerCase() === 'gamechanger') cleanName = 'Game Changer';
  if (cleanName.toLowerCase() === 'deadball') cleanName = 'Dead Ball';

  const imagePath = `/icons/playstyles/${fileName}${isPlus ? '-plus' : ''}.png`;

  const borderColor = isGold ? "#b45309" : "#1e3a8a"; 
  const bgColor = isGold ? "#291304" : "#0a1121";
  const textColor = isGold ? "#fcd34d" : "#93c5fd";
  const iconColor = isGold ? "#fbbf24" : "#ffffff";

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: "12px",
      padding: "12px 16px",
      borderRadius: "8px",
      border: `1px solid ${borderColor}`,
      backgroundColor: bgColor,
      color: textColor,
    }}>
      <div style={{ width: "24px", height: "24px", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <img 
          src={imagePath} 
          alt="" 
          crossOrigin="anonymous"
          style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.5))" }}
          onError={(e) => { e.currentTarget.style.display = 'none'; }} 
        />
      </div>
      <span style={{ fontSize: "16px", color: iconColor }}>
        {isGold ? '★' : '◆'}
      </span>
      <span style={{ fontSize: "14px", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "2px", fontFamily: "'Rajdhani', sans-serif" }}>
        {cleanName}{isPlus ? '+' : ''}
      </span>
    </div>
  );
};
