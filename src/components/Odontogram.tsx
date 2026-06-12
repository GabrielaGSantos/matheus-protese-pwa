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
      teeth = [16, 14, 12, 22, 24, 26];
    } else if (type === 'protocolo_inferior') {
      teeth = [46, 44, 42, 32, 34, 36];
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
        className={`w-9 h-9 md:w-10 md:h-10 rounded-lg text-xs font-semibold transition-all border flex items-center justify-center ${
          isSelected
            ? 'bg-[#0F766E] border-[#0F766E] text-white shadow-sm'
            : 'bg-white border-[#E2E8F0] text-slate-500 hover:bg-slate-50 hover:text-slate-700 hover:border-slate-300'
        }`}
      >
        {tooth}
      </button>
    );
  };

  return (
    <div className="space-y-3">
      {/* Quick selection actions */}
      {!readOnly && onChange && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => handleQuickSelect('superior')}
            className="px-3 py-1.5 text-[10px] font-semibold rounded-lg bg-white border border-[#E2E8F0] text-slate-600 hover:bg-slate-50 transition-all"
          >
            Arcada Superior
          </button>
          <button
            type="button"
            onClick={() => handleQuickSelect('inferior')}
            className="px-3 py-1.5 text-[10px] font-semibold rounded-lg bg-white border border-[#E2E8F0] text-slate-600 hover:bg-slate-50 transition-all"
          >
            Arcada Inferior
          </button>
          <button
            type="button"
            onClick={() => handleQuickSelect('todos')}
            className="px-3 py-1.5 text-[10px] font-semibold rounded-lg bg-white border border-[#E2E8F0] text-slate-600 hover:bg-slate-50 transition-all"
          >
            Todos os dentes
          </button>
          <button
            type="button"
            onClick={() => onChange({ teeth: [], type: 'individual' })}
            className="px-3 py-1.5 text-[10px] font-semibold rounded-lg bg-white border border-[#E2E8F0] text-rose-600 hover:bg-rose-50 hover:border-rose-200 transition-all"
          >
            Limpar
          </button>
        </div>
      )}

      {/* FDI Odontogram Grid */}
      <div className="bg-white p-4 md:p-5 rounded-xl border border-[#E2E8F0] space-y-4">
        
        {/* Upper Arch (Superior) */}
        <div>
          <div className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-2 text-center">
            Arcada Superior
          </div>
          <div className="flex flex-col space-y-2">
            <div className="flex flex-wrap justify-center gap-1.5 md:gap-2">
              <div className="flex gap-1.5 md:gap-2">
                {upperArchRight.map(renderTooth)}
              </div>
              
              <div className="w-px bg-[#E2E8F0] hidden md:block" />

              <div className="flex gap-1.5 md:gap-2">
                {upperArchLeft.map(renderTooth)}
              </div>
            </div>
          </div>
        </div>

        {/* Horizontal Divider between arches */}
        <hr className="border-[#E2E8F0]" />

        {/* Lower Arch (Inferior) */}
        <div>
          <div className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-2 text-center">
            Arcada Inferior
          </div>
          <div className="flex flex-col space-y-2">
            <div className="flex flex-wrap justify-center gap-1.5 md:gap-2">
              <div className="flex gap-1.5 md:gap-2">
                {lowerArchRight.map(renderTooth)}
              </div>
              
              <div className="w-px bg-[#E2E8F0] hidden md:block" />

              <div className="flex gap-1.5 md:gap-2">
                {lowerArchLeft.map(renderTooth)}
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Selected stats summary */}
      <div className="text-xs text-slate-500 bg-slate-50 p-3 rounded-lg border border-[#E2E8F0] flex items-center justify-between">
        <span>Elementos selecionados ({value.teeth.length}):</span>
        <span className="font-semibold text-slate-700">
          {value.teeth.length > 0 ? value.teeth.join(', ') : 'Nenhum dente selecionado'}
        </span>
      </div>
    </div>
  );
};
