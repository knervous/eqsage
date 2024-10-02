import React, { useEffect, useState } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { MuiColorInput } from 'mui-color-input';

const PropertyType = {
  NUMBER: 0,
  STRING: 2,
  COLOR : 3,
};
function rgbaToNumber(r, g, b, a) {
  return (
    ((a & 0xff) << 24) | ((r & 0xff) << 16) | ((g & 0xff) << 8) | (b & 0xff)
  );
}

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
  const a = parseInt(hex.slice(6, 8), 16);

  return (a << 24) | (r << 16) | (g << 8) | b;
}
const ShaderList = {
  Basic: {
    shader     : 'Opaque_MaxC1.fx',
    description: 'Generic texture',
    properties : {
      e_TextureDiffuse0: {
        type    : PropertyType.STRING,
        value   : 'Material Texture',
        disabled: true,
      },
    },
  },
  Glow: {
    shader     : 'Opaque_MaxCBSG1.fx',
    description: 'Glow texture',
    properties : {
      e_TextureDiffuse0: {
        type    : PropertyType.STRING,
        value   : 'Material Texture',
        disabled: true,
      },
      e_TextureGlow0: {
        type    : PropertyType.STRING,
        value   : 'Glow Texture',
        disabled: true,
      },
      e_fShininess0: {
        type : PropertyType.NUMBER,
        value: 50,
      },
    },
  },
  Water: {
    shader     : 'Opaque_MaxWater.fx',
    description: 'Water',
    properties : {
      e_TextureDiffuse0: {
        type    : PropertyType.STRING,
        value   : 'Material Texture',
        disabled: true,
      },
      e_TextureNormal0: {
        type    : PropertyType.STRING,
        value   : 'Normal Texture',
        disabled: true,
      },
      e_TextureEnvironment0: {
        type    : PropertyType.STRING,
        value   : 'Environment Texture',
        disabled: true,
      },
      e_fFresnelBias: {
        type : PropertyType.NUMBER,
        value: 0.11,
      },
      e_fFresnelPower: {
        type : PropertyType.NUMBER,
        value: 8,
      },
      e_fWaterColor1: {
        type : PropertyType.COLOR,
        value: rgbaToNumber(255, 0, 0, 21),
      },
      e_fWaterColor2: {
        type : PropertyType.COLOR,
        value: rgbaToNumber(255, 0, 30, 23),
      },
      e_fReflectionAmount: {
        type : PropertyType.NUMBER,
        value: 0.8,
      },
      e_fReflectionColor: {
        type : PropertyType.COLOR,
        value: rgbaToNumber(255, 255, 255, 255),
      },
    },
  },
  FlowingWater: {
    shader     : 'Opaque_MaxWater.fx',
    description: 'Flowing Water',
    properties : {
      e_TextureDiffuse0: {
        type    : PropertyType.STRING,
        value   : 'Material Texture',
        disabled: true,
      },
      e_TextureNormal0: {
        type    : PropertyType.STRING,
        value   : 'Normal Texture',
        disabled: true,
      },
      e_TextureEnvironment0: {
        type    : PropertyType.STRING,
        value   : 'Environment Texture',
        disabled: true,
      },
      e_fFresnelBias: {
        type : PropertyType.NUMBER,
        value: 0.11,
      },
      e_fFresnelPower: {
        type : PropertyType.NUMBER,
        value: 8,
      },
      e_fWaterColor1: {
        type : PropertyType.COLOR,
        value: rgbaToNumber(255, 0, 0, 21),
      },
      e_fWaterColor2: {
        type : PropertyType.COLOR,
        value: rgbaToNumber(255, 0, 30, 23),
      },
      e_fReflectionAmount: {
        type : PropertyType.NUMBER,
        value: 0.8,
      },
      e_fReflectionColor: {
        type : PropertyType.COLOR,
        value: rgbaToNumber(255, 255, 255, 255),
      },
      e_fSlide1X: {
        type : PropertyType.NUMBER,
        value: 0.04,
      },
      e_fSlide1Y: {
        type : PropertyType.NUMBER,
        value: 0.04,
      },
      e_fSlide2X: {
        type : PropertyType.NUMBER,
        value: 0.03,
      },
      e_fSlide2Y: {
        type : PropertyType.NUMBER,
        value: 0.03,
      },
    },
  },
  Waterfall: {
    shader     : 'Opaque_MaxWaterFall.fx',
    description: 'Waterfall',
    properties : {
      e_TextureDiffuse0: {
        type    : PropertyType.STRING,
        value   : 'Material Texture',
        disabled: true,
      },
      e_fSlide1X: {
        type : PropertyType.NUMBER,
        value: -0.11,
      },
      e_fSlide1Y: {
        type : PropertyType.NUMBER,
        value: -0.11,
      },
      e_fSlide2X: {
        type : PropertyType.NUMBER,
        value: 0,
      },
      e_fSlide2Y: {
        type : PropertyType.NUMBER,
        value: -0.5,
      },
    },
  },
};

