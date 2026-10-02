import React, { useState, useMemo } from 'react';

// Extracted PlayStyle Definitions with Requirements
const PLAYSTYLES = [
  { id: 'finesse_shot', name: 'Finesse Shot', category: 'scoring', requirements: [{ attr: 'vision', min: 80 }, { attr: 'finishing', min: 75 }, { attr: 'curve', min: 80 }] },
  { id: 'chip_shot', name: 'Chip Shot', category: 'scoring', requirements: [{ attr: 'reactions', min: 75 }, { attr: 'composure', min: 80 }, { attr: 'ball_control', min: 80 }] },
  { id: 'power_shot', name: 'Power Shot', category: 'scoring', requirements: [{ attr: 'finishing', min: 80 }, { attr: 'shot_power', min: 75 }, { attr: 'long_shots', min: 80 }] },
  { id: 'dead_ball', name: 'Dead Ball', category: 'scoring', requirements: [{ attr: 'crossing', min: 80 }, { attr: 'fk_accuracy', min: 75 }, { attr: 'shot_power', min: 80 }] },
  { id: 'precision_header', name: 'Precision Header', category: 'scoring', requirements: [{ attr: 'jumping', min: 80 }, { attr: 'strength', min: 80 }, { attr: 'heading_acc', min: 75 }] },
  { id: 'acrobatic', name: 'Acrobatic', category: 'scoring', requirements: [{ attr: 'agility', min: 80 }, { attr: 'reactions', min: 80 }, { attr: 'volleys', min: 75 }] },
  { id: 'low_driven_shot', name: 'Low Driven Shot', category: 'scoring', requirements: [{ attr: 'composure', min: 80 }, { attr: 'finishing', min: 75 }, { attr: 'shot_power', min: 80 }] },
  { id: 'game_changer', name: 'Game Changer', category: 'scoring', requirements: [{ attr: 'composure', min: 80 }, { attr: 'finishing', min: 75 }, { attr: 'curve', min: 80 }] },
  { id: 'incisive_pass', name: 'Incisive Pass', category: 'passing', requirements: [{ attr: 'vision', min: 75 }, { attr: 'long_passing', min: 80 }, { attr: 'curve', min: 80 }] },
  { id: 'pinged_pass', name: 'Pinged Pass', category: 'passing', requirements: [{ attr: 'long_passing', min: 85 }, { attr: 'short_passing', min: 80 }] },
  { id: 'long_ball_pass', name: 'Long Ball Pass', category: 'passing', requirements: [{ attr: 'vision', min: 85 }, { attr: 'long_passing', min: 80 }] },
  { id: 'tiki_taka', name: 'Tiki Taka', category: 'passing', requirements: [{ attr: 'reactions', min: 80 }, { attr: 'ball_control', min: 80 }, { attr: 'short_passing', min: 75 }] },
  { id: 'whipped_pass', name: 'Whipped Pass', category: 'passing', requirements: [{ attr: 'crossing', min: 80 }, { attr: 'long_passing', min: 75 }] },
  { id: 'inventive', name: 'Inventive', category: 'passing', requirements: [{ attr: 'composure', min: 80 }, { attr: 'long_passing', min: 75 }, { attr: 'curve', min: 80 }] },
  { id: 'technical', name: 'Technical', category: 'ball_control', requirements: [{ attr: 'balance', min: 80 }, { attr: 'ball_control', min: 75 }, { attr: 'dribbling', min: 80 }] },
  { id: 'rapid', name: 'Rapid', category: 'ball_control', requirements: [{ attr: 'acceleration', min: 75 }, { attr: 'sprint_speed', min: 80 }, { attr: 'dribbling', min: 80 }] },
  { id: 'first_touch', name: 'First Touch', category: 'ball_control', requirements: [{ attr: 'composure', min: 80 }, { attr: 'ball_control', min: 75 }] },
  { id: 'trickster', name: 'Trickster', category: 'ball_control', requirements: [{ attr: 'acceleration', min: 80 }, { attr: 'agility', min: 75 }, { attr: 'dribbling', min: 80 }] },
  { id: 'press_proven', name: 'Press Proven', category: 'ball_control', requirements: [{ attr: 'strength', min: 75 }, { attr: 'composure', min: 80 }, { attr: 'ball_control', min: 80 }] },
  { id: 'jockey', name: 'Jockey', category: 'defending', requirements: [{ attr: 'agility', min: 75 }, { attr: 'def_aware', min: 80 }, { attr: 'standing_tackle', min: 80 }] },
  { id: 'block', name: 'Block', category: 'defending', requirements: [{ attr: 'agility', min: 80 }, { attr: 'strength', min: 75 }, { attr: 'reactions', min: 80 }] },
  { id: 'intercept', name: 'Intercept', category: 'defending', requirements: [{ attr: 'aggression', min: 80 }, { attr: 'interceptions', min: 80 }] },
  { id: 'anticipate', name: 'Anticipate', category: 'defending', requirements: [{ attr: 'balance', min: 80 }, { attr: 'def_aware', min: 75 }, { attr: 'standing_tackle', min: 80 }] },
  { id: 'slide_tackle', name: 'Slide Tackle', category: 'defending', requirements: [{ attr: 'aggression', min: 80 }, { attr: 'sliding_tackle', min: 75 }] },
  { id: 'aerial', name: 'Aerial', category: 'defending', requirements: [{ attr: 'jumping', min: 75 }, { attr: 'heading_acc', min: 75 }] },
  { id: 'quick_step', name: 'Quick Step', category: 'physical', requirements: [{ attr: 'acceleration', min: 75 }, { attr: 'sprint_speed', min: 80 }, { attr: 'stamina', min: 80 }] },
  { id: 'relentless', name: 'Relentless', category: 'physical', requirements: [{ attr: 'agility', min: 80 }, { attr: 'stamina', min: 80 }] },
  { id: 'long_throw', name: 'Long Throw', category: 'physical', requirements: [{ attr: 'strength', min: 80 }, { attr: 'stamina', min: 75 }] },
  { id: 'bruiser', name: 'Bruiser', category: 'physical', requirements: [{ attr: 'strength', min: 75 }, { attr: 'aggression', min: 80 }, { attr: 'def_aware', min: 80 }] },
  { id: 'enforcer', name: 'Enforcer', category: 'physical', requirements: [{ attr: 'balance', min: 80 }, { attr: 'strength', min: 75 }, { attr: 'ball_control', min: 80 }] },
  { id: 'gk_far_throw', name: 'GK Far Throw', category: 'goalkeeping', requirements: [{ attr: 'vision', min: 75 }, { attr: 'long_passing', min: 75 }, { attr: 'gk_kicking', min: 80 }] },
  { id: 'gk_footwork', name: 'GK Footwork', category: 'goalkeeping', requirements: [{ attr: 'agility', min: 80 }, { attr: 'balance', min: 80 }, { attr: 'gk_reflexes', min: 75 }] },
  { id: 'gk_cross_claimer', name: 'GK Cross Claimer', category: 'goalkeeping', requirements: [{ attr: 'jumping', min: 80 }, { attr: 'strength', min: 80 }, { attr: 'gk_positioning', min: 75 }] },
  { id: 'gk_rush_out', name: 'GK Rush Out', category: 'goalkeeping', requirements: [{ attr: 'acceleration', min: 80 }, { attr: 'agility', min: 75 }, { attr: 'aggression', min: 80 }] },
  { id: 'gk_far_reach', name: 'GK Far Reach', category: 'goalkeeping', requirements: [{ attr: 'agility', min: 80 }, { attr: 'reactions', min: 80 }, { attr: 'gk_diving', min: 75 }] },
  { id: 'gk_deflector', name: 'GK Deflector', category: 'goalkeeping', requirements: [{ attr: 'strength', min: 75 }, { attr: 'gk_diving', min: 80 }, { attr: 'gk_reflexes', min: 75 }] }
];

