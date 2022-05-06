import React from 'react';
import styled from 'styled-components';

function Settings({ fuelValue, setFuelValue }) {
  return (
    <Wrapper>
      <label htmlFor="e5">E5</label>
      <input
        checked={fuelValue === 'e5'}
        type="radio"
        id="e5"
        name="filter"
        value="e5"
        onChange={() => setFuelValue('e5')}
      />
      <label htmlFor="e10">E10</label>
      <input
        checked={fuelValue === 'e10'}
        type="radio"
        id="e10"
        name="filter"
        value="e10"
        onChange={() => setFuelValue('e10')}
      />
      <label htmlFor="diesel">Diesel</label>
      <input
        checked={fuelValue === 'diesel'}
        type="radio"
        id="diesel"
        name="filter"
        value="diesel"
        onChange={() => setFuelValue('diesel')}
      />
    </Wrapper>
  );
}

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
`;

export default Settings;
