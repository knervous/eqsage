import { Box, MenuItem, Select } from '@mui/material';
import React from 'react';
import { MuiColorInput } from 'mui-color-input';

import { loadItemIcon } from '../asset-loader/util';

const invSlotMap = {
  Helm     : 'A_InvHead',
  Chest    : 'A_InvChest',
  Arms     : 'A_InvArms',
  Wrists   : 'A_InvWrist',
  Hands    : 'A_InvHands',
  Legs     : 'A_InvLegs',
  Feet     : 'A_InvFeet',
  Primary  : 'A_InvPrimary',
  Secondary: 'A_InvSecondary',
};
  
const itemIdMap = {
  Helm     : [639, 640, 550, 628],
  Chest    : [678, 632, 538, 624],
  Arms     : [670, 634, 543, 546],
  Wrists   : [638, 637, 620, 516],
  Hands    : [517, 636, 526, 531],
  Legs     : [631, 635, 540],
  Feet     : [666, 633, 545, 524],
  Primary  : [],
  Secondary: [],
};
  

function rgbaNumberToHex(rgbaNumber) {
  const r = (rgbaNumber >> 16) & 0xff;
  const g = (rgbaNumber >> 8) & 0xff;
  const b = rgbaNumber & 0xff;
  const a = (rgbaNumber >> 24) & 0xff;
  return `#${((1 << 8) + r).toString(16).slice(1)}${((1 << 8) + g)
    .toString(16)
    .slice(1)}${((1 << 8) + b).toString(16).slice(1)}${((1 << 8) + a)
      .toString(16)
      .slice(1)}`;
}
function hexToRgbaNumber(hex) {
  if (hex.startsWith('#')) {
    hex = hex.slice(1);
  }
  if (hex.length !== 8) {
    throw new Error('Invalid hex color string. Expected format: #RRGGBBAA');
  }
  
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const a = 255; // parseInt(hex.slice(6, 8), 16);
  
  return (a << 24) | (r << 16) | (g << 8) | b;
}
  

export const InventorySlot = ({ piece, props, atlas, side, setLocalConfig, localConfig, textures }) => {
  const atlasPiece = atlas[invSlotMap[piece]];
  // console.log('Piece', piece, props);
  const itemId = itemIdMap[piece][props?.texture] ?? itemIdMap[piece].at(-1);
  const wornAtlasPiece = loadItemIcon(itemId);
  return <Box sx={{ width: '65px' }}>
    <Box
      id={`${piece}-bg`}
      sx={{
        userSelect        : 'none',
        pointerEvents     : 'none',
        position          : 'absolute',
        width             : '40px',
        marginTop         : '15px',
        opacity           : 1,
        height            : '40px',
        transform         : 'scale(1.2)',
        backgroundPosition: `-${wornAtlasPiece.x}px -${wornAtlasPiece.y}px`,
        zIndex            : 10000,
        backgroundImage   : `url('/static/eqassets/images/${wornAtlasPiece?.texture}')`,
      }} />
    <Select
      autoWidth={false}
      IconComponent={null}
      MenuProps={{
        anchorOrigin: {
          vertical  : 'top',
          horizontal: side, // Align the menu to the left of the Select
        },
        transformOrigin: {
          vertical  : 'top',
          horizontal: side === 'left' ? 'right' : 'left', // Position the menu to pop out to the left
        },
        PaperProps: {
          sx: {
            padding        : 0,
            backgroundColor: 'rgba(0,0,0,0)',
          },
        },
      }}
      sx={{
        margin                              : '14px 0 !important',
        height                              : '40px',
        padding                             : 0,
        width                               : '40px',
        boxShadow                           : '2px 2px 2px 2px rgba(0,0,0,0.1)',
        backgroundImage                     : `url('/static/eqassets/images/${atlasPiece?.texture}')`,
        backgroundPosition                  : `-${atlasPiece.left}px -${atlasPiece.top}px`,
        transform                           : 'scale(1.5)',
        backgroundRepeat                    : 'no-repeat',
        '& .MuiOutlinedInput-notchedOutline': {
          border: 'none',
        },
        '*': {
          padding     : 0,
          paddingRight: '0 !important',
        },
      }}
      value={props.texture}
      onChange={(e) => {
        setLocalConfig({
          ...localConfig,
          pieces: {
            ...localConfig.pieces,
            [piece]: {
              ...localConfig.pieces[piece],
              texture: +e.target.value,
            },
          },
        });
      }}
    >
      {textures.map((idx, i) => {
        const itemId = itemIdMap[piece][i] ?? itemIdMap[piece].at(-1);
        const atlasPiece = loadItemIcon(itemId);
        return <MenuItem 
          sx={{
            position          : 'relative',
            width             : '40px',
            height            : '40px',
            margin            : '5px',
            zoom              : 1.2,
            background        : 'transparent',
            backgroundImage   : `url('/static/eqassets/images/${atlasPiece?.texture}')`,
            backgroundPosition: `-${atlasPiece.x}px -${atlasPiece.y}px`,
          }}
          value={idx} label={idx}>
                
        </MenuItem>;
      })}
    </Select>
    {/* <MuiColorInput
            size="small"
            isAlphaHidden
            format={'hex8'}
            value={rgbaNumberToHex(props.color)}
            onChange={(e) => {
              setLocalConfig({
                ...localConfig,
                pieces: {
                  ...localConfig.pieces,
                  [piece]: {
                    ...localConfig.pieces[piece],
                    color: hexToRgbaNumber(e),
                  },
                },
              });
            }}
          /> */}
  </Box>;

};