import React from 'react';
import type { OdontogramSelection } from '../types';

interface OdontogramProps {
  value: OdontogramSelection;
  onChange?: (val: OdontogramSelection) => void;
  readOnly?: boolean;
}

export const Odontogram: React.FC<OdontogramProps> = ({ value, onChange, readOnly = false }) => {
  const upperArchRight = [18, 17, 16, 15, 14, 13, 12, 11];
  const upperArchLeft = [21, 22, 23, 24, 25, 26, 27, 28];
  const lowerArchRight = [48, 47, 46, 45, 44, 43, 42, 41];
  const lowerArchLeft = [31, 32, 33, 34, 35, 36, 37, 38];

  const handleToothClick = (tooth: number) => {
    if (readOnly || !onChange) return;
    
    let newTeeth = [...value.teeth];
    if (newTeeth.includes(tooth)) {
      newTeeth = newTeeth.filter(t => t !== tooth);
    } else {
      newTeeth.push(tooth);
    }
    
    onChange({
      ...value,
      teeth: newTeeth.sort((a, b) => a - b),
      type: 'individual'
    });
  };

  const handleQuickSelect = (type: OdontogramSelection['type']) => {
    if (readOnly || !onChange) return;

    let teeth: number[] = [];
    if (type === 'todos') {
      teeth = [...upperArchRight, ...upperArchLeft, ...lowerArchRight, ...lowerArchLeft];
    } else if (type === 'superior') {
      teeth = [...upperArchRight, ...upperArchLeft];
    } else if (type === 'inferior') {
      teeth = [...lowerArchRight, ...lowerArchLeft];
    } else if (type === 'protocolo_superior') {
      teeth = [16, 14, 12, 22, 24, 26]; // Exemplo de dentes padrão para protocolo superior
    } else if (type === 'protocolo_inferior') {
      teeth = [46, 44, 42, 32, 34, 36]; // Exemplo de dentes padrão para protocolo inferior
    }

    onChange({
      teeth: teeth.sort((a, b) => a - b),
      type
    });
  };

  const renderTooth = (tooth: number) => {
    const isSelected = value.teeth.includes(tooth);
    return (
      <button
        key={tooth}
        type="button"
        disabled={readOnly}
        onClick={() => handleToothClick(tooth)}
        className={`w-9 h-9 md:w-11 md:h-11 rounded-lg text-xs font-bold transition-all duration-300 border flex flex-col items-center justify-center ${
          isSelected
            ? 'bg-primary border-primary text-white scale-105 shadow-md shadow-primary/25'
            : 'bg-secondary/40 border-white/5 text-muted-foreground hover:bg-secondary hover:text-foreground'
        }`}
      >
        <span className="text-[10px] opacity-75">FDI</span>
        <span>{tooth}</span>
      </button>
    );
  };

  return (
    <div className="space-y-4">
      {/* Quick selection actions */}
      {!readOnly && onChange && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => handleQuickSelect('superior')}
            className="px-3 py-1.5 text-xs font-bold rounded-lg bg-secondary/80 border border-white/5 hover:bg-secondary text-foreground transition-all"
          >
            Arcada Superior
          </button>
          <button
            type="button"
            onClick={() => handleQuickSelect('inferior')}
            className="px-3 py-1.5 text-xs font-bold rounded-lg bg-secondary/80 border border-white/5 hover:bg-secondary text-foreground transition-all"
          >
            Arcada Inferior
          </button>
          <button
            type="button"
            onClick={() => handleQuickSelect('todos')}
            className="px-3 py-1.5 text-xs font-bold rounded-lg bg-secondary/80 border border-white/5 hover:bg-secondary text-foreground transition-all"
          >
            Todos os dentes
          </button>
          <button
            type="button"
            onClick={() => onChange({ teeth: [], type: 'individual' })}
            className="px-3 py-1.5 text-xs font-bold rounded-lg bg-destructive/10 border border-destructive/20 hover:bg-destructive/20 text-destructive transition-all"
          >
            Limpar
          </button>
        </div>
      )}

      {/* FDI Odontogram Grid */}
      <div className="bg-card/45 backdrop-blur-sm p-4 md:p-6 rounded-2xl border border-white/5 space-y-6">
        
        {/* Upper Arch (Superior) */}
        <div>
          <div className="text-[10px] font-extrabold uppercase tracking-widest text-primary mb-2 text-center">
            Arcada Superior
          </div>
          <div className="flex flex-col space-y-2">
            {/* Grid layout splitting Left / Right quadrants */}
            <div className="flex flex-wrap justify-center gap-1.5 md:gap-2">
              {/* Quadrant 1 (Right) */}
              <div className="flex gap-1.5 md:gap-2">
                {upperArchRight.map(renderTooth)}
              </div>
              
              {/* Divider */}
              <div className="w-0.5 bg-white/10 hidden md:block" />

              {/* Quadrant 2 (Left) */}
              <div className="flex gap-1.5 md:gap-2">
                {upperArchLeft.map(renderTooth)}
              </div>
            </div>
          </div>
        </div>

        {/* Horizontal Divider between arches */}
        <hr className="border-white/5" />

        {/* Lower Arch (Inferior) */}
        <div>
          <div className="text-[10px] font-extrabold uppercase tracking-widest text-primary mb-2 text-center">
            Arcada Inferior
          </div>
          <div className="flex flex-col space-y-2">
            <div className="flex flex-wrap justify-center gap-1.5 md:gap-2">
              {/* Quadrant 4 (Right) */}
              <div className="flex gap-1.5 md:gap-2">
                {lowerArchRight.map(renderTooth)}
              </div>
              
              {/* Divider */}
              <div className="w-0.5 bg-white/10 hidden md:block" />

              {/* Quadrant 3 (Left) */}
              <div className="flex gap-1.5 md:gap-2">
                {lowerArchLeft.map(renderTooth)}
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Selected stats summary */}
      <div className="text-xs text-muted-foreground bg-secondary/20 p-3 rounded-xl border border-white/5 flex items-center justify-between">
        <span>Elementos selecionados ({value.teeth.length}):</span>
        <span className="font-bold text-foreground">
          {value.teeth.length > 0 ? value.teeth.join(', ') : 'Nenhum dente selecionado'}
        </span>
      </div>
    </div>
  );
};
