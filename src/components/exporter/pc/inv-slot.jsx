import { Box, IconButton, Typography, TextField } from '@mui/material';
import React, { useCallback, useRef, useState } from 'react';
import ClearIcon from '@mui/icons-material/Clear';
import { loadItemIcon } from '../asset-loader/util';
import { useSettingsContext } from '@/context/settings';
import { ItemSearch } from './item-search';
import { MuiColorInput } from 'mui-color-input';
import { useDebouncedCallback } from 'use-debounce';

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

function hexToRgbaNumber(hex) {
  if (hex.startsWith('#')) {
    hex = hex.slice(1);
  }

  if (hex.length !== 6) {
    throw new Error('Invalid hex color format. Expected format: "#rrggbb".');
  }

  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  const a = 255;
  return ((a << 24) | (r << 16) | (g << 8) | b) >>> 0;
}

function rgbaNumberToHex(rgbaNumber) {
  const r = (rgbaNumber >> 16) & 0xff;
  const g = (rgbaNumber >> 8) & 0xff;
  const b = rgbaNumber & 0xff;
  return `#${((1 << 8) + r).toString(16).slice(1)}${((1 << 8) + g)
    .toString(16)
    .slice(1)}${((1 << 8) + b).toString(16).slice(1)}`;
}

export const InventorySlot = ({ piece, atlas, noTint = false, options }) => {
  const { config, selectedModel, setOption } = useSettingsContext();
  const popupRef = useRef(null);
  const [popupOpen, setPopupOpen] = useState(false);
  const props = config.pieces[piece];
  const atlasPiece = atlas[invSlotMap[piece]];
  const wornAtlasPiece = loadItemIcon(props?.icon);
  const onSelect = useCallback(
    (item) => {
      setPopupOpen(false);
      setOption('config', {
        ...config,
        pieces: {
          ...config.pieces,
          [piece]: {
            name   : item.name,
            icon   : item.icon,
            idfile : item.idfile,
            texture: item.material ?? 0,
            model  : item.model,
            color  : item.color === 4278190080 ? hexToRgbaNumber('#FFFFFF') : item.color,
          },
        },
      });
    },
    [config, piece, setOption]
  );
  const debouncedColorChange = useDebouncedCallback((value) => {
    setOption('config', {
      ...config,
      pieces: {
        ...config.pieces,
        [piece]: {
          ...config.pieces[piece],

          color: hexToRgbaNumber(value),
        },
      },
    });
  }, 100);
  const togglePopup = useCallback(() => {
    if (popupOpen) {
      setPopupOpen(false);
      return;
    }
    setPopupOpen(true);
    setTimeout(() => {
      console.log('Hi ref', popupRef.current);
      popupRef.current?.querySelector('input')?.focus();
    }, 50);
    const clickHandler = (e) => {
      if (!e.target.contains(popupRef.current)) {
        setPopupOpen(false);
      }
    };

    document.addEventListener('click', clickHandler);

    return () => {
      document.removeEventListener('click', clickHandler);
    };
  }, [popupOpen]);
  return (
    <Box
      title={piece}
      onClick={togglePopup}
      sx={{
        position          : 'relative',
        height            : '40px',
        width             : '40px',
        boxShadow         : '2px 2px 2px 2px rgba(0,0,0,0.1)',
        margin            : '3px',
        zoom              : 1.4,
        backgroundImage   : `url('/static/eqassets/images/${atlasPiece?.texture}')`,
        backgroundPosition: `-${atlasPiece.left}px -${atlasPiece.top}px`,
      }}
    >
      {props?.icon !== undefined ? (
        <>
          <Box
            id={`${piece}-bg`}
            sx={{
              position          : 'absolute',
              userSelect        : 'none',
              pointerEvents     : 'none',
              width             : '40px',
              height            : '40px',
              zoom              : 0.8,
              marginLeft        : '10%',
              marginTop         : '10%',
              backgroundPosition: `-${wornAtlasPiece.x}px -${wornAtlasPiece.y}px`,
              backgroundImage   : `url('/static/eqassets/images/${wornAtlasPiece?.texture}')`,
            }}
          />
          <Box
            sx={{
              position: 'absolute',
              left    : '33px',
              top     : '-9px',
              width   : '8px',
              height  : '8px',
            }}
          >
            <IconButton
              onClick={() => {
                setOption('config', {
                  ...config,
                  pieces: {
                    ...config.pieces,
                    [piece]: {
                      texture: 0,
                    },
                  },
                });
              }}
              sx={{
                borderRadius: '1px',
                background  : 'rgba(0, 0, 0, 0.4)',
                width       : '8px',
                height      : '8px',
                padding     : 0,
              }}
              size="small"
            >
              <ClearIcon
                sx={{
                  color : 'rgba(255, 255, 255, 0.6)',
                  width : '8px',
                  height: '8px',
                }}
              />
            </IconButton>
          </Box>
          {noTint ? null : (
            <Box
              sx={{
                position: 'absolute',
                left    : '0px',
                top     : '-10px',
              }}
            >
              <input
                onClick={(e) => {
                  e.stopPropagation();
                }}
                style={{
                  background: rgbaNumberToHex(props.color),
                  opacity   : 0.8,
                }}
                className="item-color"
                type="color"
                onChange={(e) => debouncedColorChange(e.target.value)}
                value={rgbaNumberToHex(props.color)}
              />
            </Box>
          )}
        </>
      ) : null}

      {popupOpen ? (
        <Box
          ref={popupRef}
          className="item-search"
          onClick={(e) => e.stopPropagation()}
          sx={{}}
        >
          <ItemSearch
            onClose={() => {
              setPopupOpen(false);
            }}
            onSelect={onSelect}
            baseOptions={options}
            piece={piece}
            label={props?.name ?? `Search ${piece}`}
          />
        </Box>
      ) : null}
    </Box>
  );
};
