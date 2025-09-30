'use client';

import { useState } from 'react';

interface SuggestionsLimitSliderProps {
  defaultValue: number;
}

export function SuggestionsLimitSlider({ defaultValue }: SuggestionsLimitSliderProps) {
  const [value, setValue] = useState(defaultValue);

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium">Suggestions Limit</label>
      <div className="flex items-center gap-3">
        <input
          type="range"
          name="suggestionsLimit"
          value={value}
          onChange={(e) => setValue(Number(e.target.value))}
          min="1"
          max="5"
          className="w-32"
        />
        <span className="text-sm font-medium w-8 text-center">
          {value}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        Number of suggestions to generate and display (1-5, default 3)
      </p>
    </div>
  );
}