export const MaterialDialog = ({
  open,
  setOpen,
  initialShader = 'Basic',
  initialProperties = undefined,
  onSave = () => {},
}) => {
  const [shader, setShader] = useState(initialShader);
  const [properties, setProperties] = useState({});

  useEffect(() => {
    setProperties(
      initialShader === shader && initialProperties
        ? initialProperties
        : ShaderList[shader].properties
    );
  }, [shader, initialShader, initialProperties]);
  return (
    <Dialog
      fullWidth
      maxWidth="sm"
      open={open}
      onClose={() => setOpen(false)}
      aria-labelledby="draggable-dialog-title"
    >
      <DialogTitle style={{ margin: '0 auto' }} id="draggable-dialog-title">
        Material Shaders
      </DialogTitle>
      <DialogContent className="about-content">
        <FormControl fullWidth sx={{ marginTop: '10px' }} size="small">
          <InputLabel id="demo-simple-select-label">Shader</InputLabel>
          <Select
            labelId="demo-simple-select-label"
            id="demo-simple-select"
            value={shader}
            label="Age"
            onChange={(e) => setShader(e.target.value)}
          >
            {Object.entries(ShaderList).map(([k, s]) => (
              <MenuItem value={k}>{s.description}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <List sx={{ margin: '10px 0' }}>
          {Object.entries(properties).map(([key, property]) => (
            <Stack
              component={'li'}
              alignItems={'center'}
              flexWrap={'wrap'}
              sx={{ padding: '5px' }}
              justifyContent={'space-between'}
              alignContent={'space-between'}
              direction="row"
            >
              <Typography>{key}</Typography>
              {property.type === PropertyType.STRING && (
                <TextField value={property.value} size="small" disabled>
                  {property.value}
                </TextField>
              )}
              {property.type === PropertyType.NUMBER && (
                <TextField
                  size="small"
                  type="number"
                  inputProps={{
                    style: { textAlign: 'center' },
                    step : 0.01,
                  }}
                  sx={{ margin: 0, padding: 0 }}
                  value={property.value}
                  onChange={(e) => {
                    setProperties((p) => ({
                      ...p,
                      [key]: { ...properties[key], value: +e.target.value },
                    }));
                  }}
                ></TextField>
              )}
              {property.type === PropertyType.COLOR && (
                <MuiColorInput
                  format={'hex8'}
                  value={rgbaNumberToHex(property.value)}
                  onChange={(e) => {
                    setProperties((p) => ({
                      ...p,
                      [key]: {
                        ...properties[key],
                        value: hexToRgbaNumber(e),
                      },
                    }));
                  }}
                />
              )}
            </Stack>
          ))}
        </List>
      </DialogContent>
      <DialogActions disableSpacing sx={{ margin: '5px' }}>
        <Button
          variant="outlined"
          onClick={async () => {
            setOpen(false);
          }}
        >
          Cancel
        </Button>
        <Button
          variant="outlined"
          sx={{ color: 'white', marginLeft: '10px' }}
          onClick={() => {
            onSave(shader, ShaderList[shader].shader, properties);
            setOpen(false);
          }}
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
};
