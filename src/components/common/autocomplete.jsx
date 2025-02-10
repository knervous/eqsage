import React, { useEffect, useState } from 'react';
import { Autocomplete, TextField } from '@mui/material';

// A constant for how many options to render at a time.
const PAGE_SIZE = 100;

const AsyncAutocomplete = ({
  options, // the complete options list (could be 10k+)
  value,
  onChange,
  label,
  ...props
}) => {
  // The text the user types.
  const [inputValue, setInputValue] = useState('');
  // The filtered (matching) options.
  const [filteredOptions, setFilteredOptions] = useState(options);
  // How many items to show from the filtered list.
  const [displayLimit, setDisplayLimit] = useState(PAGE_SIZE);

  // Whenever the input changes (or the original options update), filter.
  useEffect(() => {
    const filtered = options.filter((option) =>
      option.label.toLowerCase().includes(inputValue.toLowerCase())
    );
    setFilteredOptions(filtered);
    setDisplayLimit(PAGE_SIZE); // Reset paging when the filter changes.
  }, [inputValue, options]);

  // Only the options that should be rendered.
  const displayedOptions = filteredOptions.slice(0, displayLimit);

  // Create a custom Listbox component that listens for scrolling.
  // When the user scrolls near the bottom, we “load” more options.
  const ListboxComponent = React.forwardRef(function ListboxComponent(
    props,
    ref
  ) {
    const handleScroll = (event) => {
      const listboxNode = event.currentTarget;
      // If we've scrolled near the bottom, increase the display limit.
      if (
        listboxNode.scrollTop + listboxNode.clientHeight >=
        listboxNode.scrollHeight - 1
      ) {
        setDisplayLimit((prev) =>
          Math.min(prev + PAGE_SIZE, filteredOptions.length)
        );
      }
    };

    return (
      <ul
        {...props}
        ref={ref}
        onScroll={handleScroll}
        style={{
          maxHeight: 300, // Adjust based on your design needs.
          overflow : 'auto',
        }}
      >
        {props.children}
      </ul>
    );
  });

  return (
    <Autocomplete
      value={value}
      onChange={onChange}
      size="small"
      sx={{ '*': { color: 'white' } }}
      inputValue={inputValue}
      onInputChange={(event, newInputValue) => setInputValue(newInputValue)}
      options={displayedOptions}
      ListboxComponent={ListboxComponent}
      componentsProps={{ popper: {
        sx: {
          background: 'red !important'
        }
      } }}
      renderInput={(params) => (
        <TextField
          {...params}
          InputLabelProps={{
            ...params.InputLabelProps,
            sx: { ...(params.InputLabelProps.sx ?? {}), color: 'white' },
          }}
          label={label}
        />
      )}
      {...props}
    />
  );
};

export default AsyncAutocomplete;
