const loadAtlasItem =
  (prefix, padStart, base, gridItems, columns, cellSize) => (id) => {
    const itemId = id - base;
    const fileIndex = Math.floor(itemId / gridItems) + 1;

    const spriteIndex = itemId % gridItems;

    const row = Math.floor(spriteIndex / columns);
    const col = spriteIndex % columns;

    const x = row * cellSize;
    const y = col * cellSize;

    return {
      texture: `${prefix}${fileIndex.toString().padStart(padStart, '0')}.png`,
      x,
      y,
      cellSize
    };
  };

export const loadItemIcon = loadAtlasItem('dragitem', 0, 500, 36, 6, 40);
export const loadSpellIcon = loadAtlasItem('Spells', 2, 0, 36, 6, 40);
export const loadGemIcon = loadAtlasItem('gemicons', 2, 0, 100, 10, 24);