// Helper to check if a PlayStyle is unlocked based on current user stats
const isPlaystyleUnlocked = (playstyle, userStats) => {
  return playstyle.requirements.every(req => (userStats[req.attr] || 0) >= req.min);
};

export default function ManualBuilder({ userStats, equippedPlaystyles, onTogglePlaystyle }) {
  const [activeCategory, setActiveCategory] = useState('all');

  const filteredPlaystyles = useMemo(() => {
    if (activeCategory === 'all') return PLAYSTYLES;
    return PLAYSTYLES.filter(ps => ps.category === activeCategory);
  }, [activeCategory]);

  return (
    <div className="manual-builder-container p-6 bg-gray-900 text-white rounded-lg shadow-xl">
      <h2 className="text-2xl font-bold mb-4">PlayStyle Configuration</h2>
      
      {/* Category Filters */}
      <div className="flex gap-2 mb-6 overflow-x-auto">
        {['all', 'scoring', 'passing', 'ball_control', 'defending', 'physical', 'goalkeeping'].map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-4 py-2 rounded-md font-semibold capitalize transition-colors ${
              activeCategory === cat ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {cat.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* PlayStyles Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredPlaystyles.map(ps => {
          const unlocked = isPlaystyleUnlocked(ps, userStats);
          const equipped = equippedPlaystyles.includes(ps.id);

          return (
            <div 
              key={ps.id} 
              className={`p-4 border rounded-lg transition-all ${
                unlocked 
                  ? equipped ? 'border-green-500 bg-green-900/20' : 'border-gray-600 bg-gray-800' 
                  : 'border-red-900/50 bg-red-900/10 opacity-75'
              }`}
            >
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-bold text-lg">{ps.name}</h3>
                {unlocked ? (
                  <button 
                    onClick={() => onTogglePlaystyle(ps.id)}
                    className={`px-3 py-1 text-sm rounded ${equipped ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}
                  >
                    {equipped ? 'Remove' : 'Equip'}
                  </button>
                ) : (
                  <span className="text-xs font-bold text-red-400 uppercase tracking-wider">Locked</span>
                )}
              </div>
              
              <div className="space-y-1">
                <p className="text-xs text-gray-400 mb-2 uppercase tracking-wide">Requirements:</p>
                {ps.requirements.map((req, idx) => {
                  const currentVal = userStats[req.attr] || 0;
                  const reqMet = currentVal >= req.min;
                  
                  return (
                    <div key={idx} className="flex justify-between text-sm">
                      <span className="capitalize">{req.attr.replace('_', ' ')}</span>
                      <span className={reqMet ? 'text-green-400' : 'text-red-400'}>
                        {currentVal} / {req.min}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
