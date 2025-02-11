import React, { useEffect, useState, useMemo } from 'react';
import Autocomplete from '@mui/material/Autocomplete';
import TextField from '@mui/material/TextField';
import CircularProgress from '@mui/material/CircularProgress';
import { useDebouncedCallback } from 'use-debounce';
import { ItemApi } from 'spire-api/api/item-api';
import { Popper } from '@mui/material';

const StyledPopper = (props) => {
  const { anchorEl } = props;
  return (
    <Popper
      {...props}
      style={{

        width: '260px',
      }}
    />
  );
};

export const ItemSearch = ({ label, piece, onSelect, onClose, baseOptions }) => {
  const [options, setOptions] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);

  // This function performs the API call.
  const fetchOptions = async (query) => {
    setLoading(true);
    try {
      if (baseOptions) {
        const options = [];
        for (const o of baseOptions) {
          if (o.label.toLowerCase().includes(query)) {
            options.push({
              id   : o.label,
              label: o.label,
              item : {
                name : o.label,
                icon : o.icon,
                model: o.model
              }
            });
          }
          if (options.length > 19) {
            break;
          }
        }
        setOptions(options);
      } else {
        const Spire = window.Spire;
        const itemApi = new ItemApi(...Spire.SpireApi.cfg());
        const queryBuilder = new Spire.SpireQueryBuilder();
        queryBuilder.where('name', 'like', query);
        queryBuilder.where('slots', '!=', 65535);
        const bitwiseMap = {
          Helm     : 4,
          Arms     : 128,
          Wrists   : 1536,
          Hands    : 4096,
          Primary  : 8192,
          Secondary: 16384,
          Legs     : 262144,
          Chest    : 131072,
          Feet     : 524288,
  
        };
        queryBuilder.where('slots', '&', bitwiseMap[piece]);
        queryBuilder.limit(20);
  
        const options = [];
        const result = await itemApi.listItems(queryBuilder.get());
        for (const r of result.data) {
          options.push({
            id   : r.id,
            label: r.name,
            item : r
          });
        }
        setOptions(options);
      }
    
    } catch (error) {
      console.log('Error fetching options:', error);
      setOptions([]);
    }
    setLoading(false);
  };

  // Create a debounced version of the fetchOptions function.
  // This ensures that we only fire the API call after 300ms of no changes.
  const debouncedFetchOptions = useDebouncedCallback(fetchOptions);

  // Effect to trigger the API call when the inputValue changes.
  useEffect(() => {
    debouncedFetchOptions(inputValue);

    // Clean up the debounce on unmount or when inputValue changes.
    return () => {
      debouncedFetchOptions.cancel();
    };
  }, [inputValue, debouncedFetchOptions]);

  return (
    <Autocomplete
      freeSolo
      size='small'
      options={options}
      loading={loading}
      onKeyDown={e => {
        if (e.key === 'Escape') {
          onClose();
        }
      
      }}
      onChange={(_e, v) => {
        console.log('Val', v);

        onSelect(v.item);
      }}
      onInputChange={(_e, newInputValue) => {
        setInputValue(newInputValue);
      }}
      PopperComponent={StyledPopper}
      getOptionLabel={(option) => option.label}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          variant="outlined"
          InputProps={{
            ...params.InputProps,
            // Display a loading spinner when fetching data.
            endAdornment: (
              <>
                {loading ? <CircularProgress color="inherit" size={20} /> : null}
                {params.InputProps.endAdornment}
              </>
            ),
          }}
        />
      )}
    />
  );
};
