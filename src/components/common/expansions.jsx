import {
  Checkbox,
  FormControl,
  InputLabel,
  ListItemText,
  MenuItem,
  OutlinedInput,
  Select,
} from '@mui/material';
import { useMemo, useState } from 'react';
import { expansions } from 'sage-core/model/constants';

export const useExpansionList = ({ zones }) => {
  const [expansionFilter, setExpansionFilter] = useState([]);
  const filteredZoneList = useMemo(() => {
    if (expansionFilter.length === 0) {
      return zones;
    }
    return zones.filter((z) => {
      return expansionFilter.includes(z.expansion);
    });
  }, [zones, expansionFilter]);
  const handleExpansionFilterChange = (event) => {
    const {
      target: { value },
    } = event;
    setExpansionFilter(typeof value === 'string' ? value.split(',') : value);
  };
  const ExpansionList = useMemo(
    () => () =>
      (
        <FormControl
          size="small"
          sx={{ m: 1, width: 270, margin: '5px auto' }}
        >
          <InputLabel id="zone-filter-label">Expansion Filter</InputLabel>
          <Select
            labelId="zone-filter-label"
            id="zone-filter"
            fullWidth={false}
            multiple
            value={expansionFilter}
            onChange={handleExpansionFilterChange}
            input={<OutlinedInput label="Expansion Filter" />}
            renderValue={(selected) =>
              selected.length === 0
                ? 'None'
                : selected.map((a) => expansions[a]).join(', ')
            }
            MenuProps={{
              PaperProps: {
                style: {
                  maxHeight: 48 * 4.5 + 8,
                  width    : 250,
                },
              },
            }}
          >
            {expansions.map((name, idx) => (
              <MenuItem key={name} value={idx}>
                <Checkbox checked={expansionFilter.includes(idx)} />
                <ListItemText primary={name} />
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      ),
    [expansionFilter]
  );

  return {
    ExpansionList,
    filteredZoneList,
  };
};
